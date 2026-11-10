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

/**
 * The script a customer pastes into their site.
 *
 * It loads `@iblai/agent-ai` from a pinned bundle and mounts `<agent-ai>`,
 * which owns everything hard about an embed: the `ibl-data` handshake,
 * expiry and re-auth, the auth-SPA redirect, organization switching, context
 * sharing, the nested-embed relay, fullscreen and the close button. This used
 * to be ~500 lines of that logic written out by hand into every customer's
 * page, where it could only be fixed by asking them to re-copy it.
 *
 * What stays here is the launcher: a floating bubble, its branding, and
 * showing or hiding the widget. The component deliberately renders none —
 * hosts that embed it inline (the Chrome extension side panel, a nested edX
 * frame) do not want one.
 *
 * The bundle is PINNED by `versionId`. A pasted snippet keeps running whatever
 * it was generated with, so an unpinned URL would hand every existing embed a
 * new widget with no one re-copying anything.
 */
export const getEmbedCode = async (
  tenant: string,
  // `allow_anonymous` is owned by Settings -> Discovery and is no longer an
  // embed-form field (#2476), but the generated snippet still needs it to
  // decide whether the agent may be read without signing in — the caller
  // passes it in alongside the form values.
  settings: EmbedFormValues & {
    allow_anonymous: boolean;
    allow_mentor_selection?: boolean;
    allow_fullscreen?: boolean;
  },
  redirectToken: string,
  useCustomFloatingBubble?: boolean,
  customFloatingBubbleConfig?: CustomFloatingBubbleConfig,
) => {
  const bubbleImgUrl = await getBubbleImage(tenant);
  const bubble = customFloatingBubbleConfig;

  // `extra-body-classes` is what tells the agent it is framed by someone
  // else; the rest of the iframe URL is the component's business.
  const extraParams = 'extra-body-classes=iframed-externally';

  // Name/value pairs rather than markup: the snippet sets them with
  // setAttribute, so nothing here has to be HTML-escaped by hand. A boolean
  // attribute is present-or-absent, which is why its value is ''.
  const attrs: [string, string][] = [
    ['mentorurl', config.mentorIframeUrl()],
    ['authurl', config.authUrl()],
    ['lmsurl', config.legacyLmsUrl()],
    ['tenant', tenant],
    ['mentor', settings.slug],
    ['extraparams', extraParams],
    // Unconditional: the app only keeps the chat's Close by default when the
    // iframe URL has no `mode`, and the component always stamps
    // `mode=anonymous` on it (see `useShowCloseButton`). This snippet is the
    // bubble embed — the launcher stays on screen to reopen a closed panel —
    // so Close belongs here, and the host-side `closeEmbed` listener below is
    // what it talks to.
    ['showclosebutton', ''],
  ];
  if (settings.mode === 'advanced') attrs.push(['isadvanced', '']);
  if (settings.allow_anonymous) attrs.push(['isanonymous', '']);
  if (settings.is_context_aware) attrs.push(['iscontextaware', '']);
  if (settings.allow_mentor_selection) attrs.push(['allowmentorselection', '']);
  if (settings.allow_fullscreen) attrs.push(['allowfullscreen', '']);
  if (settings.sso_provider) attrs.push(['ssoprovider', settings.sso_provider]);
  // Only an agent that requires signing in needs a way back to this page.
  if (!settings.allow_anonymous && redirectToken) {
    attrs.push(['redirecttoken', redirectToken]);
  }

  const panelPosition =
    settings.mode === 'default'
      ? 'bottom: 96px; right: 60px; width: 400px; height: 82%;'
      : 'bottom: 96px; right: 60px; top: 15px; width: 400px; height: 96%;';

  const bubblePosition =
    {
      'bottom-right': 'bottom: 20px; right: 30px;',
      'bottom-left': 'bottom: 20px; left: 30px;',
      'top-right': 'top: 20px; right: 30px;',
      'top-left': 'top: 20px; left: 30px;',
    }[bubble?.position ?? 'bottom-right'] ??
    (settings.mode === 'default'
      ? 'bottom: 20px; right: 60px;'
      : 'top: 15px; right: 15px;');

  const bubbleInner = useCustomFloatingBubble
    ? `<img src="${bubble?.image || bubbleImgUrl}" alt="" style="width:${bubble?.imageSize || 32}px;height:${bubble?.imageSize || 32}px;object-fit:contain;">` +
      (bubble?.title || bubble?.subtitle
        ? `<span style="display:flex;flex-direction:column;text-align:center;">` +
          (bubble?.title
            ? `<span style="font-size:${bubble.fontSize}px;font-weight:500;color:${bubble.textColor};white-space:nowrap;">${bubble.title}</span>`
            : '') +
          (bubble?.subtitle
            ? `<span style="font-size:${bubble.subtitleFontSize}px;color:${bubble.subtitleTextColor};white-space:nowrap;">${bubble.subtitle}</span>`
            : '') +
          `</span>`
        : '')
    : `<img src="${bubbleImgUrl}" alt="" style="width:100%;height:100%;border-radius:50%;">`;

  const bubbleStyle = useCustomFloatingBubble
    ? `position:fixed;${bubblePosition}display:flex;align-items:center;gap:8px;` +
      `background-color:${bubble?.backgroundColor};color:${bubble?.textColor};` +
      `border-radius:${bubble?.borderRadius}px;padding:${bubble?.padding}px;` +
      `${bubble?.shadow ? 'box-shadow:0 4px 12px rgba(0,0,0,0.15);' : ''}` +
      `${bubble?.strokeWidth ? `border:${bubble.strokeWidth}px solid ${bubble.strokeColor};` : 'border:none;'}` +
      `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;` +
      `font-size:${bubble?.fontSize}px;font-weight:500;cursor:pointer;z-index:2147483646;`
    : `position:fixed;${bubblePosition}height:50px;border:none;background:none;padding:0;cursor:pointer;z-index:2147483646;`;

  return `
<script src="${config.agentAiSdkUrl()}"></script>
<script>
(function () {
  var panel, agent, bubble, injected = false;

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'ibl-chat-widget-container';
    panel.style.cssText = 'position:fixed;${panelPosition}border:1px solid #dfdfdf;border-radius:13px;overflow:hidden;z-index:2147483647;';

    agent = document.createElement('agent-ai');
    ${attrs
      .map(
        ([name, value]) =>
          `agent.setAttribute(${JSON.stringify(name)}, ${JSON.stringify(value)});`,
      )
      .join('\n    ')}
    agent.style.cssText = 'display:block;width:100%;height:100%;';

    panel.appendChild(agent);
    document.body.appendChild(panel);
    injected = true;
  }

  function toggle() {
    if (!injected) {
      buildPanel();
      bubble.setAttribute('aria-expanded', 'true');
      return;
    }
    var hidden = panel.style.display === 'none';
    panel.style.display = hidden ? '' : 'none';
    bubble.setAttribute('aria-expanded', String(hidden));
    if (!hidden) bubble.focus();
  }

  function init() {
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1';
    document.head.appendChild(meta);

    var style = document.createElement('style');
    style.textContent = '@media screen and (max-width:768px){#ibl-chat-widget-container{width:90%!important;max-width:400px!important;right:15px!important}.ibl-chat-bubble{right:20px!important}}';
    document.head.appendChild(style);

    bubble = document.createElement('button');
    bubble.className = 'ibl-chat-bubble';
    bubble.type = 'button';
    bubble.style.cssText = ${JSON.stringify(bubbleStyle)};
    bubble.innerHTML = ${JSON.stringify(bubbleInner)};
    bubble.setAttribute('aria-label', 'Open chat assistant');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.addEventListener('click', toggle);
    document.body.appendChild(bubble);

    ${settings.auto_open ? 'setTimeout(function () { if (!injected) toggle(); }, 500);' : ''}
  }

  // The agent asks to be closed; the launcher is ours, so the hiding is too.
  window.addEventListener('message', function (event) {
    var message = event.data;
    if (typeof message === 'string') {
      try { message = JSON.parse(message); } catch (error) { return; }
    }
    if (message && message.closeEmbed && injected && panel.style.display !== 'none') {
      toggle();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;
};
