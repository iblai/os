import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  dmToken,
  ensureSignedIn,
  isAuthed,
  isSessionExpired,
  org,
  sessionData,
  signIn,
  storeSessionFromRedirect,
  tokenExpired,
  username,
} from '../auth';
import {
  SESSION,
  installChromeStub,
  sessionRedirect,
  type ChromeStub,
} from './chrome.stub';

let chromeStub: ChromeStub;

beforeEach(() => {
  localStorage.clear();
  chromeStub = installChromeStub();
});

describe('storeSessionFromRedirect', () => {
  it('reads the data param from the query string', () => {
    storeSessionFromRedirect(
      sessionRedirect({ axd_token: 'a', tenant: 'acme' }),
    );
    expect(localStorage.getItem('axd_token')).toBe('a');
    expect(localStorage.getItem('tenant')).toBe('acme');
  });

  it('reads the data param from the hash', () => {
    const data = encodeURIComponent(JSON.stringify({ dm_token: 'd', n: 1 }));
    storeSessionFromRedirect(`https://abc.chromiumapp.org/#data=${data}`);
    expect(localStorage.getItem('dm_token')).toBe('d');
    expect(localStorage.getItem('n')).toBe('1');
  });

  it('throws when the redirect carries no data', () => {
    expect(() =>
      storeSessionFromRedirect('https://abc.chromiumapp.org/?x=1'),
    ).toThrow(/no "data" param/);
  });
});

describe('signIn / ensureSignedIn', () => {
  it('runs the web auth flow against the auth SPA and stores the session', async () => {
    expect(isAuthed()).toBe(false);
    await expect(ensureSignedIn()).resolves.toBe(true);
    const [{ url, interactive }] = chromeStub.stub.identity.launchWebAuthFlow
      .mock.calls[0] as unknown as [{ url: string; interactive: boolean }];
    expect(url).toBe(
      'https://login.iblai.app/login?redirect-to=https%3A%2F%2Fabc.chromiumapp.org%2F',
    );
    expect(interactive).toBe(true);
    expect(isAuthed()).toBe(true);
    expect(dmToken()).toBe('dm');
  });

  it('switches tenants via /login/complete with the target tenant and edX JWT', async () => {
    // The switch mirrors the web tenant switch: the edX JWT authorises minting
    // the new tenant's tokens through the token-exchange endpoint.
    localStorage.setItem('edx_jwt_token', 'jwt123');
    await signIn('beta');
    const [{ url }] = chromeStub.stub.identity.launchWebAuthFlow.mock
      .calls[0] as unknown as [{ url: string }];
    expect(url).toBe(
      'https://login.iblai.app/login/complete?tenant=beta&redirect-to=https%3A%2F%2Fabc.chromiumapp.org%2F&token=jwt123',
    );
    expect(isAuthed()).toBe(true);
  });

  it('omits the token param on switch when no edX JWT is stored', async () => {
    await signIn('beta');
    const [{ url }] = chromeStub.stub.identity.launchWebAuthFlow.mock
      .calls[0] as unknown as [{ url: string }];
    expect(url).toBe(
      'https://login.iblai.app/login/complete?tenant=beta&redirect-to=https%3A%2F%2Fabc.chromiumapp.org%2F',
    );
  });

  it('is a no-op when a session exists', async () => {
    localStorage.setItem('axd_token', 'x');
    await expect(ensureSignedIn()).resolves.toBe(true);
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it('throws when the flow returns nothing', async () => {
    chromeStub.stub.identity.launchWebAuthFlow.mockResolvedValueOnce(
      undefined as never,
    );
    await expect(signIn()).rejects.toThrow(/no redirect URL/);
  });
});

describe('an expired session', () => {
  // The regression: the panel held tokens that had expired two days earlier.
  // `isAuthed` only checked that `axd_token` was a string, so the panel called
  // itself signed in, installed the dead session into the mentor iframe, and
  // sat there while the embed 401'd and asked for auth nobody minted.
  it('does not count as signed in', () => {
    localStorage.setItem('axd_token', 'axd');
    localStorage.setItem('axd_token_expires', '2026-11-03T18:13:55.050Z');
    expect(isSessionExpired()).toBe(true);
    expect(isAuthed()).toBe(false);
  });

  it('is re-minted by ensureSignedIn instead of being trusted', async () => {
    localStorage.setItem('axd_token', 'stale');
    localStorage.setItem('axd_token_expires', '2026-11-03T18:13:55.050Z');

    await expect(ensureSignedIn()).resolves.toBe(true);

    expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('axd_token')).toBe(SESSION.axd_token);
  });

  // Payloads carry only the keys they have. Writing over the old session left
  // an orphaned `axd_token_expires` behind, so the session we had just minted
  // read as already expired and the panel could never get back in.
  it('does not inherit the old expiry when the new payload has none', async () => {
    localStorage.setItem('axd_token', 'stale');
    localStorage.setItem('axd_token_expires', '2026-11-03T18:13:55.050Z');

    const { axd_token_expires: _dropped, ...withoutStamp } = SESSION;
    chromeStub.stub.identity.launchWebAuthFlow.mockResolvedValueOnce(
      sessionRedirect(withoutStamp) as never,
    );
    await signIn();

    expect(localStorage.getItem('axd_token_expires')).toBeNull();
    expect(isSessionExpired()).toBe(false);
    expect(isAuthed()).toBe(true);
  });

  it('counts a token expiring within the round-trip as already gone', () => {
    localStorage.setItem('axd_token', 'axd');
    const inTenSeconds = new Date(Date.now() + 10_000).toISOString();
    localStorage.setItem('axd_token_expires', inTenSeconds);
    expect(isSessionExpired()).toBe(true);
  });

  it('leaves a session with plenty of time alone', () => {
    localStorage.setItem('axd_token', 'axd');
    localStorage.setItem('axd_token_expires', SESSION.axd_token_expires);
    expect(isSessionExpired()).toBe(false);
    expect(isAuthed()).toBe(true);
  });

  it.each([
    ['no expiry recorded', null],
    ['an unparseable expiry', 'soon'],
  ])('trusts a session with %s', (_label, stamp) => {
    localStorage.setItem('axd_token', 'axd');
    if (stamp) localStorage.setItem('axd_token_expires', stamp);
    expect(isSessionExpired()).toBe(false);
    expect(isAuthed()).toBe(true);
  });
});

describe('session accessors', () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(SESSION))
      localStorage.setItem(key, value);
    localStorage.setItem('tenants', '[{"key":"acme"},{"key":"beta"}]');
  });

  it('builds the sso-login-complete payload with a cropped current platform and no tenants list', () => {
    const data = sessionData();
    expect(data).toMatchObject({
      axd_token: 'axd',
      dm_token: 'dm',
      tenant: 'acme',
    });
    expect(data.current_tenant).toBe('{"key":"acme"}');
    expect(data).not.toHaveProperty('tenants');
  });

  it('keeps a current platform value it cannot parse', () => {
    localStorage.setItem('current_tenant', 'not json');
    expect(sessionData().current_tenant).toBe('not json');
  });

  it('exposes the platform key, username and token', () => {
    expect(org()).toBe('acme');
    expect(username()).toBe('jane');
    expect(dmToken()).toBe('dm');
  });

  it('has no username when userData is missing, malformed or empty', () => {
    localStorage.setItem('userData', '{"user_nicename":""}');
    expect(username()).toBeNull();
    localStorage.setItem('userData', '{');
    expect(username()).toBeNull();
    localStorage.removeItem('userData');
    expect(username()).toBeNull();
  });

  it('reports expiry only for a parsable date in the past', () => {
    expect(tokenExpired()).toBe(false);
    localStorage.setItem('dm_token_expires', '2000-01-01T00:00:00Z');
    expect(tokenExpired()).toBe(true);
    localStorage.setItem('dm_token_expires', 'soon');
    expect(tokenExpired()).toBe(false);
    localStorage.removeItem('dm_token_expires');
    expect(tokenExpired()).toBe(false);
  });

  it('clears every session key', () => {
    clearSession();
    expect(isAuthed()).toBe(false);
    expect(localStorage.getItem('tenants')).toBeNull();
    expect(localStorage.getItem('current_tenant')).toBeNull();
  });
});
