import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  embedRedirectPath,
  installSession,
  mentorIframe,
  readActiveTab,
  refreshHostAuthCache,
  removeWidgetSpinner,
  startContextFeed,
  watchAndInstallSession,
  watchAuthExpired,
  watchTenantSwitch,
} from '../mentor-frame';
import {
  SESSION,
  installChromeStub,
  sessionRedirect,
  type ChromeStub,
} from './chrome.stub';

let chromeStub: ChromeStub;

function makeHost(src = 'https://os.ibl.ai/chat?embed=true&mode=anonymous') {
  const host = document.createElement('agent-ai');
  host.setAttribute('mentorurl', 'https://os.ibl.ai/');
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  container.id = 'ibl-chat-widget-container';
  // The widget's own spinner, rendered in its constructor before the iframe.
  const spinner = document.createElement('div');
  spinner.id = 'loading-spinner';
  container.append(spinner);
  // The widget's "Your session has expired" notice, shown by its own
  // showRefreshInstruction() — which also hides the iframe and never undoes it.
  const notice = document.createElement('div');
  notice.id = 'refresh-instruction';
  shadow.append(notice);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('src', src);
  // jsdom gives an iframe inside a shadow root no browsing context.
  const postMessage = vi.fn();
  Object.defineProperty(iframe, 'contentWindow', { value: { postMessage } });
  container.append(iframe);
  shadow.append(container);
  document.body.append(host);
  return { host, iframe, postMessage };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  chromeStub = installChromeStub();
  for (const [key, value] of Object.entries(SESSION))
    localStorage.setItem(key, value);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('installSession', () => {
  it('routes the mentor iframe through sso-login-complete once, keeping the embed params', () => {
    const { host, iframe } = makeHost();
    expect(installSession(host)).toBe(true);
    const url = new URL(iframe.src);
    expect(url.origin + url.pathname).toBe(
      'https://os.ibl.ai/sso-login-complete',
    );
    expect(url.searchParams.get('redirect-path')).toBe(
      '/chat?embed=true&mode=anonymous',
    );
    expect(url.searchParams.get('tenant')).toBe('acme');
    expect(JSON.parse(url.searchParams.get('data')!)).toMatchObject({
      dm_token: 'dm',
      current_tenant: '{"key":"acme"}',
    });
    const once = iframe.src;
    expect(installSession(host)).toBe(true);
    expect(iframe.src).toBe(once);
  });

  it('does nothing without a session, an iframe, a mentor url or a foreign frame', () => {
    const { host, iframe } = makeHost('https://elsewhere.example/');
    expect(installSession(host)).toBe(false);
    expect(iframe.src).toBe('https://elsewhere.example/');
    const bare = document.createElement('agent-ai');
    expect(mentorIframe(bare)).toBeNull();
    expect(installSession(bare)).toBe(false);
    host.removeAttribute('mentorurl');
    expect(installSession(host)).toBe(false);
    localStorage.clear();
    expect(installSession(makeHost().host)).toBe(false);
  });
});

describe('installSession with an explicit redirect path (tenant switch)', () => {
  it('re-routes to sso-login-complete with the given path, even from a chat URL', () => {
    const { host, iframe } = makeHost(
      'https://os.ibl.ai/platform/acme/bot?embed=true&mode=anonymous',
    );
    expect(installSession(host, '/?embed=true&mode=anonymous')).toBe(true);
    const url = new URL(iframe.src);
    expect(url.pathname).toBe('/sso-login-complete');
    expect(url.searchParams.get('redirect-path')).toBe(
      '/?embed=true&mode=anonymous',
    );
  });
});

describe('watchTenantSwitch', () => {
  it('re-auths into the requested tenant and re-installs via sso-login-complete', async () => {
    const { host, iframe } = makeHost(
      'https://os.ibl.ai/platform/acme/bot?embed=true&mode=anonymous',
    );
    const stop = watchTenantSwitch(host);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { tenantSwitch: true, tenant: 'beta' },
      }),
    );
    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalled(),
    );
    const [{ url }] = chromeStub.stub.identity.launchWebAuthFlow.mock
      .calls[0] as unknown as [{ url: string }];
    expect(url).toContain('tenant=beta');
    await vi.waitFor(() => expect(iframe.src).toContain('/sso-login-complete'));
    const routed = new URL(iframe.src);
    // Lands on root (embed params preserved), not the old tenant's path.
    expect(routed.searchParams.get('redirect-path')).toBe(
      '/?embed=true&mode=anonymous',
    );
    stop();
  });

  // A message with no tenant but an address means "let me choose". The panel's
  // iframe cannot go there — navigating it would tear the mentor out of the
  // panel — so the chooser opens in a tab and the pick resumes the normal
  // switch.
  it('opens the chooser in a tab and switches to whatever the user picks there', async () => {
    const { host, iframe } = makeHost(
      'https://os.ibl.ai/platform/acme/bot?embed=true&mode=anonymous',
    );
    const stop = watchTenantSwitch(host);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          tenantSwitch: true,
          chooserUrl: 'https://login.iblai.app/me?action=switch-tenant&popup=1',
        },
      }),
    );

    await vi.waitFor(() =>
      expect(chromeStub.stub.tabs.create).toHaveBeenCalled(),
    );
    const [{ url }] = chromeStub.stub.tabs.create.mock.calls[0] as unknown as [
      { url: string },
    ];
    expect(url).toContain('action=switch-tenant');

    // The chooser answers by sending its tab to /login/complete?tenant=…
    for (const listener of [...chromeStub.updated])
      listener(
        99,
        {},
        { id: 99, url: 'https://login.iblai.app/login/complete?tenant=beta' },
      );

    // That tab is closed rather than left to open the full web app, and the
    // panel mints its own session for the chosen organization.
    await vi.waitFor(() =>
      expect(chromeStub.stub.tabs.remove).toHaveBeenCalledWith(99),
    );
    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalled(),
    );
    const [{ url: authUrl }] = chromeStub.stub.identity.launchWebAuthFlow.mock
      .calls[0] as unknown as [{ url: string }];
    expect(authUrl).toContain('tenant=beta');
    await vi.waitFor(() => expect(iframe.src).toContain('/sso-login-complete'));
    stop();
  });

  // Closing the tab without choosing is not a switch: nothing was minted and
  // the panel keeps the session it had.
  it('does nothing when the chooser tab is closed without a pick', async () => {
    const { host } = makeHost('https://os.ibl.ai/platform/acme/bot?embed=true');
    const stop = watchTenantSwitch(host);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          tenantSwitch: true,
          chooserUrl: 'https://login.iblai.app/me?action=switch-tenant&popup=1',
        },
      }),
    );
    await vi.waitFor(() =>
      expect(chromeStub.stub.tabs.create).toHaveBeenCalled(),
    );

    for (const listener of [...chromeStub.removed]) listener(99);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    stop();
  });

  it('captures the return path BEFORE auth, so a mid-flight navigation cannot degrade it to bare /', async () => {
    const { host, iframe } = makeHost(
      'https://os.ibl.ai/platform/acme/bot?embed=true&mode=anonymous',
    );
    // Simulate the app navigating the iframe to a /sso-login-complete URL while
    // the auth round-trip is in flight (its query has only data/redirect-path/
    // tenant — everything embedRedirectPath would strip to "/").
    chromeStub.stub.identity.launchWebAuthFlow.mockImplementationOnce(
      async () => {
        iframe.setAttribute(
          'src',
          'https://os.ibl.ai/sso-login-complete?data=x&redirect-path=%2F&tenant=old',
        );
        return sessionRedirect(SESSION);
      },
    );
    const stop = watchTenantSwitch(host);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { tenantSwitch: true, tenant: 'beta' },
      }),
    );
    await vi.waitFor(() =>
      expect(iframe.src).toContain('redirect-path=%2F%3Fembed'),
    );
    const routed = new URL(iframe.src);
    // The captured pre-auth embed params win, not the mid-flight bare "/".
    expect(routed.searchParams.get('redirect-path')).toBe(
      '/?embed=true&mode=anonymous',
    );
    stop();
  });

  it('strips the stale session data, redirect-path and tenant from the return path', async () => {
    // By switch time the iframe is a previously-installed /sso-login-complete
    // result whose query still holds a full `data` blob; it must not be carried
    // into the next redirect-path (that nests + overflows the request line).
    const { host, iframe } = makeHost(
      'https://os.ibl.ai/?embed=true&mode=anonymous' +
        '&data=%7B%22axd_token%22%3A%22stale%22%7D' +
        '&redirect-path=%2Fplatform%2Facme%2Fbot&tenant=acme',
    );
    const stop = watchTenantSwitch(host);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { tenantSwitch: true, tenant: 'beta' },
      }),
    );
    await vi.waitFor(() => expect(iframe.src).toContain('/sso-login-complete'));
    const routed = new URL(iframe.src);
    // Only the embed params survive — no nested data / redirect-path / old tenant.
    expect(routed.searchParams.get('redirect-path')).toBe(
      '/?embed=true&mode=anonymous',
    );
    stop();
  });

  it('refreshes agent-ai cached host auth so its re-broadcast cannot revert the switch', async () => {
    const { host, iframe } = makeHost(
      'https://os.ibl.ai/platform/acme/bot?embed=true&mode=anonymous',
    );
    // Simulate agent-ai's stale mount-time cache (a different/old session).
    (host as unknown as { iblData: string }).iblData = JSON.stringify({
      axd_token: 'stale-old',
      tenant: 'old',
    });
    const stop = watchTenantSwitch(host);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { tenantSwitch: true, tenant: 'beta' },
      }),
    );
    await vi.waitFor(() => expect(iframe.src).toContain('/sso-login-complete'));
    const cached = JSON.parse((host as unknown as { iblData: string }).iblData);
    // Cache now mirrors the freshly-installed session, not the stale old one.
    expect(cached.axd_token).toBe(localStorage.getItem('axd_token'));
    expect(cached.tenant).toBe(localStorage.getItem('tenant'));
    expect(cached.axd_token).not.toBe('stale-old');
    stop();
  });

  it('ignores messages that are not a tenant switch', async () => {
    const { host, iframe } = makeHost();
    const before = iframe.src;
    const stop = watchTenantSwitch(host);
    window.dispatchEvent(
      new MessageEvent('message', { data: { loaded: true } }),
    );
    await Promise.resolve();
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(iframe.src).toBe(before);
    stop();
  });
});

// The embed posts `authExpired` instead of navigating itself to the auth SPA:
// inside the panel's partitioned iframe that navigation would tear the mentor
// out of the panel. The host has to answer, and when the host session is dead
// too the only answer left is a fresh interactive sign-in.
// agent-ai hides the iframe behind "Please refresh the page" when its own
// re-mint fails, and has no counterpart that puts it back. Without undoing it,
// a successful recovery happens behind a hidden iframe and looks like nothing.
describe('installSession clearing the widget refresh notice', () => {
  it('unhides the iframe and clears the notice', () => {
    const { host, iframe } = makeHost();
    const notice = host.shadowRoot?.querySelector(
      '#refresh-instruction',
    ) as HTMLElement;
    notice.innerHTML = '<p>Your session has expired.</p>';
    notice.style.display = 'block';
    iframe.style.display = 'none';

    expect(installSession(host)).toBe(true);

    expect(iframe.style.display).toBe('');
    expect(notice.style.display).toBe('none');
    expect(notice.innerHTML).toBe('');
  });
});

describe('watchAuthExpired', () => {
  const EXPIRED = '2026-11-03T18:13:55.050Z';

  it('re-authenticates and re-installs when the host session has expired too', async () => {
    const { host, iframe } = makeHost(
      'https://os.ibl.ai/platform/acme/bot?embed=true&mode=anonymous',
    );
    localStorage.setItem('axd_token_expires', EXPIRED);
    const stop = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );

    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalled(),
    );
    await vi.waitFor(() => expect(iframe.src).toContain('/sso-login-complete'));
    // The embed params survive the round-trip, so the app reopens the chat it
    // was in rather than a bare root.
    expect(new URL(iframe.src).searchParams.get('redirect-path')).toBe(
      '/?embed=true&mode=anonymous',
    );
    stop();
  });

  // agent-ai re-mints from the stored edX JWT whenever the host session is
  // still good. Popping an auth window over a refresh that was about to
  // succeed is worse than waiting for it.
  it('stands aside while the host session is still valid', async () => {
    const { host } = makeHost();
    const stop = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    stop();
  });

  it('signs in once for a burst of authExpired messages', async () => {
    const { host } = makeHost();
    localStorage.setItem('axd_token_expires', EXPIRED);
    const stop = watchAuthExpired(host);

    for (let i = 0; i < 3; i++) {
      window.dispatchEvent(
        new MessageEvent('message', { data: { authExpired: true } }),
      );
    }

    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalled(),
    );
    expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    stop();
  });

  // A failed sign-in must not wedge the guard: the person can close the auth
  // window by accident, and the next message has to be able to try again.
  it('recovers from a failed sign-in and will retry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { host } = makeHost();
    localStorage.setItem('axd_token_expires', EXPIRED);
    chromeStub.stub.identity.launchWebAuthFlow.mockResolvedValueOnce(
      undefined as never,
    );
    const stop = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    expect(warn.mock.calls[0]?.[0]).toContain('session recovery failed');

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );
    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(
        2,
      ),
    );
    stop();
    warn.mockRestore();
  });

  // A full expiry leaves no JWT to mint with, so recovery goes through the
  // interactive /login — which returns the user's DEFAULT organization. Someone
  // who had switched would silently land somewhere else.
  it('returns to the organization the panel was on', async () => {
    const { host } = makeHost();
    localStorage.setItem('tenant', 'beta');
    localStorage.setItem('axd_token_expires', EXPIRED);
    const stop = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );
    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(
        2,
      ),
    );
    const [, second] = chromeStub.stub.identity.launchWebAuthFlow.mock
      .calls as unknown as [{ url: string }][];
    // First hop is the interactive login; the session it mints authorises the
    // second, non-interactive hop back to the chosen organization.
    expect(second[0].url).toContain('/login/complete?tenant=beta');
    stop();
  });

  it('does not re-sign-in when login already returns the right organization', async () => {
    const { host } = makeHost();
    localStorage.setItem('tenant', SESSION.tenant);
    localStorage.setItem('axd_token_expires', EXPIRED);
    const stop = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );
    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalled(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    stop();
  });

  // Our own stamp can be absent, unparseable, behind a slow clock, or describe
  // a token the server has revoked. The embed's 401 is first-hand evidence, so
  // a second report means agent-ai's refresh did not work and we stop deferring.
  it('stops standing aside when a valid-looking session keeps failing', async () => {
    const { host } = makeHost();
    const stop = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );
    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalled(),
    );
    stop();
  });

  // Both messages come from the same dead session. Two auth flows at once let
  // the slower one overwrite the session the faster one installed.
  it('runs one auth flow when a tenant switch and an expiry arrive together', async () => {
    const { host } = makeHost();
    localStorage.setItem('axd_token_expires', EXPIRED);
    const stopSwitch = watchTenantSwitch(host);
    const stopExpired = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { tenantSwitch: true, tenant: 'beta' },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );

    await vi.waitFor(() =>
      expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalled(),
    );
    expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    stopSwitch();
    stopExpired();
  });

  it('ignores unrelated messages, and stops listening once detached', async () => {
    const { host } = makeHost();
    localStorage.setItem('axd_token_expires', EXPIRED);
    const stop = watchAuthExpired(host);

    window.dispatchEvent(
      new MessageEvent('message', { data: { somethingElse: true } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();

    stop();
    window.dispatchEvent(
      new MessageEvent('message', { data: { authExpired: true } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });
});

describe('refreshHostAuthCache', () => {
  it('writes the current session into agent-ai iblData in its expected shape', () => {
    const { host } = makeHost();
    localStorage.setItem('axd_token', 'A');
    localStorage.setItem('tenant', 'beta');
    localStorage.setItem('current_tenant', '{"key":"beta"}');
    refreshHostAuthCache(host);
    const cached = JSON.parse((host as unknown as { iblData: string }).iblData);
    expect(cached).toMatchObject({
      axd_token: 'A',
      tenant: 'beta',
      current_tenant: '{"key":"beta"}',
    });
    // Missing keys are present as null (the shape agent-ai rebuilds from).
    expect(cached).toHaveProperty('edx_jwt_token');
  });
});

describe('embedRedirectPath', () => {
  it('keeps embed params but drops auth/routing params', () => {
    const { host } = makeHost(
      'https://os.ibl.ai/?embed=true&data=x&redirect-path=/y&tenant=acme',
    );
    expect(embedRedirectPath(host)).toBe('/?embed=true');
  });

  it('returns root when there are no query params', () => {
    const { host } = makeHost('https://os.ibl.ai/');
    expect(embedRedirectPath(host)).toBe('/');
  });

  it('returns root when there is no iframe or the src is unparseable', () => {
    expect(embedRedirectPath(document.createElement('agent-ai'))).toBe('/');
    const { host } = makeHost(':::not-a-url');
    expect(embedRedirectPath(host)).toBe('/');
  });
});

describe('watchAndInstallSession', () => {
  // The widget sets the iframe's src while React is still committing, so
  // waiting even one tick lets that first (unauthenticated, thrown-away)
  // document load and paint — the app appearing to load twice.
  it('installs in the same task as the call, without starting a timer', () => {
    vi.useFakeTimers();
    const { host, iframe } = makeHost();
    const stop = watchAndInstallSession(host);
    expect(iframe.src).toContain('/sso-login-complete');
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it('polls until the frame is installed and then stops', () => {
    vi.useFakeTimers();
    const { host, iframe } = makeHost('about:blank');
    const stop = watchAndInstallSession(host, 250, 120);
    vi.advanceTimersByTime(500);
    expect(iframe.src).toBe('about:blank');
    iframe.setAttribute('src', 'https://os.ibl.ai/chat?embed=true');
    vi.advanceTimersByTime(250);
    expect(iframe.src).toContain('/sso-login-complete');
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it('gives up after the attempt budget', () => {
    vi.useFakeTimers();
    const { host } = makeHost('about:blank');
    watchAndInstallSession(host, 250, 3);
    vi.advanceTimersByTime(250 * 3);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('removeWidgetSpinner', () => {
  it('drops the widget spinner so only the app’s own loading screen shows', () => {
    const { host } = makeHost();
    expect(host.shadowRoot!.querySelector('#loading-spinner')).not.toBeNull();
    removeWidgetSpinner(host);
    expect(host.shadowRoot!.querySelector('#loading-spinner')).toBeNull();
    // Idempotent, and harmless on an element that never built a shadow root.
    removeWidgetSpinner(host);
    removeWidgetSpinner(document.createElement('agent-ai'));
  });
});

describe('readActiveTab', () => {
  // The Web Store is ordinary https, so the old protocol check waved it
  // through and `executeScript` failed inside Chrome instead — which left the
  // panel silently holding the PREVIOUS page's text, since a failed read
  // neither pushes nor clears.
  it('skips the Chrome Web Store, which no extension may read', async () => {
    for (const url of [
      'https://chromewebstore.google.com/detail/foo/abc',
      'https://chrome.google.com/webstore/detail/foo/abc',
    ]) {
      chromeStub.stub.tabs.query.mockResolvedValueOnce([
        { id: 1, url, active: true },
      ]);
      await expect(readActiveTab()).resolves.toBeNull();
    }
    expect(chromeStub.stub.scripting.executeScript).not.toHaveBeenCalled();
  });

  // Undocked DevTools is a window of its own, so `lastFocusedWindow` resolved
  // to it while debugging and the read came back empty. The browse bridge
  // already resolves by window id for exactly this reason.
  it('asks for the active tab of THIS window, not the last-focused one', async () => {
    chromeStub.stub.tabs.query.mockResolvedValueOnce([
      { id: 1, url: 'https://example.com', active: true },
    ]);
    await readActiveTab();
    expect(chromeStub.stub.tabs.query).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, windowId: 1 }),
    );
    expect(chromeStub.stub.tabs.query).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastFocusedWindow: true }),
    );
  });

  it('skips browser pages and swallows injection failures', async () => {
    chromeStub.stub.tabs.query.mockResolvedValueOnce([
      { id: 1, url: 'chrome://extensions', active: true },
    ]);
    await expect(readActiveTab()).resolves.toBeNull();
    chromeStub.stub.tabs.query.mockResolvedValueOnce([
      { id: undefined, url: 'https://a.b', active: true },
    ] as never);
    await expect(readActiveTab()).resolves.toBeNull();
    chromeStub.stub.scripting.executeScript.mockRejectedValueOnce(
      new Error('no access'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(readActiveTab()).resolves.toBeNull();
    warn.mockRestore();
    expect(chromeStub.stub.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('reads the tab through the injected extractor', async () => {
    document.body.innerHTML = '<p>Hello page</p>';
    document.title = 'Page';
    const content = await readActiveTab();
    expect(content).toMatchObject({
      title: 'Page',
      text: expect.stringContaining('Hello page'),
    });
  });

  it("feeds every frame's text, page first, and skips frames with none", async () => {
    document.body.innerHTML = '<p>Hello page</p>';
    document.title = 'Page';
    const original =
      chromeStub.stub.scripting.executeScript.getMockImplementation()!;
    chromeStub.stub.scripting.executeScript.mockImplementationOnce(
      async (injection) => [
        {
          frameId: 4,
          result: {
            title: 'Chat',
            href: 'https://chat.acme.com/frame',
            text: 'hi from chat',
          },
        },
        {
          frameId: 2,
          result: { title: 'Pixel', href: 'https://ads.example/px', text: '' },
        },
        ...(await original(injection)),
      ],
    );
    const content = await readActiveTab();
    expect(content).toMatchObject({ title: 'Page', href: location.href });
    expect(content!.text).toMatch(/Hello page\n\nhi from chat$/);
  });

  it('returns null when the page answered with no frames', async () => {
    chromeStub.stub.scripting.executeScript.mockResolvedValueOnce([]);
    await expect(readActiveTab()).resolves.toBeNull();
  });
});

describe('startContextFeed', () => {
  it('pushes the active tab content to the mentor iframe on load, tab events, the timer and the loaded handshake', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<p>Context</p>';
    const { host, postMessage: post } = makeHost();
    const stop = startContextFeed(host, 5000);
    await vi.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatchObject({
      type: 'MENTOR:CONTEXT_UPDATE',
      pageContent: expect.stringContaining('Context'),
      hostInfo: { href: location.href },
    });
    for (const listener of chromeStub.activated) listener();
    await vi.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledTimes(2);
    for (const listener of chromeStub.updated)
      listener(7, { status: 'complete' }, { active: true });
    for (const listener of chromeStub.updated)
      listener(7, { status: 'loading' }, { active: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(post).toHaveBeenCalledTimes(4);
    window.dispatchEvent(
      new MessageEvent('message', { data: { loaded: true } }),
    );
    window.dispatchEvent(
      new MessageEvent('message', { data: { other: true } }),
    );
    expect(post).toHaveBeenCalledTimes(5);
    stop();
    expect(chromeStub.activated.size).toBe(0);
    expect(chromeStub.updated.size).toBe(0);
    await vi.advanceTimersByTimeAsync(10000);
    expect(post).toHaveBeenCalledTimes(5);
  });

  it('does not push before content exists', () => {
    const { host, postMessage: post } = makeHost();
    chromeStub.stub.tabs.query.mockResolvedValue([
      { id: 1, url: 'chrome://x', active: true },
    ]);
    const stop = startContextFeed(host, 5000);
    window.dispatchEvent(
      new MessageEvent('message', { data: { loaded: true } }),
    );
    expect(post).not.toHaveBeenCalled();
    stop();
  });
});
