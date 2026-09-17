import { jsonSchema, tool, type ToolSet } from 'ai';
import {
  actOnPage,
  scrollPage,
  snapshotPage,
  type ActResult,
  type Snapshot,
  type SnapshotItem,
} from './page-scripts';
import { injectable } from './settings';
import { settle, sleep } from './settle';

export const MAX_ITEMS = 200;
export const STEP_CHARS = 1500;
export const READ_PAGE_CHARS = 6000;
export const MAX_WAIT_MS = 3000;
/** Names of things the user should be asked about before they are clicked. */
export const CONFIRM_NAME =
  /\b(pay|purchase|buy|checkout|send|submit|delete|remove|confirm|order|place|sign out|log out)\b/i;

export interface LogEntry {
  tool: string;
  /** `[n] role "name"` or the scroll direction — never the text that was typed. */
  target: string;
  ok: boolean;
  code?: 'host_blocked' | 'declined' | 'refused';
  detail?: string;
  host?: string;
}

export interface BrowserToolsContext {
  tabId: number;
  /** Asks the user; resolves false when they decline or the run is aborted. */
  confirm: (description: string, signal?: AbortSignal) => Promise<boolean>;
  log: (entry: LogEntry) => void;
}

export interface BrowserTools {
  tools: ToolSet;
  /** The page as it is now; the first user turn carries it. */
  snapshot: () => Promise<Snapshot>;
}

class Refusal extends Error {
  constructor(
    readonly code: NonNullable<LogEntry['code']>,
    message: string,
    readonly host?: string,
  ) {
    super(message);
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function needsConfirm(
  action: 'click' | 'type',
  item: SnapshotItem | undefined,
  submit = false,
): boolean {
  if (action === 'type') return submit;
  return Boolean(item && (item.submit || CONFIRM_NAME.test(item.name)));
}

export function describeItem(
  n: number,
  item: SnapshotItem | undefined,
): string {
  return item ? `[${n}] ${item.role} "${item.name}"` : `[${n}]`;
}

/** Element numbers are positive integers from the latest snapshot; anything else is refused. */
export function asElement(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

const NO_INPUT = jsonSchema<Record<string, never>>({
  type: 'object',
  properties: {},
  additionalProperties: false,
});

const ELEMENT = {
  type: 'integer',
  minimum: 1,
  description: 'Element number from the latest snapshot',
} as const;

async function inject<Args extends unknown[], Result>(
  tabId: number,
  func: (...args: Args) => Result,
  args: Args,
): Promise<Awaited<Result>> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return injection?.result as Awaited<Result>;
}

export function createBrowserTools(ctx: BrowserToolsContext): BrowserTools {
  let last: Snapshot | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  // The AI SDK runs a step's tool calls concurrently; one page can only take
  // them one at a time (and the request also asks for parallel_tool_calls: false).
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  const snapshot = async (textChars = STEP_CHARS): Promise<Snapshot> => {
    last = await inject(ctx.tabId, snapshotPage, [MAX_ITEMS, textChars]);
    return last;
  };
  const item = (n: number) =>
    last?.items.find((candidate) => candidate.n === n);
  const currentUrl = async () => (await chrome.tabs.get(ctx.tabId)).url ?? '';
  // Not a policy check: chrome.scripting cannot inject anywhere but http(s),
  // so this turns a thrown injection error into something the model can act on.
  const assertAllowed = (url: string) => {
    if (injectable(url)) return;
    // The whole URL, not the host: the scheme is the reason, and `chrome://`
    // URLs have a hostname ("extensions") that would name it misleadingly.
    throw new Refusal(
      'host_blocked',
      `${url} is not an http or https page, so it cannot be driven.`,
      url,
    );
  };

  const fail = (tool: string, target: string, err: unknown): string => {
    if (err instanceof Refusal) {
      ctx.log({
        tool,
        target,
        ok: false,
        code: err.code,
        detail: err.message,
        host: err.host,
      });
    } else {
      const detail = err instanceof Error ? err.message : String(err);
      ctx.log({ tool, target, ok: false, detail });
    }
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  };

  interface Perform {
    tool: string;
    target: string;
    outcome: string;
    step: () => Promise<ActResult>;
    /** When set, the user is asked first. */
    confirmText?: string;
    signal?: AbortSignal;
    textChars?: number;
  }

  // Gate, act, settle, re-read, log — every acting tool goes through here.
  const perform = (p: Perform): Promise<string> =>
    serial(async () => {
      try {
        assertAllowed(await currentUrl());
        if (p.confirmText) {
          const ok = await ctx.confirm(p.confirmText, p.signal);
          if (!ok)
            throw new Refusal('declined', 'User declined. Ask how to proceed.');
        }
        const result = await p.step();
        if (!result.ok) {
          const message = result.error ?? 'Action failed.';
          if (/^Refused:/.test(message))
            throw new Refusal('refused', message.replace(/^Refused:\s*/, ''));
          throw new Error(message);
        }
        await settle(ctx.tabId);
        // A click or back may have left the allowed sites; never read what is there.
        assertAllowed(await currentUrl());
        const page = await snapshot(p.textChars);
        ctx.log({ tool: p.tool, target: p.target, ok: true });
        return `${p.outcome}\n\n${page.text}`;
      } catch (err) {
        return fail(p.tool, p.target, err);
      }
    });

  const tools: ToolSet = {
    click: tool({
      description: 'Click an element from the latest snapshot.',
      inputSchema: jsonSchema<{ element: number }>({
        type: 'object',
        properties: { element: ELEMENT },
        required: ['element'],
        additionalProperties: false,
      }),
      execute: ({ element }, { abortSignal }) => {
        const n = asElement(element);
        if (n === null)
          return Promise.resolve(
            'Error: element must be a number from the latest snapshot.',
          );
        const target = describeItem(n, item(n));
        return perform({
          tool: 'click',
          target,
          outcome: `Clicked ${target}.`,
          step: () => inject(ctx.tabId, actOnPage, [n, 'click', '', false]),
          confirmText: needsConfirm('click', item(n))
            ? `Click ${target} on "${last?.title ?? ''}"`
            : undefined,
          signal: abortSignal,
        });
      },
    }),
    type: tool({
      description:
        'Replace the content of a text field or editor from the latest snapshot with the given text. Set submit to true to press Enter afterwards. Never use it for passwords or payment details.',
      inputSchema: jsonSchema<{
        element: number;
        text: string;
        submit?: boolean;
      }>({
        type: 'object',
        properties: {
          element: ELEMENT,
          text: { type: 'string' },
          submit: {
            type: 'boolean',
            description: 'Press Enter / submit the form afterwards',
          },
        },
        required: ['element', 'text'],
        additionalProperties: false,
      }),
      execute: ({ element, text, submit }, { abortSignal }) => {
        const n = asElement(element);
        if (n === null)
          return Promise.resolve(
            'Error: element must be a number from the latest snapshot.',
          );
        const target = describeItem(n, item(n));
        const doSubmit = submit === true;
        return perform({
          tool: 'type',
          target,
          outcome: `Typed into ${target}${doSubmit ? ' and submitted' : ''}.`,
          step: () =>
            inject(ctx.tabId, actOnPage, [
              n,
              'type',
              String(text ?? ''),
              doSubmit,
            ]),
          confirmText: needsConfirm('type', item(n), doSubmit)
            ? `Type into ${target} and submit on "${last?.title ?? ''}"`
            : undefined,
          signal: abortSignal,
        });
      },
    }),
    select: tool({
      description:
        'Choose an option in a select element from the latest snapshot, by its value or label.',
      inputSchema: jsonSchema<{ element: number; value: string }>({
        type: 'object',
        properties: { element: ELEMENT, value: { type: 'string' } },
        required: ['element', 'value'],
        additionalProperties: false,
      }),
      execute: ({ element, value }) => {
        const n = asElement(element);
        if (n === null)
          return Promise.resolve(
            'Error: element must be a number from the latest snapshot.',
          );
        const target = describeItem(n, item(n));
        return perform({
          tool: 'select',
          target,
          outcome: `Selected "${String(value)}" in ${target}.`,
          step: () =>
            inject(ctx.tabId, actOnPage, [
              n,
              'select',
              String(value ?? ''),
              false,
            ]),
        });
      },
    }),
    scroll: tool({
      description:
        'Scroll the page up or down by most of a screen, or bring an element from the latest snapshot into view.',
      inputSchema: jsonSchema<{ direction?: 'up' | 'down'; element?: number }>({
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'] },
          element: ELEMENT,
        },
        additionalProperties: false,
      }),
      execute: ({ direction, element }) => {
        if (element !== undefined && element !== null) {
          const n = asElement(element);
          if (n === null)
            return Promise.resolve(
              'Error: element must be a number from the latest snapshot.',
            );
          const target = describeItem(n, item(n));
          return perform({
            tool: 'scroll',
            target,
            outcome: `Scrolled to ${target}.`,
            step: () => inject(ctx.tabId, actOnPage, [n, 'scroll', '', false]),
          });
        }
        const dir = direction === 'up' ? 'up' : 'down';
        return perform({
          tool: 'scroll',
          target: dir,
          outcome: `Scrolled ${dir}.`,
          step: () => inject(ctx.tabId, scrollPage, [dir]),
        });
      },
    }),
    navigate: tool({
      description:
        'Open a URL in the current tab. Only the allowed sites can be opened.',
      inputSchema: jsonSchema<{ url: string }>({
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http(s) URL' },
        },
        required: ['url'],
        additionalProperties: false,
      }),
      execute: ({ url }) => {
        const target = String(url ?? '');
        return serial(async () => {
          try {
            assertAllowed(target);
            await chrome.tabs.update(ctx.tabId, { url: target });
            await settle(ctx.tabId);
            assertAllowed(await currentUrl());
            const page = await snapshot();
            ctx.log({ tool: 'navigate', target, ok: true });
            return `Opened ${target}.\n\n${page.text}`;
          } catch (err) {
            return fail('navigate', target, err);
          }
        });
      },
    }),
    back: tool({
      description: 'Go back one page in the tab history.',
      inputSchema: NO_INPUT,
      execute: () =>
        perform({
          tool: 'back',
          target: '',
          outcome: 'Went back.',
          step: async () => {
            await chrome.tabs.goBack(ctx.tabId);
            return { ok: true };
          },
        }),
    }),
    read_page: tool({
      description: 'Read the current page again, with a longer text excerpt.',
      inputSchema: NO_INPUT,
      execute: () =>
        serial(async () => {
          try {
            assertAllowed(await currentUrl());
            const page = await snapshot(READ_PAGE_CHARS);
            ctx.log({ tool: 'read_page', target: '', ok: true });
            return page.text;
          } catch (err) {
            return fail('read_page', '', err);
          }
        }),
    }),
    wait: tool({
      description: `Wait up to ${MAX_WAIT_MS} ms for the page to change (for example while the user types a password), then read it again.`,
      inputSchema: jsonSchema<{ ms: number }>({
        type: 'object',
        properties: {
          ms: { type: 'integer', minimum: 0, maximum: MAX_WAIT_MS },
        },
        required: ['ms'],
        additionalProperties: false,
      }),
      execute: ({ ms }) => {
        const delay = Math.min(Math.max(Number(ms) || 0, 0), MAX_WAIT_MS);
        return serial(async () => {
          try {
            await sleep(delay);
            assertAllowed(await currentUrl());
            const page = await snapshot();
            ctx.log({ tool: 'wait', target: `${delay} ms`, ok: true });
            return `Waited ${delay} ms.\n\n${page.text}`;
          } catch (err) {
            return fail('wait', `${delay} ms`, err);
          }
        });
      },
    }),
  };

  return { tools, snapshot: () => serial(() => snapshot()) };
}
