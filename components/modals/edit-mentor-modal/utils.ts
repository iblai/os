import { config } from '@/lib/config';

/**
 * Validates that a website URL is a valid origin (scheme + host) without
 * trailing slash or extra path segments.
 * Returns an error string or undefined if valid.
 */
export function validateWebsiteUrl(value: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.pathname !== '/' && url.pathname !== '') {
      return 'URL should be origin only, without a path (e.g. https://ibl.ai)';
    }
    if (url.pathname === '/' && value.endsWith('/')) {
      return 'Remove the trailing slash (e.g. https://ibl.ai)';
    }
  } catch {
    return 'Enter a valid URL with scheme (e.g. https://ibl.ai)';
  }
  return undefined;
}
import {
  CustomFloatingBubbleConfig,
  EmbedFormValues,
} from './hooks/useEmbedTab';

/**
 * Returns true when the given string is an inline data URL (base64 image
 * preview produced by `FileReader.readAsDataURL`), as opposed to a resolved
 * remote URL or a relative asset path.
 */
export function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

/**
 * Converts a base64 data URL (e.g. the preview produced when a user uploads a
 * custom launcher icon) into a real `File` so it can be sent to the backend as
 * the multipart `embed_custom_image` field. Returns `null` when the input is
 * not a data URL.
 */
export function dataUrlToFile(
  dataUrl: string,
  filename = 'embed-custom-image',
): File | null {
  if (!isDataUrl(dataUrl)) return null;

  const [header, base64Data] = dataUrl.split(',');
  if (!base64Data) return null;

  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Derive a sensible extension from the mime type (e.g. image/png -> png).
  // `mime` always contains a "/" (parsed value or the octet-stream fallback),
  // so the subtype is always present.
  const extension = mime.split('/')[1].split('+')[0];
  const safeName = filename.includes('.')
    ? filename
    : `${filename}.${extension}`;

  return new File([bytes], safeName, { type: mime });
}

/**
 * Builds the persisted icon-selection JSON map from a
 * `CustomFloatingBubbleConfig` (everything except the raw image binary). The map
 * is stored in `embed_icon_selection_data` and the image in `embed_custom_image`,
 * and the pair round-trips back via `buildFloatingBubbleConfigFromSettings`.
 *
 * Note: we intentionally do NOT embed an `icon_selection` key here. The
 * custom-vs-default mode is now derived from the *existence* of this JSON map
 * (present => custom, absent/cleared => default), so storing the mode inside the
 * map would be redundant data that could drift out of sync with reality.
 */
export function buildEmbedIconSelectionData(
  config: CustomFloatingBubbleConfig,
): Record<string, unknown> {
  const { image: _image, ...rest } = config;
  return { ...rest };
}

/**
 * Single source of truth for "did the user choose a custom launcher icon?".
 *
 * The custom-vs-default mode is derived from the persisted
 * `embed_icon_selection_data` JSON map. The mode is 'custom' ONLY when that
 * value is a NON-EMPTY object (at least one own key); a `null`, an empty object
 * `{}`, an empty string, or any non-object value all mean 'default'.
 *
 * Why non-empty (not mere existence): the backend clears this field by storing
 * an empty JSON object `{}` (see `syncEmbedSettings`). Verified live behavior of
 * the multipart PUT for `embed_icon_selection_data`:
 *   - `''`   -> HTTP 400 ("Value must be valid JSON").
 *   - `null` (JSON null) -> HTTP 200 but the field is NOT changed; DRF's
 *     partial-update silently ignores JSON null, so the old custom JSON persists.
 *   - `{}`   -> HTTP 200 and the field IS set to `{}` (the only working clear).
 * So a cleared field reads back as `{}`, which must derive to 'default'. The
 * mode must depend ONLY on this JSON, never on `embed_custom_image` (a stale
 * image URL may linger after switching to default and must not force 'custom').
 */
export function hasCustomIconData(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

/**
 * Reconstructs a `CustomFloatingBubbleConfig` from persisted mentor settings.
 * The `embed_icon_selection_data` JSON map holds every field except the raw
 * image, which is supplied separately by `embed_custom_image` (a resolved URL).
 * Falls back to the provided defaults for any missing field so an older /
 * partial payload still hydrates cleanly. Returns `null` when there is no
 * persisted icon-selection data to hydrate from.
 *
 * The returned `iconSelection` is derived via `hasCustomIconData`: a NON-EMPTY
 * object map means the user chose 'custom'; a cleared map (empty object `{}`,
 * null, empty string, non-object) means 'default'. This makes a cleared field
 * (which the backend stores as `{}`) unambiguously mean default, so switching
 * custom -> default and reloading correctly shows default — even if a stale
 * `embed_custom_image` URL still lingers.
 */
export function buildFloatingBubbleConfigFromSettings(
  defaults: CustomFloatingBubbleConfig,
  iconSelectionData: unknown,
  customImage: string | null | undefined,
): { config: CustomFloatingBubbleConfig; iconSelection: string } | null {
  const data =
    iconSelectionData && typeof iconSelectionData === 'object'
      ? (iconSelectionData as Record<string, unknown>)
      : null;

  if (!data && !customImage) return null;

  // Tolerate a legacy `icon_selection` key that older payloads may still carry
  // inside the JSON — it is no longer authoritative, so we drop it.
  const {
    icon_selection: _legacyIconSelection,
    image: _persistedImage,
    ...rest
  } = data ?? {};

  const config: CustomFloatingBubbleConfig = {
    ...defaults,
    ...(rest as Partial<CustomFloatingBubbleConfig>),
    image: customImage || defaults.image,
  };

  return {
    config,
    // A NON-EMPTY JSON map is the source of truth for the mode; an empty `{}`
    // (the backend's cleared state) derives to 'default'.
    iconSelection: hasCustomIconData(iconSelectionData) ? 'custom' : 'default',
  };
}

const getBubbleImage = async (tenant: string) => {
  let bubbleImg = `/images/ibl-logo-animated.gif`;

  // The thumbnail is a DM (manager) endpoint, so we build it from dmUrl().
  // On the unified API gateway, axdUrl() resolves to an invalid `/axd` prefix
  // (HTTP 404), whereas dmUrl() -> `/dm/...` returns 200. In the legacy config
  // (no API base URL) axdUrl() and dmUrl() are identical, so behavior is
  // unchanged there. This matches the live-preview default in useEmbedTab.ts.
  const url = `${config.dmUrl()}/api/core/orgs/${tenant}/thumbnail/`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      bubbleImg = url;
    } else {
      if (tenant !== 'main') {
        const url2 = `${config.dmUrl()}/api/core/orgs/main/thumbnail/`;
        const response2 = await fetch(url2);
        if (response2.ok) {
          bubbleImg = url2;
        }
      }
    }
  } catch (error) {
    console.error(JSON.stringify(error));
  }

  return bubbleImg;
};

const getUrl = (
  settings: EmbedFormValues,
  tenant: string,
  extraBodyClasses = '',
) => {
  let url = `${config.mentorIframeUrl()}/platform/${tenant}/${settings?.slug}?embed=true`;
  if (extraBodyClasses) {
    url += `&extra-body-classes=${extraBodyClasses}`;
  }
  if (settings.mode === 'advanced') {
    url += `&chat=advanced`;
  }
  return url;
};

export const getEmbedCode = async (
  tenant: string,
  settings: EmbedFormValues,
  redirectToken: string,
  useCustomFloatingBubble?: boolean,
  customFloatingBubbleConfig?: CustomFloatingBubbleConfig,
) => {
  const bubbleImgUrl = await getBubbleImage(tenant);
  const getIframeContainerStyle = ({
    right,
    bottom,
    top,
    left,
  }: {
    right?: number;
    bottom?: number;
    top?: number;
    left?: number;
  }) => {
    if (settings.mode === 'default') {
      return `position: fixed; border: 1px solid #dfdfdf; bottom: ${bottom ?? 96}px; right: ${right ?? 60}px; z-index: 2147483647; width: 400px; height: 82%;top: ${top ? top + 'px' : 'auto'}; left: ${left ? left + 'px' : 'auto'};`;
    } else {
      return `position: fixed; border: 1px solid #dfdfdf; bottom: ${bottom ?? 96}px; right: ${right ?? 60}px; z-index: 2147483647; width: 400px; height: 96%; top: ${top ?? 15}px;`;
    }
  };
  return `
            <script>
            
            window.onload = function() {
              let isEmbeddedMentorReady = false;
              let embedTenant = "${tenant}";
              const iblData = new URL(window.location.href).searchParams.get("ibl-data");
              if (iblData) {
                const url = new URL(window.location);
                url.searchParams.delete("ibl-data");
                window.history.replaceState({}, document.title, url);
                const userData = JSON.parse(iblData).userData;
                document.cookie = \`userData=\${userData}; domain=\${document.domain}; path=/;\`;
              }
              
                ${
                  settings.is_context_aware
                    ? `function getCleanBodyContent() {
                        const bodyClone = document.body.cloneNode(true);
                        const selectorsToRemove = [
                            'script', 
                            'style', 
                            'nav', 
                            'footer', 
                            '.ads', 
                            '.sidebar', 
                            '.popup', 
                            '.cookie-banner', 
                            '#ibl-chat-widget-container', 
                            '.ibl-chat-bubble'
                        ];
                        selectorsToRemove.forEach(selector => {
                            const elements = bodyClone.querySelectorAll(selector);
                            elements.forEach(element => element.remove());
                        });
                        const removeComments = (node) => {
                            for (let i = 0; i < node.childNodes.length; i++) {
                                const child = node.childNodes[i];
                                if (child.nodeType === 8) { // Node.COMMENT_NODE
                                    node.removeChild(child);
                                    i--; // Adjust index to account for removed node
                                } else if (child.nodeType === 1) { // Node.ELEMENT_NODE
                                    removeComments(child);
                                }
                            }
                        };
                        removeComments(bodyClone);
                        return bodyClone.innerHTML;
                      }

                function sendHostInfoToIframe() {
                  const iframe = document.querySelector('#ibl-chat-widget-container iframe');
                  if (iframe && iframe.contentWindow) {
                    const bodyContent = getCleanBodyContent();
                    const payload = {
                      type: 'MENTOR:CONTEXT_UPDATE',
                      hostInfo: {
                        title: document.title,
                        href: window.location.href
                      },
                      pageContent: bodyContent
                    }
                    iframe.contentWindow.postMessage(payload, '*');
                  }
                }`
                    : ''
                }

                function sendAuthDataToIframe() {
                    const iframe = document.querySelector('#ibl-chat-widget-container iframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'MENTOR:AUTH_UPDATE', authData: iblData }, '*');
                    }
                }

                function isTokenExpired(token_expires) {
                  const expirationDate = new Date(token_expires);
                  const now = new Date();
                  return now >= expirationDate;
                }

                function redirectToAuthSPA(forceLogout) {
                    const redirectPath = window.location.pathname + window.location.search;
                    window.location.href = \`${config.authUrl()}/login?redirect-path=\${redirectPath}${!settings.allow_anonymous ? '&redirect-token=' + redirectToken : ''}&tenant=${tenant}${settings.sso_provider ? '&custom_sso_backend_path=' + settings.sso_provider : ''}\${forceLogout ? '&logout=true' : ''}\`;
                }

                let isWidgetInjected = false;

                function createWidget() {
                    const iframeContainer = document.createElement('div');
                    iframeContainer.id = 'ibl-chat-widget-container';
                    iframeContainer.style = "${
                      useCustomFloatingBubble
                        ? getIframeContainerStyle({
                            ...(customFloatingBubbleConfig?.position ===
                            'bottom-right'
                              ? {
                                  right: 30,
                                  bottom: Number(
                                    Number(customFloatingBubbleConfig.padding) +
                                      Number(
                                        customFloatingBubbleConfig.imageSize,
                                      ) +
                                      50,
                                  ),
                                }
                              : {}),
                            ...(customFloatingBubbleConfig?.position ===
                            'bottom-left'
                              ? {
                                  left: 30,
                                  bottom: Number(
                                    Number(customFloatingBubbleConfig.padding) +
                                      Number(
                                        customFloatingBubbleConfig.imageSize,
                                      ) +
                                      50,
                                  ),
                                }
                              : {}),
                            ...(customFloatingBubbleConfig?.position ===
                            'top-right'
                              ? {
                                  right: 30,
                                  top: Number(
                                    Number(customFloatingBubbleConfig.padding) +
                                      Number(
                                        customFloatingBubbleConfig.imageSize,
                                      ) +
                                      50,
                                  ),
                                }
                              : {}),
                            ...(customFloatingBubbleConfig?.position ===
                            'top-left'
                              ? {
                                  left: 30,
                                  top: Number(
                                    Number(customFloatingBubbleConfig.padding) +
                                      Number(
                                        customFloatingBubbleConfig.imageSize,
                                      ) +
                                      50,
                                  ),
                                }
                              : {}),
                          })
                        : getIframeContainerStyle(
                            settings.mode === 'default'
                              ? { right: 60, bottom: 96 }
                              : { right: 15, top: 15, bottom: 96 },
                          )
                    }";
                    
                    const iframe = document.createElement('iframe');
                    iframe.src = '${getUrl(settings, tenant, 'iframed-externally')}';
                    ${
                      settings.mode === 'default'
                        ? 'iframe.style = "border: 0px white; height:100%;width:100%;border-radius: 13px;";'
                        : 'iframe.style = "border: 0px white; height:100%;width:100%;border-radius: 0;";'
                    }
                    iframe.allow = "clipboard-read; clipboard-write; microphone *; camera *; midi *; geolocation *; encrypted-media *; display-capture *";
                    iframe.setAttribute('tabindex', '0');
                    iframe.setAttribute('title', 'Chat assistant iframe');

                    iframeContainer.appendChild(iframe);
                    document.body.appendChild(iframeContainer);
                    
                    return { iframeContainer, iframe };
                }

                function toggleWidget() {
                  let widget = document.getElementById('ibl-chat-widget-container');
                  const bubble = document.querySelector('.ibl-chat-bubble');
                  let iframe = widget?.querySelector('iframe');

                  if (!isWidgetInjected) {
                      // First time opening - inject into DOM
                      const created = createWidget();
                      widget = created.iframeContainer;
                      iframe = created.iframe;
                      isWidgetInjected = true;
                      
                      bubble.setAttribute('aria-expanded', 'true');
                      setTimeout(() => {
                        iframe.focus();
                        setupFocusTrap(iframe);
                      }, 100);
                  } else {
                      // Subsequent toggles - use display toggle
                      if (widget.style.display === 'none') {
                          widget.style.display = '';
                          bubble.setAttribute('aria-expanded', 'true');

                          setTimeout(() => {
                            iframe.focus();
                            setupFocusTrap(iframe);
                          }, 100);
                      } else {
                          widget.style.display = 'none';
                          bubble.setAttribute('aria-expanded', 'false');
                          bubble.focus();
                          removeFocusTrap();
                      }
                  }
                }

                let focusTrapHandler = null;

                function setupFocusTrap(iframe) {
                  focusTrapHandler = function(event) {
                    if (event.key === 'Tab') {
                      const widget = document.getElementById('ibl-chat-widget-container');
                      if (widget && widget.style.display !== 'none') {
                        if (!iframe.contains(event.target) && event.target !== iframe) {
                          event.preventDefault();
                          iframe.focus();
                        }
                      }
                    }
                  };
                  document.addEventListener('keydown', focusTrapHandler, true);
                }

                function removeFocusTrap() {
                  if (focusTrapHandler) {
                    document.removeEventListener('keydown', focusTrapHandler, true);
                    focusTrapHandler = null;
                  }
                }

                function initChatWidget() {
                    //Creating Appropriate Meta Tag for optimized mobile display 
                    const metaViewportTagEl = document.createElement('meta')
                    metaViewportTagEl.name="viewport"
                    metaViewportTagEl.content="width=device-width, initial-scale=1"
                    document.head.appendChild(metaViewportTagEl)
                    
                    //Optimizing mobile display
                    const additionStyleEl = document.createElement('style')
                    additionStyleEl.innerHTML = "@media screen and (max-width:768px){#ibl-chat-widget-container{width:90%!important;max-width:400px!important;right:15px!important}img.ibl-chat-bubble{right:20px!important}}"
                    document.head.appendChild(additionStyleEl)
                    
                    // Only create bubble initially - iframe will be injected on first open
                    let bubble;
                    ${
                      !useCustomFloatingBubble
                        ? `
                    bubble = document.createElement('button');
                    const bubbleImg = document.createElement('img');
                    bubbleImg.src = '${bubbleImgUrl}';
                    bubbleImg.alt = 'Chat assistant';
                    bubbleImg.style = 'width: 100%; height: 100%; border: none; background: none; border-radius: 50%;';
                    bubble.appendChild(bubbleImg);
                    bubble.setAttribute('tabindex', '0');
                    ${
                      settings.mode === 'default'
                        ? 'bubble.style = "position: fixed; right: 60px; bottom: 20px; height: 50px; cursor:pointer;";'
                        : 'bubble.style = "position: fixed; right: 15px; top: 15px; height: 50px; cursor:pointer;";'
                    } 
                      `
                        : //GENERATING EMBED BUBBLE HTML WRAPPER
                          `
                        bubble = document.createElement('button');
                        bubble.innerHTML = \`
                          <button tabindex="0" style="
                            position: fixed;
                            ${customFloatingBubbleConfig?.position === 'bottom-right' ? 'bottom: 20px; right: 30px;' : ''}
                            ${customFloatingBubbleConfig?.position === 'bottom-left' ? 'bottom: 20px; left: 30px;' : ''}
                            ${customFloatingBubbleConfig?.position === 'top-right' ? 'top: 20px; right: 30px;' : ''}
                            ${customFloatingBubbleConfig?.position === 'top-left' ? 'top: 20px; left: 30px;' : ''}
                            height: auto;
                            background-color: ${customFloatingBubbleConfig?.backgroundColor};
                            color: ${customFloatingBubbleConfig?.textColor};
                            border-radius: ${customFloatingBubbleConfig?.borderRadius}px;
                            padding: ${customFloatingBubbleConfig?.padding}px;
                            ${customFloatingBubbleConfig?.shadow ? 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);' : ''}
                            ${customFloatingBubbleConfig?.strokeWidth ? `border: ${customFloatingBubbleConfig?.strokeWidth}px solid ${customFloatingBubbleConfig?.strokeColor};` : 'border: none;'}
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            font-size: ${customFloatingBubbleConfig?.fontSize}px;
                            font-weight: 500;
                            transition: all 0.2s ease;
                            z-index: 2147483646;
                            min-width: fit-content;
                          ">
                            <img src="${customFloatingBubbleConfig?.image || bubbleImgUrl}" alt="Chat" style="width: ${customFloatingBubbleConfig?.imageSize || 32}px; height: ${customFloatingBubbleConfig?.imageSize || 32}px; object-fit: contain;">
                            ${
                              customFloatingBubbleConfig?.title ||
                              customFloatingBubbleConfig?.subtitle
                                ? `<span style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                                    ${customFloatingBubbleConfig?.title ? `<span style="font-size: ${customFloatingBubbleConfig?.fontSize}px; font-weight: 500; color: ${customFloatingBubbleConfig?.textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${customFloatingBubbleConfig?.title}</span>` : ''}
                                    ${customFloatingBubbleConfig?.subtitle ? `<span style="font-size: ${customFloatingBubbleConfig?.subtitleFontSize}px; color: ${customFloatingBubbleConfig?.subtitleTextColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${customFloatingBubbleConfig?.subtitle}</span>` : ''}
                                   </span>`
                                : ''
                            }
                          </button>
                        \`;
                        bubble = bubble.firstElementChild;
                        `
                    }
                    bubble.classList.add('ibl-chat-bubble');
                    bubble.setAttribute('aria-label', 'Open chat assistant');
                    bubble.setAttribute('aria-expanded', 'false');
                    bubble.addEventListener('click', toggleWidget);
                    bubble.addEventListener('keydown', function(event) {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleWidget();
                      }
                    });
                    
                    document.body.appendChild(bubble);
                    
                    // Handle auto-open
                    ${
                      settings.auto_open
                        ? `setTimeout(function() { 
                             if (!isWidgetInjected) {
                               toggleWidget();
                             }
                           }, 500);`
                        : ''
                    }
                }

                ${
                  settings.is_context_aware
                    ? `
                let lastUrl = window.location.href;
                setInterval(() => {
                    const currentUrl = window.location.href;
                    if (currentUrl !== lastUrl) {
                        lastUrl = currentUrl;
                        isEmbeddedMentorReady && sendHostInfoToIframe();
                    }
                }, 1000);
                `
                    : ''
                }
                initChatWidget();
                window.addEventListener('message', function(event) {
                    let message = event.data;
                    if (typeof message === 'string') {
                        try {
                            message = JSON.parse(message);
                        } catch (error) {
                            return;
                        }
                    }
                    ${
                      !settings.allow_anonymous
                        ? `
                        if (message?.loaded && message?.auth?.axd_token){
                          const _userData = document.cookie.includes('userData=') ? document.cookie.split('userData=')[1].split(';')[0] : null;
                          !_userData && redirectToAuthSPA(true);
                        }
                        
                        if (
                          message?.loaded &&
                          (!message.auth.axd_token ||
                            !message.auth.dm_token ||
                            message.auth.tenant !== embedTenant ||
                            isTokenExpired(message.auth.dm_token_expires) ||
                            isTokenExpired(message.auth.axd_token_expires))
                        ) {
                          !iblData && redirectToAuthSPA();
                        } 
                        
                        if (message?.loaded && message.auth.userData ) {
                        const userData = document.cookie.includes('userData=') ? document.cookie.split('userData=')[1].split(';')[0] : null;
                        if (userData ) {
                            try {
                                const parsedUserData = JSON.parse(userData);
                                if (parsedUserData.user_id !== JSON.parse(message.auth.userData).user_id) {
                                  if (iblData) {
                                    sendAuthDataToIframe();
                                  } else {
                                    ${!settings.allow_anonymous ? 'redirectToAuthSPA();' : ''}
                                  }
                                }
                            } catch (error) {
                                console.error('Error parsing userData cookie:', error);
                            }
                        }
                        }`
                        : ''
                    }
                    
                    if (message?.authExpired) {
                      if(iblData){
                        sendAuthDataToIframe();
                      }else{
                        ${!settings.allow_anonymous ? 'redirectToAuthSPA(true);' : ''}
                      }
                    } else if (message?.ready) {
                      isEmbeddedMentorReady = true
                    }
                    if(message?.loaded){
                      ${settings.is_context_aware ? 'sendHostInfoToIframe();' : ''}
                    }
                    if (message?.closeEmbed) {
                      toggleWidget();
                    }
                });
            };
            </script>
        `;
};
