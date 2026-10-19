/**
 * App-local, RSC-safe mirror of the SDK's per-tab `authStorage` policy.
 *
 * The SDK exposes `getAuthItem`/`setAuthItem`/… only from the
 * `@iblai/iblai-js/web-utils` barrel, which transitively runs a top-level
 * `React.createContext` (via `@iblai/web-utils`). Importing that barrel from a
 * server-reachable module (e.g. `lib/utils.ts`, whose `cn` is used by RSC
 * components) crashes the server bundle with
 * "createContext is not a function". There is no RSC-safe SDK subpath for these
 * functions, so the app reads/writes auth storage through this dependency-free
 * module instead.
 *
 * Behavior matches the SDK exactly:
 *  - flag OFF (default) → plain `localStorage` passthrough (byte-identical to
 *    the pre-per-tab behavior);
 *  - flag ON → `sessionStorage` is this tab's source of truth and
 *    `localStorage` keeps the most-recent-login seed. Reads are session-first
 *    with a seed fallback; writes go to both; auth keys only — everything else
 *    always passes through to `localStorage`.
 *
 * Keep in lockstep with `packages/web-utils/src/utils/auth-storage.ts` in the
 * SDK (the AuthProvider/TenantProvider read tokens through the SDK copy).
 */

/** The mirrored auth keys. Non-auth keys always pass through to localStorage. */
export const PER_TAB_AUTH_KEYS = [
  'axd_token',
  'axd_token_expires',
  'dm_token',
  'dm_token_expires',
  'edx_jwt_token',
  'userData',
  'current_tenant',
  'tenant',
  'tenants',
  'visiting_tenant',
] as const;

const AUTH_KEY_SET = new Set<string>(PER_TAB_AUTH_KEYS);

export function isAuthKey(key: string): boolean {
  return AUTH_KEY_SET.has(key);
}

export function isPerTabAuthEnabled(): boolean {
  // Runtime __ENV__ wins, then the build-time inlined value.
  const runtime = (globalThis as { __ENV__?: Record<string, unknown> }).__ENV__
    ?.NEXT_PUBLIC_IBL_PER_TAB_AUTH;
  const value = runtime ?? process.env.NEXT_PUBLIC_IBL_PER_TAB_AUTH;
  return value === true || value === 'true';
}

/**
 * Read a key from a Web Storage area, tolerating environments where the area is
 * missing or not a functional `Storage` (SSR, and tests that install a partial
 * `localStorage` stub without `getItem`) by returning null. A `getItem` that
 * exists but throws (e.g. disabled storage) is left to propagate so callers
 * like `useLocalStorage` can apply their own fallback + warning.
 */
function readStorage(storage: Storage | undefined, key: string): string | null {
  return typeof storage?.getItem === 'function' ? storage.getItem(key) : null;
}

export function getAuthItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  if (!isPerTabAuthEnabled() || !isAuthKey(key)) {
    return readStorage(window.localStorage, key);
  }
  const sessionValue = readStorage(window.sessionStorage, key);
  return sessionValue !== null
    ? sessionValue
    : readStorage(window.localStorage, key);
}

export function setAuthItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  if (!isPerTabAuthEnabled() || !isAuthKey(key)) {
    window.localStorage.setItem(key, value);
    return;
  }
  // sessionStorage = this tab's source of truth; localStorage = most-recent seed.
  window.sessionStorage.setItem(key, value);
  window.localStorage.setItem(key, value);
}

export function removeAuthItem(key: string): void {
  if (typeof window === 'undefined') return;
  if (!isPerTabAuthEnabled() || !isAuthKey(key)) {
    window.localStorage.removeItem(key);
    return;
  }
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

/**
 * Clear this tab's auth session (sessionStorage). When `clearSeedIfTenant` is
 * given and the localStorage seed's tenant matches it, also clear the seed —
 * so a sibling tab holding a different tenant keeps its most-recent-login seed.
 */
export function clearPerTabSession(opts?: {
  clearSeedIfTenant?: string;
}): void {
  if (typeof window === 'undefined') return;
  for (const key of PER_TAB_AUTH_KEYS) {
    window.sessionStorage.removeItem(key);
  }
  const clearSeedIfTenant = opts?.clearSeedIfTenant;
  if (
    clearSeedIfTenant &&
    window.localStorage.getItem('tenant') === clearSeedIfTenant
  ) {
    for (const key of PER_TAB_AUTH_KEYS) {
      window.localStorage.removeItem(key);
    }
  }
}

/**
 * The auth snapshot to hand to a host/parent frame (e.g. the embed
 * `sendMessageToParentWebsite({ auth })` handoff): the full localStorage view
 * with the per-tab auth keys overlaid from THIS tab's session, so the host
 * tracks the active tab's session rather than whichever tab logged in last (the
 * shared seed). A no-op overlay when per-tab is off — identical to
 * `{ ...localStorage }`.
 */
export function getPerTabAuthSnapshot(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const snapshot: Record<string, string> = { ...window.localStorage };
  for (const key of PER_TAB_AUTH_KEYS) {
    const value = getAuthItem(key);
    if (value === null) delete snapshot[key];
    else snapshot[key] = value;
  }
  return snapshot;
}
