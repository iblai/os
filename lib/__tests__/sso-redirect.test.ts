import { describe, it, expect } from 'vitest';

import { resolveSsoRedirectPath } from '../sso-redirect';

// Build a `?redirect-path=<value>` search string with the value encoded the way
// the auth SPA / side-panel put it on the URL.
const search = (redirectPath: string) =>
  `?redirect-path=${encodeURIComponent(redirectPath)}&data=%7B%7D`;

describe('resolveSsoRedirectPath', () => {
  it('prefers the localStorage-resolved path over a plain ?redirect-path=/ (the regression)', () => {
    // Tenant-switch flow: SsoLogin resolved the real mentor path from
    // localStorage; the URL only carries the default redirect-path=/.
    expect(
      resolveSsoRedirectPath(
        '/platform/acme/m1',
        { tenant: 'acme' },
        search('/'),
      ),
    ).toBe('/platform/acme/m1');
  });

  it('lets an explicit same-origin path override ONLY when it carries embed=true', () => {
    const embedPath = '/platform/acme/m1?embed=true&mode=chat&component=chat';
    expect(
      resolveSsoRedirectPath('/', { tenant: 'acme' }, search(embedPath)),
    ).toBe(embedPath);
  });

  it('does NOT override with an explicit path that lacks embed=true', () => {
    expect(
      resolveSsoRedirectPath(
        '/platform/acme/m1',
        { tenant: 'acme' },
        search('/somewhere-else'),
      ),
    ).toBe('/platform/acme/m1');
  });

  it('rejects an open-redirect explicit value even with embed=true', () => {
    for (const evil of ['//evil.com?embed=true', '/\\evil.com?embed=true']) {
      expect(
        resolveSsoRedirectPath(
          '/platform/acme/m1',
          { tenant: 'acme' },
          search(evil),
        ),
      ).toBe('/platform/acme/m1');
    }
  });

  it('resets a cross-tenant /platform path to the default', () => {
    expect(
      resolveSsoRedirectPath('/platform/other/m1', { tenant: 'acme' }, ''),
    ).toBe('/');
  });

  it('keeps a /platform path that matches the authenticated tenant', () => {
    expect(
      resolveSsoRedirectPath('/platform/acme/m1', { tenant: 'acme' }, ''),
    ).toBe('/platform/acme/m1');
  });
});
