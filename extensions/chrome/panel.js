// Host-side authentication for the ibl.ai side-panel agent.
//
// <agent-ai authrelyonhost> reads `axd_token` / `axd_token_expires` from THIS
// page's localStorage and forwards them to the mentor iframe (no in-iframe auth
// redirect — which browsers block in extension side panels via storage
// partitioning). We obtain those tokens here with chrome.identity.launchWebAuthFlow.
//
// Must be an external script: MV3's `script-src 'self'` forbids inline scripts.

const AUTH_URL = 'https://login.iblai.app';

function isAuthed() {
  return Boolean(localStorage.getItem('axd_token'));
}

// Extract ibl's session payload (a JSON `data` param — the same shape the web
// app's /mobile-sso-login consumes) and store its keys in localStorage.
function storeSessionFromRedirect(responseUrl) {
  const u = new URL(responseUrl);
  const data =
    u.searchParams.get('data') ||
    new URLSearchParams(u.hash.replace(/^#/, '')).get('data');
  if (!data) {
    throw new Error(`no "data" param in auth redirect: ${responseUrl}`);
  }
  const session = JSON.parse(data);
  Object.entries(session).forEach(([key, value]) =>
    localStorage.setItem(key, String(value)),
  );
}

async function authenticate() {
  // Chrome intercepts navigations to this URL and hands the full URL back to us.
  const redirectUri = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
  const authUrl =
    `${AUTH_URL}/login` + `?redirect-to=${encodeURIComponent(redirectUri)}`;

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!responseUrl) throw new Error('auth flow returned no redirect URL');
  storeSessionFromRedirect(responseUrl);
}

(async () => {
  if (isAuthed()) return; // <agent-ai authrelyonhost> reads the stored token
  try {
    await authenticate();
    // Re-init <agent-ai> now that the token is in localStorage.
    location.reload();
  } catch (err) {
    console.error('[ibl.ai panel] sign-in failed:', err);
  }
})();

// ---- Install the session INTO the mentor iframe ------------------------------
// `<agent-ai authrelyonhost>` forwards our tokens to the iframe via postMessage,
// but that hand-off doesn't survive the side panel's storage-partitioned iframe:
// the mentor app boots, reads its own EMPTY localStorage, and logs itself out
// before the posted tokens land (see the `authExpired` loop in the console).
// Instead we point the iframe at the mentor app's `/sso-login-complete`, which
// INSTALLS the session into (partitioned) storage on load and then redirects to
// the chat — the same deterministic path the normal web login uses.

// Reassemble the `data` payload /sso-login-complete expects from the keys
// panel.js stored after launchWebAuthFlow. Mirrors the web login's direct
// redirect: tokens + userData + current_tenant {key} only. The full `tenants`
// array is DELIBERATELY omitted — it's large enough to overflow the request
// line (HTTP 431), and the app re-fetches it after auth anyway.
function iblSessionData() {
  const session = {};
  for (const key of [
    'axd_token',
    'axd_token_expires',
    'dm_token',
    'dm_token_expires',
    'edx_jwt_token',
    'userData',
    'tenant',
    'consented_to_data_collection',
  ]) {
    const value = localStorage.getItem(key);
    if (value != null) session[key] = value;
  }
  // Only the current tenant's key (crop off the rest of the object).
  const currentTenant = localStorage.getItem('current_tenant');
  if (currentTenant) {
    try {
      session.current_tenant = JSON.stringify({
        key: JSON.parse(currentTenant).key,
      });
    } catch {
      session.current_tenant = currentTenant;
    }
  }
  return session;
}

let authInstalledIntoIframe = false;
function installAuthIntoIframe() {
  if (authInstalledIntoIframe || !isAuthed()) return;
  const agent = document.querySelector('agent-ai');
  const mentorUrl = (agent?.getAttribute('mentorurl') || '').replace(
    /\/+$/,
    '',
  );
  const iframe = mentorIframe();
  const src = iframe?.getAttribute('src');
  if (!mentorUrl || !src) return; // widget iframe not mounted yet
  if (src.includes('/sso-login-complete')) {
    authInstalledIntoIframe = true; // already routed through the installer
    return;
  }
  if (!src.startsWith(mentorUrl)) return; // only rewrite the mentor iframe

  authInstalledIntoIframe = true;
  // Make sure the media features are delegated to the iframe (belt-and-braces —
  // in case the component's `allow` didn't apply). Must be set before the
  // navigation below so it applies to the loaded document.
  iframe.setAttribute('allow', 'microphone; camera; display-capture; autoplay');
  console.log('[ibl.ai panel] iframe allow =', iframe.getAttribute('allow'));
  // Return to the EXACT chat URL the component asked for — keep all of its embed
  // params (embed / mode / component / extra-body-classes) untouched so the
  // mentor app renders the same embedded chat view it intended.
  //
  // The param MUST be `redirect-path`: SsoLogin reads the incoming target from
  // `searchParams.get('redirect-path')` (the `redirect-to` name only addresses
  // the localStorage fallback key, never the URL). Passing `redirect-to` here
  // was silently ignored, so the login fell through to defaultRedirectPath '/'
  // and dropped the embed params.
  const original = new URL(src);
  const redirectPath = original.pathname + original.search;
  const session = iblSessionData();
  iframe.src =
    `${mentorUrl}/sso-login-complete` +
    `?data=${encodeURIComponent(JSON.stringify(session))}` +
    `&redirect-path=${encodeURIComponent(redirectPath)}` +
    (session.tenant ? `&tenant=${encodeURIComponent(session.tenant)}` : '');
  console.log(
    '[ibl.ai panel] installed session into mentor iframe via /sso-login-complete',
  );
}

// The component mounts its iframe asynchronously; poll until it appears, then
// rewrite it once.
const authInstallTimer = setInterval(() => {
  installAuthIntoIframe();
  if (authInstalledIntoIframe) clearInterval(authInstallTimer);
}, 250);

// ---- Page context: feed the ACTIVE TAB's content to the mentor iframe --------
// The side panel runs in its own document, so <agent-ai> can only see panel.html
// (that's why `iscontextaware` is left OFF — it would otherwise flood the mentor
// with the panel's own DOM every second). Instead we read the browsed tab with
// chrome.scripting and post the mentor's own MENTOR:CONTEXT_UPDATE message
// straight into its (open) shadow-DOM iframe.

// Runs in the target tab's context.
function extractPageContent() {
  const text = document.body ? document.body.innerText : '';
  return {
    title: document.title,
    href: location.href,
    text: text.slice(0, 100000),
  };
}

async function readActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  // Can't script the browser's own pages, the web store, or extension pages.
  if (
    !tab?.id ||
    !tab.url ||
    /^(chrome|edge|about|chrome-extension|view-source|devtools):/.test(tab.url)
  ) {
    return null;
  }
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });
    return injection?.result ?? null;
  } catch (err) {
    console.warn('[ibl.ai panel] cannot read tab content:', err);
    return null;
  }
}

function mentorIframe() {
  return document
    .querySelector('agent-ai')
    ?.shadowRoot?.querySelector('#ibl-chat-widget-container iframe');
}

let latestContext = null;

function pushContext() {
  const iframe = mentorIframe();
  if (!iframe?.contentWindow || !latestContext) return;
  iframe.contentWindow.postMessage(
    {
      type: 'MENTOR:CONTEXT_UPDATE',
      hostInfo: { title: latestContext.title, href: latestContext.href },
      pageContent: latestContext.text,
    },
    '*',
  );
}

async function refreshContext() {
  const content = await readActiveTab();
  if (content) {
    latestContext = content;
    pushContext();
  }
}

// Refresh as the user switches tabs or a page finishes loading, plus a periodic
// re-read to catch in-page (SPA) navigations — mirrors the SDK's own cadence.
chrome.tabs.onActivated.addListener(() => refreshContext());
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (info.status === 'complete' && tab.active) refreshContext();
});
setInterval(refreshContext, 5000);

// The mentor iframe posts a `loaded` signal to this window when ready; (re)push
// the current context immediately so it lands as soon as the chat is up.
window.addEventListener('message', (event) => {
  if (event.data?.loaded || event.data?.type === 'MENTOR:READY') pushContext();
});

refreshContext();
