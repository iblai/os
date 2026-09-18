// Host-side authentication for the side panel (ported from the original panel.js).
//
// <agent-ai authrelyonhost> reads `axd_token` / `axd_token_expires` from THIS
// page's localStorage and forwards them to the mentor iframe (no in-iframe auth
// redirect — browsers block it in extension side panels via storage
// partitioning). The tokens come from chrome.identity.launchWebAuthFlow, and
// the Browse tab reuses the same `dm_token` for the platform's API.

export const AUTH_URL = 'https://login.iblai.app';

const SESSION_KEYS = [
  'axd_token',
  'axd_token_expires',
  'dm_token',
  'dm_token_expires',
  'edx_jwt_token',
  'userData',
  'tenant',
  'consented_to_data_collection',
];

export function isAuthed(): boolean {
  return Boolean(localStorage.getItem('axd_token'));
}

// Extract ibl's session payload (a JSON `data` param — the same shape the web
// app's /mobile-sso-login consumes) and store its keys in localStorage.
export function storeSessionFromRedirect(responseUrl: string): void {
  const url = new URL(responseUrl);
  const data =
    url.searchParams.get('data') ||
    new URLSearchParams(url.hash.replace(/^#/, '')).get('data');
  if (!data) {
    throw new Error(`no "data" param in auth redirect: ${responseUrl}`);
  }
  const session = JSON.parse(data) as Record<string, unknown>;
  Object.entries(session).forEach(([key, value]) =>
    localStorage.setItem(key, String(value)),
  );
}

export async function signIn(): Promise<void> {
  // Chrome intercepts navigations to this URL and hands the full URL back to us.
  const redirectUri = chrome.identity.getRedirectURL(); // https://<id>.chromiumapp.org/
  const authUrl = `${AUTH_URL}/login?redirect-to=${encodeURIComponent(redirectUri)}`;
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!responseUrl) throw new Error('auth flow returned no redirect URL');
  storeSessionFromRedirect(responseUrl);
}

/** True when a session exists afterwards; a failed flow throws. */
export async function ensureSignedIn(): Promise<boolean> {
  if (isAuthed()) return true;
  await signIn();
  return isAuthed();
}

export function clearSession(): void {
  for (const key of [...SESSION_KEYS, 'current_tenant', 'tenants']) {
    localStorage.removeItem(key);
  }
}

// Reassemble the `data` payload /sso-login-complete expects. Mirrors the web
// login's direct redirect: tokens + userData + current_tenant {key} only. The
// full `tenants` array is DELIBERATELY omitted — it's large enough to overflow
// the request line (HTTP 431), and the app re-fetches it after auth anyway.
export function sessionData(): Record<string, string> {
  const session: Record<string, string> = {};
  for (const key of SESSION_KEYS) {
    const value = localStorage.getItem(key);
    if (value != null) session[key] = value;
  }
  // Only the current platform's key (crop off the rest of the object).
  const currentTenant = localStorage.getItem('current_tenant');
  if (currentTenant) {
    try {
      session.current_tenant = JSON.stringify({
        key: (JSON.parse(currentTenant) as { key: string }).key,
      });
    } catch {
      session.current_tenant = currentTenant;
    }
  }
  return session;
}

export function dmToken(): string | null {
  return localStorage.getItem('dm_token');
}

/** The platform key the session is bound to (`tenant` is the auth SPA's name for it). */
export function org(): string | null {
  return localStorage.getItem('tenant');
}

/** Same field the OS app reads as the username (`userData.user_nicename`). */
export function username(): string | null {
  const raw = localStorage.getItem('userData');
  if (!raw) return null;
  try {
    const nicename = (JSON.parse(raw) as { user_nicename?: unknown })
      .user_nicename;
    return typeof nicename === 'string' && nicename ? nicename : null;
  } catch {
    return null;
  }
}

/** True only when `dm_token_expires` parses as a date that has passed. */
export function tokenExpired(now = Date.now()): boolean {
  const raw = localStorage.getItem('dm_token_expires');
  if (!raw) return false;
  const expires = Date.parse(raw);
  return Number.isFinite(expires) && expires <= now;
}

/**
 * Everything a run needs, or null when the session cannot serve one. Lives here
 * rather than in a component because the service worker has no localStorage —
 * the panel reads the session and hands it over the port.
 */
export function credentials(): {
  dmToken: string;
  org: string;
  username: string;
} | null {
  const token = dmToken();
  const platform = org();
  const user = username();
  if (!token || !platform || !user || tokenExpired()) return null;
  return { dmToken: token, org: platform, username: user };
}
