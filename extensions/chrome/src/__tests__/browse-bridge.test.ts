import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startBrowseBridge } from '../browse-bridge';
import {
  fakePort,
  installChromeStub,
  SESSION,
  type ChromeStub,
  type FakePort,
} from './chrome.stub';

const MENTOR = 'https://os.ibl.ai';

let chromeStub: ChromeStub;
let port: FakePort;

/**
 * An `<agent-ai>` stand-in: an open shadow root holding the widget iframe, the
 * same shape `mentorIframe` looks for. jsdom gives an iframe in a shadow root no
 * contentWindow, so the source identity the bridge checks is stubbed in.
 */
function host(mentorUrl = MENTOR) {
  const element = document.createElement('agent-ai');
  element.setAttribute('mentorurl', mentorUrl);
  const root = element.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  container.id = 'ibl-chat-widget-container';
  const iframe = document.createElement('iframe');
  iframe.setAttribute('src', `${mentorUrl}/chat`);
  container.append(iframe);
  root.append(container);
  document.body.append(element);
  const contentWindow = { postMessage: vi.fn() };
  Object.defineProperty(iframe, 'contentWindow', { value: contentWindow });
  return { element, contentWindow };
}

/** Deliver a frame as if the iframe had posted it. */
const post = (data: unknown, source: unknown, origin = MENTOR) =>
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: source as Window }),
  );

const posted = (contentWindow: { postMessage: ReturnType<typeof vi.fn> }) =>
  contentWindow.postMessage.mock.calls.map((call) => call[0]);

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  for (const [key, value] of Object.entries(SESSION))
    localStorage.setItem(key, value);
  chromeStub = installChromeStub();
  port = fakePort();
  chromeStub.stub.runtime.connect.mockReturnValue(port);
});

describe('the handshake', () => {
  it('answers a hello from the mentor iframe', () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_HELLO' }, contentWindow);
    expect(posted(contentWindow)).toEqual([{ type: 'MENTOR:BROWSE_READY' }]);
    // Targeted at the mentor origin, never '*'.
    expect(contentWindow.postMessage.mock.calls[0][1]).toBe(MENTOR);
  });

  it('ignores a frame from anything but the mentor iframe', () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_HELLO' }, { postMessage: vi.fn() });
    expect(posted(contentWindow)).toEqual([]);
  });

  // The source check alone would accept an iframe that navigated elsewhere.
  it('ignores a frame whose origin is not the mentor app', () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_HELLO' }, contentWindow, 'https://evil.test');
    expect(posted(contentWindow)).toEqual([]);
  });

  it('ignores frames it does not own', () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'SOMETHING:ELSE' }, contentWindow);
    post(null, contentWindow);
    expect(posted(contentWindow)).toEqual([]);
    expect(chromeStub.stub.runtime.connect).not.toHaveBeenCalled();
  });
});

describe('relaying a run', () => {
  it('opens the port once, attaches the session, and never echoes it back', async () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_RUN', goal: 'open billing' }, contentWindow);
    await vi.waitFor(() => expect(port.sent).toHaveLength(1));
    post({ type: 'MENTOR:BROWSE_RUN', goal: 'again' }, contentWindow);
    await vi.waitFor(() => expect(port.sent).toHaveLength(2));
    expect(chromeStub.stub.runtime.connect).toHaveBeenCalledTimes(1);
    expect(port.sent).toEqual([
      {
        type: 'run',
        goal: 'open billing',
        creds: { dmToken: 'dm', org: 'acme', username: 'jane' },
        tabId: 7,
        auto: false,
      },
      {
        type: 'run',
        goal: 'again',
        creds: { dmToken: 'dm', org: 'acme', username: 'jane' },
        tabId: 7,
        auto: false,
      },
    ]);
    // The token must never travel into the page.
    expect(JSON.stringify(posted(contentWindow))).not.toContain('dm');
  });

  // Approvals is the app's setting, but it decides whether the user is asked
  // before an action — so it is coerced at the trust boundary rather than
  // forwarded as whatever the frame happened to carry.
  it('relays the approvals flag, and trusts nothing but a literal true', async () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_RUN', goal: 'one', auto: true }, contentWindow);
    await vi.waitFor(() => expect(port.sent).toHaveLength(1));
    post(
      { type: 'MENTOR:BROWSE_RUN', goal: 'two', auto: 'yes' },
      contentWindow,
    );
    await vi.waitFor(() => expect(port.sent).toHaveLength(2));
    expect(port.sent.map((m) => (m as { auto: unknown }).auto)).toEqual([
      true,
      false,
    ]);
  });

  it('refuses to run without a usable session', () => {
    localStorage.removeItem('dm_token');
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_RUN', goal: 'go' }, contentWindow);
    expect(chromeStub.stub.runtime.connect).not.toHaveBeenCalled();
    expect(posted(contentWindow)).toEqual([
      {
        type: 'MENTOR:BROWSE_EVENT',
        payload: {
          type: 'error',
          message: 'Your session is no longer valid. Sign in again.',
        },
      },
    ]);
  });

  it('forwards worker frames into the iframe', async () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_RUN', goal: 'go' }, contentWindow);
    await vi.waitFor(() => expect(port.sent).toHaveLength(1));
    port.emit({ type: 'log', text: 'Click [1] button "Pay"', ok: true });
    port.emit({ type: 'done', text: 'Done.' });
    expect(posted(contentWindow)).toEqual([
      // The ack is the app's first sign the panel heard it at all.
      { type: 'MENTOR:BROWSE_EVENT', payload: { type: 'ack' } },
      {
        type: 'MENTOR:BROWSE_EVENT',
        payload: { type: 'log', text: 'Click [1] button "Pay"', ok: true },
      },
      {
        type: 'MENTOR:BROWSE_EVENT',
        payload: { type: 'done', text: 'Done.' },
      },
    ]);
  });

  it('relays stop and confirm answers, and only after a run has opened the port', async () => {
    const { element, contentWindow } = host();
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_STOP' }, contentWindow);
    post({ type: 'MENTOR:BROWSE_CONFIRM', id: 0, ok: true }, contentWindow);
    expect(chromeStub.stub.runtime.connect).not.toHaveBeenCalled();
    post({ type: 'MENTOR:BROWSE_RUN', goal: 'go' }, contentWindow);
    await vi.waitFor(() => expect(port.sent).toHaveLength(1));
    post({ type: 'MENTOR:BROWSE_CONFIRM', id: 3, ok: false }, contentWindow);
    post({ type: 'MENTOR:BROWSE_STOP' }, contentWindow);
    expect(port.sent.slice(1)).toEqual([
      { type: 'confirm', id: 3, ok: false },
      { type: 'stop' },
    ]);
  });

  it('stops listening and drops the port when disposed', async () => {
    const { element, contentWindow } = host();
    const stop = startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_RUN', goal: 'go' }, contentWindow);
    await vi.waitFor(() => expect(port.sent).toHaveLength(1));
    stop();
    expect(port.disconnect).toHaveBeenCalled();
    // Disposing is not a worker crash: no error is reported on the way out.
    const after = posted(contentWindow).length;
    post({ type: 'MENTOR:BROWSE_HELLO' }, contentWindow);
    expect(posted(contentWindow)).toHaveLength(after);
  });

  it('says nothing when the mentor URL is unusable', () => {
    const { element, contentWindow } = host('not a url');
    startBrowseBridge(element);
    post({ type: 'MENTOR:BROWSE_HELLO' }, contentWindow, 'not a url');
    expect(posted(contentWindow)).toEqual([]);
  });
});
