import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSession,
  dmToken,
  ensureSignedIn,
  isAuthed,
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
