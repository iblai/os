import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '../agent';
import {
  enablePanelOnActionClick,
  handleBrowsePort,
  registerBrowsePort,
} from '../browse-worker';
import type { BrowserToolsContext } from '../tools';
import { fakePort, installChromeStub, type ChromeStub } from './chrome.stub';

const runAgent = vi.hoisted(() => vi.fn());
const listModels = vi.hoisted(() => vi.fn());
const contexts = vi.hoisted(() => [] as unknown[]);

vi.mock('../agent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../agent')>()),
  buildModel: vi.fn(() => 'model'),
  listModels,
  runAgent,
}));

vi.mock('../tools', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tools')>()),
  createBrowserTools: vi.fn((ctx: unknown) => {
    contexts.push(ctx);
    return {
      tools: {},
      snapshot: async () => ({
        url: 'https://app.acme.com/',
        title: 'Acme',
        items: [],
        text: '[1] button "Pay"',
      }),
      picture: () => null,
    };
  }),
}));

let chromeStub: ChromeStub;
const creds = { dmToken: 'dm', org: 'acme', username: 'jane' };

const openPort = () => {
  const port = fakePort();
  handleBrowsePort(port as unknown as chrome.runtime.Port);
  return port;
};

/** A run that never settles on its own, so the test drives what happens inside. */
const pending = () => {
  let signal: AbortSignal | null = null;
  runAgent.mockImplementation(
    (options: { signal: AbortSignal }) =>
      new Promise((resolve) => {
        signal = options.signal;
        options.signal.addEventListener('abort', () =>
          resolve({ text: '', messages: [], steps: 0, stoppedBy: null }),
        );
      }),
  );
  return () => signal;
};

const ctxOf = async (index = 0) => {
  await vi.waitFor(() => expect(contexts.length).toBeGreaterThan(index));
  return contexts[index] as BrowserToolsContext;
};

const frames = (port: ReturnType<typeof fakePort>, type: string) =>
  port.sent.filter((m) => (m as { type: string }).type === type);

beforeEach(async () => {
  chromeStub = installChromeStub();
  contexts.length = 0;
  runAgent.mockReset();
  listModels.mockReset();
  listModels.mockResolvedValue(['openai/gpt-5']);
  await chromeStub.stub.storage.local.set({
    browse: { model: 'openai/gpt-5', preference: 'anthropic/claude-sonnet-5' },
  });
});

describe('the browse port', () => {
  it('runs a goal and reports the stream and the result', async () => {
    runAgent.mockImplementation(
      async (options: { onEvent: (event: AgentEvent) => void }) => {
        options.onEvent({ type: 'text', text: 'hi' });
        return { text: 'Done.', messages: [], steps: 1, stoppedBy: null };
      },
    );
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'open billing', creds });
    await vi.waitFor(() =>
      expect(port.sent).toContainEqual({ type: 'done', text: 'Done.' }),
    );
    expect(port.sent).toContainEqual({
      type: 'event',
      event: { type: 'text', text: 'hi' },
    });
    // The goal reaches the model as a user turn carrying the page snapshot.
    const { messages } = runAgent.mock.calls[0][0];
    expect(messages.at(-1).role).toBe('user');
    expect(messages.at(-1).content).toContain('open billing');
    expect(messages.at(-1).content).toContain('[1] button "Pay"');
  });

  // A 402 and a 401 are the two the user can act on; everything else keeps the
  // provider's wording, wrapped so it reads as a sentence.
  it('gives credits and session errors their own wording', async () => {
    runAgent.mockImplementation(
      async (options: { onEvent: (event: AgentEvent) => void }) => {
        options.onEvent({ type: 'error', message: 'nope', statusCode: 402 });
        options.onEvent({ type: 'error', message: 'nope', statusCode: 401 });
        options.onEvent({ type: 'error', message: 'kaboom' });
        return { text: '', messages: [], steps: 0, stoppedBy: null };
      },
    );
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'done')).toHaveLength(1));
    expect(frames(port, 'error')).toEqual([
      {
        type: 'error',
        message: 'Not enough credits on this platform.',
      },
      {
        type: 'error',
        message: 'Your session is no longer valid. Sign in again.',
      },
      { type: 'error', message: 'Something went wrong: kaboom' },
    ]);
  });

  it('says which cap ended the run, and nothing when none did', async () => {
    const finish = (stoppedBy: 'steps' | 'tokens' | null) =>
      runAgent.mockResolvedValue({
        text: 'ok',
        messages: [],
        steps: 1,
        stoppedBy,
      });
    for (const [stoppedBy, note] of [
      [
        'steps',
        'I stopped here: that’s as many steps as I take in one go. Send “continue” and I’ll pick up where I left off, as long as this panel stays open.',
      ],
      [
        'tokens',
        'I stopped here: that’s as much as I can read in one go. Send “continue” and I’ll pick up where I left off, as long as this panel stays open.',
      ],
      [null, undefined],
    ] as const) {
      finish(stoppedBy);
      const port = openPort();
      port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
      await vi.waitFor(() => expect(frames(port, 'done')).toHaveLength(1));
      expect(frames(port, 'done')[0]).toEqual({
        type: 'done',
        text: 'ok',
        note,
      });
    }
  });

  it('refuses a second run while one is in flight', async () => {
    pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'one', creds });
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalled());
    port.emit({ type: 'run', tabId: 7, goal: 'two', creds });
    await vi.waitFor(() =>
      expect(port.sent).toContainEqual({
        type: 'error',
        message: 'A run is already in progress.',
      }),
    );
    expect(runAgent).toHaveBeenCalledTimes(1);
  });

  it('aborts the run on stop', async () => {
    const signal = pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(signal()).not.toBeNull());
    port.emit({ type: 'stop' });
    expect(signal()!.aborted).toBe(true);
  });

  // Closing the panel drops the port; a run that kept going would hold the
  // worker alive with nobody watching it.
  it('aborts the run when the port disconnects', async () => {
    const signal = pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(signal()).not.toBeNull());
    port.close();
    expect(signal()!.aborted).toBe(true);
  });

  it('round-trips a confirmation through the panel', async () => {
    pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    const ctx = await ctxOf();

    const allowed = ctx.confirm('Click [1] button "Pay" on "Acme"');
    await vi.waitFor(() => expect(frames(port, 'confirm')).toHaveLength(1));
    const asked = frames(port, 'confirm')[0] as {
      id: number;
      description: string;
    };
    expect(asked.description).toBe('Click [1] button "Pay" on "Acme"');
    port.emit({ type: 'confirm', id: asked.id, ok: true });
    await expect(allowed).resolves.toBe(true);

    const denied = ctx.confirm('Click [1] button "Delete" on "Acme"');
    await vi.waitFor(() => expect(frames(port, 'confirm')).toHaveLength(2));
    const second = frames(port, 'confirm')[1] as { id: number };
    expect(second.id).not.toBe(asked.id);
    port.emit({ type: 'confirm', id: second.id, ok: false });
    await expect(denied).resolves.toBe(false);
  });

  // Approvals = Automatic. The gate the user is escaping fires on ANY form
  // submission, so a plain search prompted; auto answers without a card while
  // the action itself is still logged.
  it('never raises a card when the run is automatic', async () => {
    pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds, auto: true });
    const ctx = await ctxOf();

    await expect(ctx.confirm('Click [1] button "Pay" on "Acme"')).resolves.toBe(
      true,
    );
    expect(frames(port, 'confirm')).toHaveLength(0);
  });

  // A frame from an older panel carries no flag at all, and the safe reading of
  // a missing answer is "ask".
  it('asks when the run frame says nothing about approvals', async () => {
    pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    const ctx = await ctxOf();

    void ctx.confirm('Click [1] button "Pay" on "Acme"');
    await vi.waitFor(() => expect(frames(port, 'confirm')).toHaveLength(1));
  });

  // The agent used to have to guess which language to answer in.
  it('tells the model the browser language', async () => {
    runAgent.mockResolvedValue({
      text: 'ok',
      messages: [],
      steps: 1,
      stoppedBy: null,
    });
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds, auto: true });
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalled());
    expect(runAgent.mock.calls[0][0].language).toBe('en-GB');
  });

  it('declines anything still awaiting an answer when the port drops', async () => {
    pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    const ctx = await ctxOf();
    const answer = ctx.confirm('Click [1] button "Pay" on "Acme"');
    port.close();
    await expect(answer).resolves.toBe(false);
  });

  // Narration and a call the SDK refused are rows in the action list, where
  // the user can see them; they never end the turn.
  it('files narration and a refused call as rows, and keeps the run going', async () => {
    runAgent.mockImplementation(
      async (options: { onEvent: (event: AgentEvent) => void }) => {
        options.onEvent({ type: 'narration', text: 'Opening the menu.' });
        options.onEvent({ type: 'tool-error', toolName: 'click' });
        return { text: 'Done.', messages: [], steps: 2, stoppedBy: null };
      },
    );
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'done')).toHaveLength(1));
    expect(frames(port, 'log')).toEqual([
      { type: 'log', text: 'Read page app.acme.com', ok: true },
      { type: 'log', text: 'Opening the menu.', ok: true },
      { type: 'log', text: 'Click — Didn’t work.', ok: false },
    ]);
    expect(frames(port, 'error')).toEqual([]);
  });

  it('captures pictures only for a model that reads them', async () => {
    pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    expect((await ctxOf()).withPicture).toBe(true);
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalled());
    expect(runAgent.mock.calls[0][0].picture).toEqual(expect.any(Function));

    listModels.mockResolvedValue(['iblai/iblai-pro']);
    await chromeStub.stub.storage.local.set({ browse: { model: '' } });
    const second = openPort();
    second.emit({ type: 'run', tabId: 8, goal: 'go', creds });
    expect((await ctxOf(1)).withPicture).toBe(false);
  });

  it('sends the action log as text, already localized', async () => {
    pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    const ctx = await ctxOf();
    ctx.log({ tool: 'click', target: '[1] button "Pay"', ok: true });
    expect(port.sent).toContainEqual({
      type: 'log',
      text: 'Click [1] button "Pay"',
      ok: true,
    });
  });

  // Reading the page and then waiting for the first token is the longest stretch
  // of a run with nothing on screen, and it used to send nothing at all.
  it('reports reading the page before it calls the model', async () => {
    let atModelCall: unknown[] = [];
    const port = openPort();
    runAgent.mockImplementation(async () => {
      atModelCall = [...port.sent];
      return { text: 'ok', messages: [], steps: 1, stoppedBy: null };
    });
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'done')).toHaveLength(1));
    expect(atModelCall).toEqual([
      { type: 'log', text: 'Read page app.acme.com', ok: true },
    ]);
  });

  // The cache is written once and never expires, so a changed preference reaches
  // an install that has already run only through this check — without it, every
  // existing install keeps whatever model it first picked.
  it('re-picks when the cached model predates the current preference', async () => {
    await chromeStub.stub.storage.local.set({
      browse: { model: 'openai/gpt-5' },
    });
    listModels.mockResolvedValueOnce(['openai/gpt-5', 'iblai/iblai-pro']);
    runAgent.mockResolvedValue({
      text: 'ok',
      messages: [],
      steps: 1,
      stoppedBy: null,
    });
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds, auto: true });
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalled());

    expect(listModels).toHaveBeenCalled();
    const stored = await chromeStub.stub.storage.local.get('browse');
    expect(stored.browse).toEqual({
      model: 'openai/gpt-5',
      preference: 'anthropic/claude-sonnet-5',
    });
  });

  it('spends no request on the model list when the cache still matches', async () => {
    runAgent.mockResolvedValue({
      text: 'ok',
      messages: [],
      steps: 1,
      stoppedBy: null,
    });
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds, auto: true });
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalled());

    expect(listModels).not.toHaveBeenCalled();
  });

  it('picks and stores a model when none is set', async () => {
    await chromeStub.stub.storage.local.set({ browse: { model: '' } });
    listModels.mockResolvedValueOnce([
      'openai/gpt-5',
      'anthropic/claude-opus-5',
    ]);
    runAgent.mockResolvedValue({
      text: '',
      messages: [],
      steps: 0,
      stoppedBy: null,
    });
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'done')).toHaveLength(1));
    expect((chromeStub.store.browse as { model: string }).model).toBe(
      'anthropic/claude-opus-5',
    );
  });

  it('reports a model-list failure instead of running', async () => {
    await chromeStub.stub.storage.local.set({ browse: { model: '' } });
    listModels.mockRejectedValueOnce(new Error('Model list failed. nope'));
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() =>
      expect(port.sent).toContainEqual({
        type: 'error',
        message: 'Something went wrong: Model list failed. nope',
      }),
    );
    expect(runAgent).not.toHaveBeenCalled();
  });

  it('reports an empty model list as no models', async () => {
    await chromeStub.stub.storage.local.set({ browse: { model: '' } });
    listModels.mockResolvedValueOnce([]);
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() =>
      expect(port.sent).toContainEqual({
        type: 'error',
        message: 'No models are available on this platform.',
      }),
    );
    expect(runAgent).not.toHaveBeenCalled();
  });

  // The panel picks the tab, but the user can switch before the run starts, so
  // the worker re-checks — and names the page, or the refusal reads as a bug.
  it('refuses a tab the extension cannot inject into, naming it', async () => {
    chromeStub.stub.tabs.get.mockResolvedValueOnce({
      id: 7,
      url: 'chrome://extensions/',
      status: 'complete',
    });
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'error')).toHaveLength(1));
    expect((frames(port, 'error')[0] as { message: string }).message).toContain(
      'chrome://extensions/',
    );
    expect(runAgent).not.toHaveBeenCalled();
  });

  it('refuses a tab that has gone away', async () => {
    chromeStub.stub.tabs.get.mockRejectedValueOnce(new Error('No tab with id'));
    const port = openPort();
    port.emit({ type: 'run', tabId: 99, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'error')).toHaveLength(1));
    expect(runAgent).not.toHaveBeenCalled();
  });

  it('drives the tab the panel chose, not whichever window was focused last', async () => {
    runAgent.mockResolvedValue({
      text: '',
      messages: [],
      steps: 0,
      stoppedBy: null,
    });
    const port = openPort();
    port.emit({ type: 'run', tabId: 42, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'done')).toHaveLength(1));
    expect(chromeStub.stub.tabs.get).toHaveBeenCalledWith(42);
    expect(chromeStub.stub.tabs.query).not.toHaveBeenCalled();
  });
});

describe('worker wiring', () => {
  it('only accepts the browse port', () => {
    registerBrowsePort();
    const listener = [...chromeStub.connected][0] as (port: unknown) => void;
    const other = fakePort('something-else');
    listener(other);
    expect(other.onMessage.addListener).not.toHaveBeenCalled();
    const browse = fakePort();
    listener(browse);
    expect(browse.onMessage.addListener).toHaveBeenCalled();
  });

  it('binds the toolbar icon to the panel, and tolerates the API being absent', () => {
    enablePanelOnActionClick();
    expect(chromeStub.stub.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true,
    });
    (globalThis as { chrome: { sidePanel?: unknown } }).chrome.sidePanel =
      undefined;
    expect(() => enablePanelOnActionClick()).not.toThrow();
  });
});

describe('real clicks', () => {
  const done = () =>
    runAgent.mockResolvedValue({
      text: 'ok',
      messages: [],
      steps: 1,
      stoppedBy: null,
    });

  it('attaches the debugger for the run and detaches when it ends', async () => {
    done();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'done')).toHaveLength(1));
    expect(chromeStub.stub.debugger.attach).toHaveBeenCalledWith(
      { tabId: 7 },
      '1.3',
    );
    expect(
      chromeStub.stub.debugger.attach.mock.invocationCallOrder[0],
    ).toBeLessThan(runAgent.mock.invocationCallOrder[0]);
    expect(chromeStub.stub.debugger.detach).toHaveBeenCalledWith({ tabId: 7 });
    expect((await ctxOf()).real).toBeDefined();
    // Our own detach must not read as the user's.
    expect(chromeStub.detached.size).toBe(0);
  });

  it('refuses to start when another debugger holds the tab', async () => {
    done();
    chromeStub.stub.debugger.attach.mockRejectedValueOnce(
      new Error('Another debugger is already attached to the tab'),
    );
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(frames(port, 'error')).toHaveLength(1));
    expect(frames(port, 'error')[0]).toEqual({
      type: 'error',
      message:
        'Real clicks can’t start while the developer tools are open on this tab. Close them and try again.',
    });
    expect(runAgent).not.toHaveBeenCalled();
    expect(frames(port, 'done')).toEqual([]);
  });

  // Chrome's bar closed, or DevTools opened: the run ends saying so, never
  // quietly on scripted clicks.
  it('ends the run when the debugger goes away mid-run', async () => {
    const signal = pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(signal()).not.toBeNull());
    for (const listener of [...chromeStub.detached]) listener({ tabId: 7 });
    expect(signal()!.aborted).toBe(true);
    await vi.waitFor(() => expect(frames(port, 'error')).toHaveLength(1));
    expect(frames(port, 'error')[0]).toEqual({
      type: 'error',
      message:
        'Real clicks were stopped from the bar on the tab or by the developer tools, so the run ended. Try again.',
    });
    expect(frames(port, 'done')).toEqual([]);
    expect(chromeStub.stub.debugger.detach).toHaveBeenCalledTimes(1);
  });

  it('ignores another tab losing its debugger', async () => {
    const signal = pending();
    const port = openPort();
    port.emit({ type: 'run', tabId: 7, goal: 'go', creds });
    await vi.waitFor(() => expect(signal()).not.toBeNull());
    for (const listener of [...chromeStub.detached]) listener({ tabId: 9 });
    expect(signal()!.aborted).toBe(false);
  });
});
