import { beforeEach, describe, expect, it, vi } from 'vitest';
import { settle, sleep } from '../settle';
import {
  MAX_WAIT_MS,
  asElement,
  createBrowserTools,
  describeItem,
  hostOf,
  needsConfirm,
  type BrowserToolsContext,
  type LogEntry,
} from '../tools';
import { installChromeStub, type ChromeStub } from './chrome.stub';

vi.mock('../settle', () => ({
  settle: vi.fn(async () => undefined),
  sleep: vi.fn(async () => undefined),
}));

const FIXTURE = `
<main>
  <h1>Billing</h1>
  <form id="f">
    <label for="email">Email</label><input id="email" type="text" value="">
    <input id="pw" type="password" aria-label="Password">
    <button type="submit">Continue</button>
  </form>
  <a href="/forgot">Forgot password?</a>
  <select id="lang"><option value="en">English</option><option value="fr">Français</option></select>
  <button type="button">Pay now</button>
  <button type="button">Details</button>
  <p>Welcome.</p>
</main>`;

const OPTIONS = { toolCallId: 'call-1', messages: [] as never[] };

let chromeStub: ChromeStub;
let ctx: BrowserToolsContext & {
  confirm: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
};

const run = async (
  name: string,
  input: unknown,
  options: unknown = OPTIONS,
): Promise<string> => {
  const { tools } = current;
  const tool = tools[name] as {
    execute?: (input: unknown, options: unknown) => Promise<string>;
  };
  return (await tool.execute!(input, options)) as string;
};

let current: ReturnType<typeof createBrowserTools>;

const actCalls = () =>
  chromeStub.stub.scripting.executeScript.mock.calls.filter(
    (call) => (call[0] as { func: { name: string } }).func.name === 'actOnPage',
  );

beforeEach(() => {
  Object.defineProperty(HTMLFormElement.prototype, 'requestSubmit', {
    configurable: true,
    value(this: HTMLFormElement) {
      this.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    },
  });
});

beforeEach(async () => {
  vi.mocked(settle).mockClear();
  vi.mocked(sleep).mockClear();
  document.body.innerHTML = FIXTURE;
  document.title = 'Billing – Acme';
  // jsdom cannot navigate or submit; keep those from logging "not implemented".
  document.body.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) e.preventDefault();
  });
  document.body.addEventListener('submit', (e) => e.preventDefault());
  chromeStub = installChromeStub();
  ctx = {
    tabId: 7,
    confirm: vi.fn(async () => true),
    log: vi.fn(),
  };
  current = createBrowserTools(ctx);
  await current.snapshot();
  chromeStub.stub.scripting.executeScript.mockClear();
});

describe('helpers', () => {
  it('needsConfirm: submits, submit buttons and risky names', () => {
    const plain = {
      n: 1,
      role: 'button',
      name: 'Details',
      state: '',
      submit: false,
      password: false,
    };
    const submit = { ...plain, submit: true, name: 'Continue' };
    const pay = { ...plain, name: 'Pay now' };
    expect(needsConfirm('type', plain, true)).toBe(true);
    expect(needsConfirm('type', plain, false)).toBe(false);
    expect(needsConfirm('click', submit)).toBe(true);
    expect(needsConfirm('click', pay)).toBe(true);
    expect(needsConfirm('click', plain)).toBe(false);
    expect(needsConfirm('click', undefined)).toBe(false);
  });

  it('asElement accepts positive integers only', () => {
    expect(asElement(3)).toBe(3);
    for (const bad of [0, -1, 1.5, '3', null, undefined, NaN])
      expect(asElement(bad)).toBeNull();
  });

  it('describeItem and hostOf', () => {
    expect(
      describeItem(2, {
        n: 2,
        role: 'link',
        name: 'Go',
        state: '',
        submit: false,
        password: false,
      }),
    ).toBe('[2] link "Go"');
    expect(describeItem(9, undefined)).toBe('[9]');
    expect(hostOf('https://APP.acme.com/x')).toBe('app.acme.com');
    expect(hostOf('nope')).toBe('nope');
  });
});

describe('createBrowserTools', () => {
  it('exposes the tool set and a snapshot of the page', async () => {
    expect(Object.keys(current.tools).sort()).toEqual(
      [
        'back',
        'click',
        'navigate',
        'read_page',
        'scroll',
        'select',
        'type',
        'wait',
      ].sort(),
    );
    const page = await current.snapshot();
    expect(page.items.map((item) => item.name)).toContain('Continue');
    expect(page.text).toContain('Welcome.');
  });

  it('clicks, settles, re-reads the page and logs the target', async () => {
    const onClick = vi.fn();
    document.querySelector('a')!.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    const result = await run('click', { element: 5 });
    expect(result.startsWith('Clicked [5] link "Forgot password?".\n\n')).toBe(
      true,
    );
    expect(result).toContain('--- text ---');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(7);
    expect(ctx.confirm).not.toHaveBeenCalled();
    expect(ctx.log).toHaveBeenLastCalledWith({
      tool: 'click',
      target: '[5] link "Forgot password?"',
      ok: true,
    });
  });

  it('asks before a submit button and before a risky name, passing the abort signal', async () => {
    const controller = new AbortController();
    await run(
      'click',
      { element: 4 },
      { ...OPTIONS, abortSignal: controller.signal },
    );
    expect(ctx.confirm).toHaveBeenCalledWith(
      'Click [4] button "Continue" on "Billing – Acme"',
      controller.signal,
    );
    await run('click', { element: 7 });
    expect(ctx.confirm).toHaveBeenLastCalledWith(
      'Click [7] button "Pay now" on "Billing – Acme"',
      undefined,
    );
    expect(actCalls()).toHaveLength(2);
  });

  it('returns a decline to the model without acting', async () => {
    ctx.confirm.mockResolvedValueOnce(false);
    const result = await run('click', { element: 4 });
    expect(result).toBe('Error: User declined. Ask how to proceed.');
    expect(actCalls()).toHaveLength(0);
    expect(ctx.log).toHaveBeenLastCalledWith(
      expect.objectContaining({ tool: 'click', ok: false, code: 'declined' }),
    );
  });

  it('refuses to act on a page the extension cannot inject into', async () => {
    chromeStub.stub.tabs.get.mockResolvedValue({
      id: 7,
      url: 'chrome://extensions/',
      status: 'complete',
    });
    const result = await run('click', { element: 5 });
    expect(result).toBe(
      'Error: chrome://extensions/ is not an http or https page, so it cannot be driven.',
    );
    expect(actCalls()).toHaveLength(0);
    expect(ctx.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        code: 'host_blocked',
        host: 'chrome://extensions/',
        ok: false,
      }),
    );
  });

  it('never reads a page the action navigated out of http(s) to', async () => {
    chromeStub.stub.tabs.get
      .mockResolvedValueOnce({
        id: 7,
        url: 'https://app.acme.com/',
        status: 'complete',
      })
      .mockResolvedValue({
        id: 7,
        url: 'chrome://extensions/out',
        status: 'complete',
      });
    const snapshotsBefore =
      chromeStub.stub.scripting.executeScript.mock.calls.length;
    const result = await run('click', { element: 5 });
    expect(result).toBe(
      'Error: chrome://extensions/out is not an http or https page, so it cannot be driven.',
    );
    const funcs = chromeStub.stub.scripting.executeScript.mock.calls
      .slice(snapshotsBefore)
      .map((call) => (call[0] as { func: { name: string } }).func.name);
    expect(funcs).toEqual(['actOnPage']);
  });

  it('types without logging the text, and asks when submitting', async () => {
    const result = await run('type', { element: 2, text: 'jane@x.io' });
    expect(result.startsWith('Typed into [2] textbox "Email".')).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#email')!.value).toBe(
      'jane@x.io',
    );
    const logged = ctx.log.mock.lastCall![0] as LogEntry;
    expect(JSON.stringify(logged)).not.toContain('jane@x.io');
    expect(ctx.confirm).not.toHaveBeenCalled();
    document
      .querySelector('#f')!
      .addEventListener('submit', (e) => e.preventDefault());
    await run('type', { element: 2, text: 'jane', submit: true });
    expect(ctx.confirm).toHaveBeenCalledWith(
      'Type into [2] textbox "Email" and submit on "Billing – Acme"',
      undefined,
    );
  });

  it('refuses password fields with a visible reason', async () => {
    const result = await run('type', { element: 3, text: 'hunter2' });
    expect(result).toMatch(/^Error: this field takes a password/);
    expect(ctx.log).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: 'refused', ok: false }),
    );
  });

  it('selects an option and reports a bad one', async () => {
    expect(await run('select', { element: 6, value: 'Français' })).toMatch(
      /^Selected "Français" in \[6\] combobox/,
    );
    expect(document.querySelector<HTMLSelectElement>('#lang')!.value).toBe(
      'fr',
    );
    const bad = await run('select', { element: 6, value: 'Klingon' });
    expect(bad).toMatch(/^Error: No option matches "Klingon"/);
    expect(ctx.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ok: false,
        detail: expect.stringContaining('No option matches'),
      }),
    );
    expect((ctx.log.mock.lastCall![0] as LogEntry).code).toBeUndefined();
  });

  it('scrolls by direction or to an element', async () => {
    const scrollBy = vi.fn();
    Object.defineProperty(window, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });
    expect(await run('scroll', { direction: 'up' })).toMatch(/^Scrolled up\./);
    expect(await run('scroll', {})).toMatch(/^Scrolled down\./);
    expect(scrollBy).toHaveBeenCalledTimes(2);
    expect(await run('scroll', { element: 5 })).toMatch(
      /^Scrolled to \[5\] link/,
    );
    expect(await run('scroll', { element: 'x' })).toMatch(
      /^Error: element must be a number/,
    );
  });

  it('rejects element numbers that are not numbers', async () => {
    expect(await run('click', { element: '4' })).toMatch(
      /^Error: element must be a number/,
    );
    expect(await run('type', { element: 0, text: 'x' })).toMatch(
      /^Error: element must be a number/,
    );
    expect(await run('select', { element: null, value: 'x' })).toMatch(
      /^Error: element must be a number/,
    );
    expect(actCalls()).toHaveLength(0);
  });

  it('navigates only to http(s) URLs', async () => {
    const result = await run('navigate', {
      url: 'https://app.acme.com/billing',
    });
    expect(result.startsWith('Opened https://app.acme.com/billing.')).toBe(
      true,
    );
    expect(chromeStub.stub.tabs.update).toHaveBeenCalledWith(7, {
      url: 'https://app.acme.com/billing',
    });
    expect(settle).toHaveBeenCalledTimes(1);
    const blocked = await run('navigate', { url: 'chrome://extensions/' });
    expect(blocked).toBe(
      'Error: chrome://extensions/ is not an http or https page, so it cannot be driven.',
    );
    expect(chromeStub.stub.tabs.update).toHaveBeenCalledTimes(1);
    expect(ctx.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tool: 'navigate',
        target: 'chrome://extensions/',
        code: 'host_blocked',
      }),
    );
  });

  it('goes back', async () => {
    expect(await run('back', {})).toMatch(/^Went back\./);
    expect(chromeStub.stub.tabs.goBack).toHaveBeenCalledWith(7);
  });

  it('reads the page again with a longer excerpt, only on http(s) pages', async () => {
    const text = await run('read_page', {});
    expect(text).toContain('[1] heading "Billing"');
    expect(ctx.log).toHaveBeenLastCalledWith({
      tool: 'read_page',
      target: '',
      ok: true,
    });
    chromeStub.stub.tabs.get.mockResolvedValue({
      id: 7,
      url: 'chrome://extensions/',
      status: 'complete',
    });
    expect(await run('read_page', {})).toBe(
      'Error: chrome://extensions/ is not an http or https page, so it cannot be driven.',
    );
  });

  it('waits at most the cap and never a negative time', async () => {
    expect(await run('wait', { ms: 9000 })).toMatch(
      new RegExp(`^Waited ${MAX_WAIT_MS} ms\\.`),
    );
    expect(sleep).toHaveBeenLastCalledWith(MAX_WAIT_MS);
    await run('wait', { ms: -5 });
    expect(sleep).toHaveBeenLastCalledWith(0);
    expect(ctx.log).toHaveBeenLastCalledWith({
      tool: 'wait',
      target: '0 ms',
      ok: true,
    });
    chromeStub.stub.tabs.get.mockResolvedValue({
      id: 7,
      url: 'chrome://extensions/',
      status: 'complete',
    });
    expect(await run('wait', { ms: 10 })).toBe(
      'Error: chrome://extensions/ is not an http or https page, so it cannot be driven.',
    );
  });

  it('surfaces an injection failure as an error result', async () => {
    chromeStub.stub.scripting.executeScript.mockRejectedValueOnce(
      new Error('Cannot access contents of the page'),
    );
    expect(await run('click', { element: 5 })).toBe(
      'Error: Cannot access contents of the page',
    );
    expect(ctx.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ok: false,
        detail: 'Cannot access contents of the page',
      }),
    );
  });

  it('runs concurrent tool calls one at a time', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original =
      chromeStub.stub.scripting.executeScript.getMockImplementation()!;
    chromeStub.stub.scripting.executeScript.mockImplementation(
      async (injection) => {
        if ((injection as { func: { name: string } }).func.name === 'actOnPage')
          await gate;
        return original(injection);
      },
    );
    const first = run('click', { element: 5 });
    const second = run('click', { element: 8 });
    await vi.waitFor(() => expect(actCalls()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(actCalls()).toHaveLength(1);
    release();
    await first;
    await vi.waitFor(() => expect(actCalls()).toHaveLength(2));
    await second;
    expect(ctx.log).toHaveBeenCalledTimes(2);
  });
});
