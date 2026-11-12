import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    authUrl: () => 'https://auth.ibl.ai/',
    // lib/constants builds MODEL_AGENTS from this at import time.
    iblTemplateMentor: () => 'default-mentor',
  },
}));

import { tokenRefreshUrl } from '../token-refresh';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    value: new URL('https://os.ibl.ai/platform/acme/bot?embed=true'),
    writable: true,
  });
});

describe('tokenRefreshUrl', () => {
  it('asks the auth app to re-mint for the active organization', () => {
    localStorage.setItem('current_tenant', JSON.stringify({ key: 'acme' }));

    const url = new URL(tokenRefreshUrl());

    // /login/complete mints through the consolidated-token proxy and returns
    // the session — it never clears one, so this is a refresh, not a logout.
    expect(url.pathname).toBe('/login/complete');
    expect(url.searchParams.get('tenant')).toBe('acme');
  });

  // The edX JWT stays in this app. The auth app authorises the mint with its
  // own first-party session (`credentials: 'include'`), so forwarding ours
  // would put the JWT in a URL for nothing.
  it('never forwards the edX JWT, even when one is stored', () => {
    localStorage.setItem('edx_jwt_token', 'jwt-123');

    const url = new URL(tokenRefreshUrl());

    expect(url.searchParams.get('token')).toBeNull();
    expect(url.search).not.toContain('jwt-123');
  });

  it('comes back to the page the user was on', () => {
    const url = new URL(tokenRefreshUrl());

    expect(url.searchParams.get('redirect-to')).toBe('https://os.ibl.ai');
    expect(url.searchParams.get('redirect-path')).toBe(
      '/platform/acme/bot?embed=true',
    );
  });

  it('falls back to the default tenant slug when there is no active one', () => {
    localStorage.setItem('tenant', 'beta');

    expect(new URL(tokenRefreshUrl()).searchParams.get('tenant')).toBe('beta');
  });

  it('reads a current_tenant stored as a bare slug', () => {
    localStorage.setItem('current_tenant', 'gamma');

    expect(new URL(tokenRefreshUrl()).searchParams.get('tenant')).toBe('gamma');
  });

  it('goes whether or not this app holds a session', () => {
    expect(new URL(tokenRefreshUrl()).pathname).toBe('/login/complete');
  });

  it('does not double the slash after a trailing-slash auth URL', () => {
    expect(tokenRefreshUrl()).toContain('https://auth.ibl.ai/login/complete?');
  });
});
