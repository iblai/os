import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  embedRedirectPath,
  installSession,
  mentorIframe,
  readActiveTab,
  removeWidgetSpinner,
  startContextFeed,
  watchAndInstallSession,
  watchTenantSwitch,
} from '../mentor-frame';
import { SESSION, installChromeStub, type ChromeStub } from './chrome.stub';

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
