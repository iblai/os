/**
 * Decide the post-SSO redirect path for `/sso-login-complete`.
 *
 * Precedence: the path SsoLogin resolved from localStorage (`redirect-to`) wins
 * by default — that's where tenant-switch / login flows stash the real return
 * path (e.g. the mentor the user was on). An explicit same-origin
 * `?redirect-path=` on the URL only overrides it when it carries embed context
 * (`embed=true`): the Chrome side-panel routes its partitioned mentor iframe
 * through this page to install the session, and a prior failed-auth cycle can
 * leave a stale `redirect-to` in that iframe's storage that would otherwise win
 * and drop the panel's embed params (embed / mode / component /
 * extra-body-classes). Normal flows pass `redirect-path=/` (no embed marker), so
 * the resolved localStorage path is preserved.
 *
 * Security: SsoLogin navigates to `location.origin + redirectPath`, so an
 * unvalidated explicit value like `@evil.com` or `//evil.com` would be an open
 * redirect — only honor a single leading slash with no protocol-relative `//`
 * or `/\` authority.
 *
 * Finally, if the chosen path targets a `/platform/<key>` that doesn't match the
 * authenticated tenant, reset to the default `/`.
 *
 * @param resolvedPath  the path SsoLogin resolved (from localStorage `redirect-to`)
 * @param parsedData    the SSO payload (its `tenant` is the authenticated tenant)
 * @param search        `window.location.search` (passed in to keep this pure)
 */
export function resolveSsoRedirectPath(
  resolvedPath: string,
  parsedData: Record<string, string>,
  search: string,
): string {
  let redirectPath = resolvedPath;

  const explicit = new URLSearchParams(search).get('redirect-path');
  if (
    explicit &&
    /^\/(?![/\\])/.test(explicit) && // same-origin, no open redirect
    /[?&]embed=true(?:&|$)/.test(explicit) // extension/embed only
  ) {
    redirectPath = explicit;
  }

  // A path scoped to a different tenant than the one just authenticated is
  // stale/cross-tenant — fall back to the default.
  const platformKeyMatch = redirectPath.match(/^\/platform\/([^/]+)/);
  if (platformKeyMatch) {
    const pathPlatformKey = platformKeyMatch[1];
    const authenticatedTenant = parsedData.tenant;
    if (authenticatedTenant && pathPlatformKey !== authenticatedTenant) {
      redirectPath = '/';
    }
  }

  return redirectPath;
}
