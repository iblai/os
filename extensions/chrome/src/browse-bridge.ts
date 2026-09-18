// The seam between the mentor app in the iframe and the agent loop in the
// service worker. The app cannot reach chrome.* (it is an ordinary page on
// another origin) and the worker cannot reach localStorage, so the panel sits in
// the middle: it validates every frame, attaches the session, and relays.
import { BROWSE_PORT, type OutboundMessage } from './browse-protocol';
import { credentials } from './auth';
import { t } from './i18n';
import { mentorIframe } from './mentor-frame';

export const READY = 'MENTOR:BROWSE_READY';
export const EVENT = 'MENTOR:BROWSE_EVENT';

type FromApp =
  | { type: 'MENTOR:BROWSE_HELLO' }
  | { type: 'MENTOR:BROWSE_RUN'; goal: string; auto?: unknown }
  | { type: 'MENTOR:BROWSE_STOP' }
  | { type: 'MENTOR:BROWSE_CONFIRM'; id: number; ok: boolean };

const HANDLED = new Set<string>([
  'MENTOR:BROWSE_HELLO',
  'MENTOR:BROWSE_RUN',
  'MENTOR:BROWSE_STOP',
  'MENTOR:BROWSE_CONFIRM',
]);

function originOf(host: Element): string | null {
  try {
    return new URL(host.getAttribute('mentorurl') || '').origin;
  } catch {
    return null;
  }
}

/**
 * Wires the bridge for one `<agent-ai>` host. Returns a disposer.
 *
 * The port is opened lazily on the first run and kept for the panel's lifetime:
 * it is what holds the service worker alive, so opening it before there is
 * anything to do would just keep a worker warm for nothing.
 */
export function startBrowseBridge(host: Element): () => void {
  let port: chrome.runtime.Port | null = null;
  let disposed = false;

  const toApp = (payload: OutboundMessage | { type: string }) => {
    const iframe = mentorIframe(host);
    const origin = originOf(host);
    if (!iframe?.contentWindow || !origin) return;
    const type = 'type' in payload && payload.type === READY ? READY : EVENT;
    iframe.contentWindow.postMessage(
      type === READY ? { type: READY } : { type: EVENT, payload },
      origin,
    );
  };

  const connect = () => {
    if (port) return port;
    port = chrome.runtime.connect({ name: BROWSE_PORT });
    port.onMessage.addListener((outbound: OutboundMessage) => toApp(outbound));
    port.onDisconnect.addListener(() => {
      port = null;
      // Tearing the bridge down ourselves is not the worker dying, and the
      // iframe is going away with us.
      if (disposed) return;
      // A worker that dies mid-run cannot report it — the port it would report
      // over is what just went away. Without this the app waits forever.
      toApp({ type: 'error', message: t('errorWorkerGone') });
    });
    return port;
  };

  /**
   * The tab to drive, resolved HERE rather than in the worker. A worker has no
   * window of its own, so it can only ask for the last-focused one — and
   * undocked DevTools is a window, so debugging the extension made it pick
   * `devtools://`. The panel is in the browser window by construction.
   */
  const activeTab = async () => {
    const { id: windowId } = await chrome.windows.getCurrent();
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    return tab;
  };

  const startRun = async (goal: string, auto: boolean) => {
    const creds = credentials();
    if (!creds) {
      toApp({ type: 'error', message: t('errorAccess') });
      return;
    }
    const tab = await activeTab();
    if (!tab?.id) {
      toApp({ type: 'error', message: t('noActiveTab', tab?.url ?? '') });
      return;
    }
    // Credentials go DOWN to the worker only; they are never posted back into
    // the iframe.
    connect().postMessage({ type: 'run', goal, creds, tabId: tab.id, auto });
    toApp({ type: 'ack' });
  };

  const onMessage = (event: MessageEvent) => {
    const data = event.data as FromApp | null;
    if (!data || typeof data.type !== 'string' || !HANDLED.has(data.type))
      return;
    // Both checks matter: the origin alone would accept a same-origin popup the
    // page opened, and the source alone would accept a navigated-away iframe.
    const iframe = mentorIframe(host);
    if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;
    if (event.origin !== originOf(host)) return;

    switch (data.type) {
      case 'MENTOR:BROWSE_HELLO':
        toApp({ type: READY });
        break;
      case 'MENTOR:BROWSE_RUN':
        // `=== true` and not a cast: this arrives from the iframe, so the one
        // field that decides whether the user is asked before an action is
        // coerced here rather than trusted.
        void startRun(data.goal, data.auto === true);
        break;
      case 'MENTOR:BROWSE_STOP':
        port?.postMessage({ type: 'stop' });
        break;
      case 'MENTOR:BROWSE_CONFIRM':
        port?.postMessage({ type: 'confirm', id: data.id, ok: data.ok });
        break;
    }
  };

  window.addEventListener('message', onMessage);
  return () => {
    disposed = true;
    window.removeEventListener('message', onMessage);
    port?.disconnect();
    port = null;
  };
}
