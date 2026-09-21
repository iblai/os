// Glue between the side panel and the mentor iframe inside <agent-ai> (ported
// from the original panel.js).
import { extractPageContent } from './page-scripts';
import { isAuthed, sessionData } from './auth';

export interface PageContent {
  title: string;
  href: string;
  text: string;
}

export function mentorIframe(host: Element): HTMLIFrameElement | null {
  return (
    host.shadowRoot?.querySelector<HTMLIFrameElement>(
      '#ibl-chat-widget-container iframe',
    ) ?? null
  );
}

// ---- Install the session INTO the mentor iframe ------------------------------
// `<agent-ai authrelyonhost>` forwards our tokens to the iframe via postMessage,
// but that hand-off doesn't survive the side panel's storage-partitioned iframe:
// the mentor app boots, reads its own EMPTY localStorage, and logs itself out
// before the posted tokens land. Instead we point the iframe at the mentor app's
// `/sso-login-complete`, which INSTALLS the session into (partitioned) storage on
// load and then redirects to the chat — the same deterministic path the normal
// web login uses.
//
// Returns true once the iframe is routed through the installer (or already was),
// so the poller knows to stop.
export function installSession(host: Element): boolean {
  if (!isAuthed()) return false;
  const mentorUrl = (host.getAttribute('mentorurl') || '').replace(/\/+$/, '');
  const iframe = mentorIframe(host);
  const src = iframe?.getAttribute('src');
  if (!iframe || !mentorUrl || !src) return false; // widget iframe not mounted yet
  if (src.includes('/sso-login-complete')) return true; // already routed
  if (!src.startsWith(mentorUrl)) return false; // only rewrite the mentor iframe

  // Leave the iframe's `allow` policy alone: the widget already sets a superset,
  // and overwriting it here would revoke the features we don't re-list.
  // Return to the EXACT chat URL the component asked for — keep all of its embed
  // params (embed / mode / component / extra-body-classes) untouched.
  //
  // The param MUST be `redirect-path`: SsoLogin reads the incoming target from
  // `searchParams.get('redirect-path')` (the `redirect-to` name only addresses
  // the localStorage fallback key, never the URL).
  const original = new URL(src);
  const redirectPath = original.pathname + original.search;
  const session = sessionData();
  iframe.src =
    `${mentorUrl}/sso-login-complete` +
    `?data=${encodeURIComponent(JSON.stringify(session))}` +
    `&redirect-path=${encodeURIComponent(redirectPath)}` +
    (session.tenant ? `&tenant=${encodeURIComponent(session.tenant)}` : '');
  return true;
}

// Try immediately, then poll until the iframe appears and rewrite it once. Give
// up after ~30s so a failed sign-in or an iframe that never matches doesn't
// leave the interval running for the panel's lifetime.
//
// The immediate attempt is what keeps the app from loading TWICE. The component
// builds its iframe in its constructor and sets the src from
// `attributeChangedCallback` (React setting `component="chat"`), so by the time
// this runs the panel is already on its way to `MENTOR_URL/?embed=…` — a
// document that gets thrown away moments later, unauthenticated, having painted
// its own loading screen. Rewriting in the same task replaces that navigation
// instead of letting it finish; waiting for the first 250ms tick did not.
export function watchAndInstallSession(
  host: Element,
  intervalMs = 250,
  maxAttempts = 120,
): () => void {
  if (installSession(host)) return () => {};
  let attempts = 0;
  const timer = setInterval(() => {
    if (installSession(host) || ++attempts >= maxAttempts) clearInterval(timer);
  }, intervalMs);
  return () => clearInterval(timer);
}

/**
 * Drop the widget's own spinner, leaving the mentor app's loading screen as the
 * only one.
 *
 * `<agent-ai>` renders `#loading-spinner` in its shadow root as a POSITIONED
 * sibling of the iframe, so it paints on top of whatever the iframe is showing
 * — and the iframe is showing the app's `#initial-loader` from the first byte of
 * every navigation. Two spinners, and the widget's one lands 20px down-right of
 * centre because its `animation: spin` keyframes overwrite the
 * `transform: translate(-50%, -50%)` that was centring it.
 *
 * Removed rather than hidden: the widget hides it from an `iframe.onload`
 * handler attached inside an async `connectedCallback`, which loses the race
 * against our own src rewrite. Every place it touches the node is `el && (…)`
 * guarded, so a missing one is a no-op there.
 */
export function removeWidgetSpinner(host: Element): void {
  host.shadowRoot?.querySelector('#loading-spinner')?.remove();
}

// ---- Page context: feed the ACTIVE TAB's content to the mentor iframe --------
// The side panel runs in its own document, so <agent-ai> can only see panel.html
// (that's why `iscontextaware` is left OFF — it would otherwise flood the mentor
// with the panel's own DOM every second). Instead we read the browsed tab with
// chrome.scripting and post the mentor's own MENTOR:CONTEXT_UPDATE message
// straight into its (open) shadow-DOM iframe.

const UNSCRIPTABLE =
  /^(chrome|edge|about|chrome-extension|view-source|devtools):/;

export async function readActiveTab(): Promise<PageContent | null> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  // Can't script the browser's own pages, the web store, or extension pages.
  if (!tab?.id || !tab.url || UNSCRIPTABLE.test(tab.url)) return null;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });
    return (injection?.result as PageContent | undefined) ?? null;
  } catch (err) {
    console.warn('[ibl.ai panel] cannot read tab content:', err);
    return null;
  }
}

export function startContextFeed(host: Element, intervalMs = 5000): () => void {
  let latest: PageContent | null = null;

  const push = () => {
    const iframe = mentorIframe(host);
    if (!iframe?.contentWindow || !latest) return;
    iframe.contentWindow.postMessage(
      {
        type: 'MENTOR:CONTEXT_UPDATE',
        hostInfo: { title: latest.title, href: latest.href },
        pageContent: latest.text,
      },
      '*',
    );
  };
  const refresh = async () => {
    const content = await readActiveTab();
    if (content) {
      latest = content;
      push();
    }
  };

  // Refresh as the user switches tabs or a page finishes loading, plus a periodic
  // re-read to catch in-page (SPA) navigations — mirrors the SDK's own cadence.
  const onActivated = () => void refresh();
  const onUpdated = (
    _tabId: number,
    info: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ) => {
    if (info.status === 'complete' && tab.active) void refresh();
  };
  // The mentor app posts `{ loaded: true }` to this window when ready; (re)push
  // the current context immediately so it lands as soon as the chat is up.
  const onMessage = (event: MessageEvent) => {
    if ((event.data as { loaded?: boolean } | null)?.loaded) push();
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  window.addEventListener('message', onMessage);
  const timer = setInterval(() => void refresh(), intervalMs);
  void refresh();

  return () => {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    window.removeEventListener('message', onMessage);
    clearInterval(timer);
  };
}
