import { config } from '@/lib/config';
import { getAuthItem } from '@/lib/auth-storage';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

/**
 * Where to send someone whose app tokens have expired.
 *
 * The auth app's `/login/complete` IS the refresh endpoint: given the edX JWT
 * and a tenant it mints a fresh axd/dm pair through the consolidated-token
 * proxy and hands them back at `/sso-login-complete` with the rest of the
 * session. It does not clear anything, so this is a refresh, not a logout —
 * the user keeps their session and lands back where they were.
 *
 * When the JWT is itself expired the mint 401s, and the auth app falls through
 * to `/login?logout=1` carrying the same return address: the user signs in
 * again and still ends up back here.
 */
export function tokenRefreshUrl(
  returnPath = `${window.location.pathname}${window.location.search}`,
): string {
  // Trimmed with a loop, not /\/+$/: that pattern backtracks quadratically on
  // a long run of slashes (CodeQL js/polynomial-redos).
  let base = config.authUrl();
  while (base.endsWith('/')) base = base.slice(0, -1);

  const params = new URLSearchParams({
    'redirect-to': window.location.origin,
    'redirect-path': returnPath,
  });

  // The tenant to mint for. `current_tenant` is the active one; `tenant` is
  // only the default slug, so it is the fallback rather than the first choice.
  const currentTenant = getAuthItem(LOCAL_STORAGE_KEYS.CURRENT_TENANT);
  let tenantKey = '';
  if (currentTenant) {
    try {
      tenantKey = (JSON.parse(currentTenant) as { key?: string })?.key ?? '';
    } catch {
      tenantKey = currentTenant;
    }
  }
  tenantKey ||= getAuthItem(LOCAL_STORAGE_KEYS.DEFAULT_TENANT) ?? '';
  if (tenantKey) params.set('tenant', tenantKey);

  // Authorises the mint. Without it the auth app cannot tell who this is and
  // sends the user through a full sign-in, which still returns them here.
  const jwt = getAuthItem(LOCAL_STORAGE_KEYS.EDX_TOKEN_KEY);
  if (jwt) params.set('token', jwt);

  return `${base}/login/complete?${params}`;
}
