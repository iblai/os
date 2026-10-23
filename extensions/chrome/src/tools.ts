import { jsonSchema, tool, type ToolSet } from 'ai';
import { drawBadges } from './badges';
import {
  actOnPage,
  scrollPage,
  snapshotPage,
  type ActResult,
  type FrameSnapshot,
  type SnapshotItem,
} from './page-scripts';
import type { RealInput } from './real-input';
import { SECRET_FIELDS } from './secret-fields';
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
  /** Capture the tab after every page read, numbers drawn on it. */
  withPicture?: boolean;
  /** Trusted mouse and keyboard input; absent means scripted events. */
  real?: RealInput;
}

/** The latest capture, with its pixels per CSS px, or why there is none this step. */
export type Picture = { dataUrl: string; scale: number } | { note: string };

export interface Snapshot {
  url: string;
  title: string;
  /** Every frame's items, renumbered into one sequence for the model. */
  items: SnapshotItem[];
  /** What the model reads: URL and title, one line per item, the frames' text. */
  text: string;
  /** The page's viewport in CSS px, the picture's own size once scaled. */
  viewport: { width: number; height: number };
}

/** Where a snapshot number lives: the frame, and the frame's own number for it. */
export interface FrameRef {
  frameId: number;
  n: number;
}

export interface BrowserTools {
  tools: ToolSet;
  /** The page as it is now; the first user turn carries it. */
  snapshot: () => Promise<Snapshot>;
  picture: () => Picture | null;
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

/** Element numbers are positive integers from the latest snapshot — digits sent as text count; anything else is refused. */
export function asElement(value: unknown): number | null {
  const n =
    typeof value === 'string' && /^\s*\d+\s*$/.test(value)
      ? Number(value)
      : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
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

const DOUBLE = {
  type: 'boolean',
  description:
    'Click twice: opens what one click only selects, like a file in a list or a cell to edit',
} as const;

/**
 * Merges the frames' snapshots into the one numbered list the model reads.
 * Frame 0 (the page itself) comes first, then subframes by id — Chrome returns
 * them in no particular order — and a subframe with nothing to act on
 * contributes nothing: hidden helper frames and tracking pixels would only add
 * their text as noise. The page always contributes its URL, title and text.
 *
 * ponytail: per-frame caps only (MAX_ITEMS and textChars each); a page with many
 * content iframes multiplies the snapshot — add a total budget if that shows up.
 */
export function mergeFrames(
  results: { frameId: number; result?: FrameSnapshot }[],
): { snapshot: Snapshot; targets: Map<number, FrameRef> } {
  const frames = results
    .filter((frame): frame is { frameId: number; result: FrameSnapshot } =>
      Boolean(frame.result),
    )
    .sort((a, b) => a.frameId - b.frameId);
  const [page] = frames;
  if (!page || page.frameId !== 0)
    throw new Error('The page returned no snapshot.');
  const targets = new Map<number, FrameRef>();
  const items: SnapshotItem[] = [];
  const excerpts: string[] = [];
  let dropped = 0;
  for (const { frameId, result } of frames) {
    if (frameId !== 0 && result.items.length === 0) continue;
    for (const item of result.items) {
      const n = items.length + 1;
      targets.set(n, { frameId, n: item.n });
      items.push({ ...item, n });
    }
    dropped += result.dropped ?? 0;
    if (result.excerpt) excerpts.push(result.excerpt);
  }
  const lines = items.map(
    (item) =>
      `[${item.n}] ${item.role} "${item.name}"${item.state ? ` (${item.state})` : ''}`,
  );
  // Said rather than silent: the model's own rule for a missing element is to scroll.
  if (dropped)
    lines.push(`(+${dropped} more elements off screen: scroll to list them)`);
  const { url, title, viewport } = page.result;
  const text = `${url}  "${title}"\n${lines.join('\n')}\n--- text ---\n${excerpts.join('\n\n')}`;
  return { snapshot: { url, title, items, text, viewport }, targets };
}

async function inject<Args extends unknown[], Result>(
  tabId: number,
  func: (...args: Args) => Result,
  args: Args,
  frameId = 0,
): Promise<Awaited<Result>> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func,
    args,
  });
  return injection?.result as Awaited<Result>;
}

/** Runs `func` in every frame of the tab the extension can reach, silently skipping the rest. */
function injectAll<Args extends unknown[], Result>(
  tabId: number,
  func: (...args: Args) => Result,
  args: Args,
) {
  return chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func,
    args,
  });
}

export function createBrowserTools(ctx: BrowserToolsContext): BrowserTools {
  let last: Snapshot | null = null;
  let targets = new Map<number, FrameRef>();
  let queue: Promise<unknown> = Promise.resolve();

  // The AI SDK runs a step's tool calls concurrently; one page can only take
  // them one at a time (and the request also asks for parallel_tool_calls: false).
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  let latest: Picture | null = null;

  // The viewport, with every listed number drawn on its element here in the
  // worker — nothing is added to the page, so nothing flashes. Captured as PNG:
  // `drawBadges` does the one JPEG encode. A page holding a password or payment
  // field is never captured: what is on it is the user's alone.
  const capture = async (): Promise<void> => {
    if (!ctx.withPicture || !last) return;
    if (last.items.some((item) => item.secret)) {
      latest = {
        note: '(no picture: this page has a password or payment field)',
      };
      return;
    }
    const tab = await chrome.tabs.get(ctx.tabId);
    if (!tab.active) {
      latest = { note: '(no picture: the tab is not in front)' };
      return;
    }
    try {
      const shot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
      });
      const marks = last.items.flatMap((item) =>
        item.rect ? [{ n: item.n, x: item.rect.x, y: item.rect.y }] : [],
      );
      latest = await drawBadges(shot, marks, last.viewport.width);
    } catch (err) {
      latest = {
        note: `(no picture: ${err instanceof Error ? err.message : String(err)})`,
      };
    }
  };

  const snapshot = async (textChars = STEP_CHARS): Promise<Snapshot> => {
    const merged = mergeFrames(
      await injectAll(ctx.tabId, snapshotPage, [
        MAX_ITEMS,
        textChars,
        SECRET_FIELDS,
      ]),
    );
    last = merged.snapshot;
    targets = merged.targets;
    await capture();
    return last;
  };
  const item = (n: number) =>
    last?.items.find((candidate) => candidate.n === n);
  // A number outside the snapshot goes to the page itself, whose own map
  // answers "not in the current snapshot" — the same error as ever.
  const ref = (n: number): FrameRef => targets.get(n) ?? { frameId: 0, n };
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

  // A refused number is a spent step: logged, so the user sees it too.
  const badElement = (tool: string): Promise<string> => {
    ctx.log({ tool, target: '', ok: false });
    return Promise.resolve(
      'Error: element must be a number from the latest snapshot.',
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
    /** The snapshot number the action is on, if any. */
    element?: number;
    /** Given where that number lives; frame 0 and no number without one. */
    step: (at: FrameRef) => Promise<ActResult>;
    /** When set, the user is asked first; a function looks at the page to decide (and may name the target then). */
    confirmText?: string | (() => Promise<string | undefined>);
    signal?: AbortSignal;
    textChars?: number;
  }

  // Gate, act, settle, re-read, log — every acting tool goes through here.
  const perform = (p: Perform): Promise<string> =>
    serial(async () => {
      try {
        assertAllowed(await currentUrl());
        const ask =
          typeof p.confirmText === 'function'
            ? await p.confirmText()
            : p.confirmText;
        if (ask) {
          const ok = await ctx.confirm(ask, p.signal);
          if (!ok)
            throw new Refusal('declined', 'User declined. Ask how to proceed.');
        }
        // Resolved now, not when the tool was called: the numbers belong to
        // whichever snapshot the queue ahead of this action left behind, which
        // is also what each frame's own map holds.
        const at =
          p.element === undefined ? { frameId: 0, n: 0 } : ref(p.element);
        const result = await p.step(at);
        if (!result.ok) {
          const message = result.error ?? 'Action failed.';
          if (/^Refused:/.test(message))
            throw new Refusal('refused', message.replace(/^Refused:\s*/, ''));
          throw new Error(message);
        }
        await settle(ctx.tabId, { frameId: at.frameId });
        // A click or back may have left the allowed sites; never read what is there.
        assertAllowed(await currentUrl());
        const page = await snapshot(p.textChars);
        ctx.log({ tool: p.tool, target: p.target, ok: true });
        return `${p.outcome}${result.note ? ` ${result.note}` : ''}\n\n${page.text}`;
      } catch (err) {
        return fail(p.tool, p.target, err);
      }
    });

  const tools: ToolSet = {
    click: tool({
      description: 'Click an element from the latest snapshot.',
      inputSchema: jsonSchema<{ element: number; double?: boolean }>({
        type: 'object',
        properties: { element: ELEMENT, double: DOUBLE },
        required: ['element'],
        additionalProperties: false,
      }),
      execute: ({ element, double }, { abortSignal }) => {
        const twice = double === true;
        const name = twice ? 'double_click' : 'click';
        const n = asElement(element);
        if (n === null) return badElement(name);
        const target = describeItem(n, item(n));
        const verb = twice ? 'Double-click' : 'Click';
        return perform({
          tool: name,
          target,
          outcome: `${verb}ed ${target}.`,
          element: n,
          // Trusted input lands by tab coordinates, which a cross-origin frame
          // cannot give, and on whatever is at the point.
          step: async (at) => {
            const scripted = () =>
              inject(
                ctx.tabId,
                actOnPage,
                [at.n, twice ? 'dblclick' : 'click', '', false],
                at.frameId,
              );
            if (!ctx.real) return scripted();
            const found = await inject(
              ctx.tabId,
              actOnPage,
              [at.n, 'locate', '', false],
              at.frameId,
            );
            if (!found.ok) return found;
            if (found.top && !found.covered) {
              await ctx.real.click(found.x ?? 0, found.y ?? 0, twice ? 2 : 1);
              return { ok: true };
            }
            const result = await scripted();
            return found.covered
              ? { ...result, note: '(something covers it, clicked directly)' }
              : result;
          },
          confirmText: needsConfirm('click', item(n))
            ? `${verb} ${target} on "${last?.title ?? ''}"`
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
        if (n === null) return badElement('type');
        const target = describeItem(n, item(n));
        const doSubmit = submit === true;
        const value = String(text ?? '');
        return perform({
          tool: 'type',
          target,
          outcome: `Typed into ${target}${doSubmit ? ' and submitted' : ''}.`,
          element: n,
          step: async (at) => {
            const scripted = () =>
              inject(
                ctx.tabId,
                actOnPage,
                [at.n, 'type', value, doSubmit, SECRET_FIELDS],
                at.frameId,
              );
            if (!ctx.real) return scripted();
            const ready = await inject(
              ctx.tabId,
              actOnPage,
              [at.n, 'prepare-type', '', false, SECRET_FIELDS],
              at.frameId,
            );
            if (!ready.ok) return ready;
            if (!ready.top) return scripted();
            await ctx.real.insertText(value);
            if (doSubmit) await ctx.real.pressEnter();
            return { ok: true };
          },
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
        if (n === null) return badElement('select');
        const target = describeItem(n, item(n));
        return perform({
          tool: 'select',
          target,
          outcome: `Selected "${String(value)}" in ${target}.`,
          element: n,
          step: (at) =>
            inject(
              ctx.tabId,
              actOnPage,
              [at.n, 'select', String(value ?? ''), false],
              at.frameId,
            ),
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
          if (n === null) return badElement('scroll');
          const target = describeItem(n, item(n));
          return perform({
            tool: 'scroll',
            target,
            outcome: `Scrolled to ${target}.`,
            element: n,
            step: (at) =>
              inject(
                ctx.tabId,
                actOnPage,
                [at.n, 'scroll', '', false],
                at.frameId,
              ),
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

  // With a picture, two more tools act on a point of it: what the model can
  // see but the list does not hold — past its cap, or in a cross-origin frame.
  const real = ctx.real;
  if (ctx.withPicture && real) {
    const PIXEL = {
      type: 'number',
      minimum: 0,
      description: 'Pixel position on the picture',
    } as const;
    const badPoint = (tool: string, reason: string): Promise<string> => {
      ctx.log({ tool, target: '', ok: false, detail: reason });
      return Promise.resolve(`Error: ${reason}`);
    };
    // The point in viewport CSS px, or why it cannot be used.
    const pointOf = (
      x: unknown,
      y: unknown,
    ): { x: number; y: number } | string => {
      if (!latest || !('dataUrl' in latest))
        return 'No picture this step; use an element number.';
      const px = Number(x);
      const py = Number(y);
      if (!Number.isFinite(px) || !Number.isFinite(py) || px < 0 || py < 0)
        return 'x and y must be pixel positions on the picture.';
      const point = { x: px / latest.scale, y: py / latest.scale };
      if (
        !last ||
        point.x > last.viewport.width ||
        point.y > last.viewport.height
      )
        return 'That point is outside the picture.';
      return point;
    };
    // What is at the point, named as the user would name it.
    const atPoint = async (point: { x: number; y: number }) =>
      (
        await inject(ctx.tabId, snapshotPage, [
          MAX_ITEMS,
          0,
          SECRET_FIELDS,
          point,
        ])
      )?.items[0];
    const describeAt = (
      hit: SnapshotItem | undefined,
      x: unknown,
      y: unknown,
    ) =>
      hit
        ? `${hit.role} "${hit.name}" at (${String(x)}, ${String(y)})`
        : `(${String(x)}, ${String(y)})`;

    tools.click_at = tool({
      description:
        'Click a point of the picture of the tab, given as x and y pixels on the picture: for something you can see but that is not in the list.',
      inputSchema: jsonSchema<{ x: number; y: number; double?: boolean }>({
        type: 'object',
        properties: { x: PIXEL, y: PIXEL, double: DOUBLE },
        required: ['x', 'y'],
        additionalProperties: false,
      }),
      execute: ({ x, y, double }, { abortSignal }) => {
        const twice = double === true;
        const name = twice ? 'double_click' : 'click';
        const verb = twice ? 'Double-click' : 'Click';
        const point = pointOf(x, y);
        if (typeof point === 'string') return badPoint(name, point);
        const p: Perform = {
          tool: name,
          target: describeAt(undefined, x, y),
          outcome: '',
          // Looked at before the confirmation, which needs the name.
          confirmText: async () => {
            const hit = await atPoint(point);
            p.target = describeAt(hit, x, y);
            p.outcome = `${verb}ed ${p.target}.`;
            return needsConfirm('click', hit)
              ? `${verb} ${p.target} on "${last?.title ?? ''}"`
              : undefined;
          },
          step: async () => {
            await real.click(point.x, point.y, twice ? 2 : 1);
            return { ok: true };
          },
          signal: abortSignal,
        };
        return perform(p);
      },
    });
    tools.type_at = tool({
      description:
        'Click a point of the picture and replace the text of the field that takes focus there with the given text. Set submit to true to press Enter afterwards. Never use it for passwords or payment details.',
      inputSchema: jsonSchema<{
        x: number;
        y: number;
        text: string;
        submit?: boolean;
      }>({
        type: 'object',
        properties: {
          x: PIXEL,
          y: PIXEL,
          text: { type: 'string' },
          submit: {
            type: 'boolean',
            description: 'Press Enter / submit the form afterwards',
          },
        },
        required: ['x', 'y', 'text'],
        additionalProperties: false,
      }),
      execute: ({ x, y, text, submit }, { abortSignal }) => {
        const point = pointOf(x, y);
        if (typeof point === 'string') return badPoint('type', point);
        const doSubmit = submit === true;
        const value = String(text ?? '');
        const p: Perform = {
          tool: 'type',
          target: describeAt(undefined, x, y),
          outcome: '',
          confirmText: async () => {
            const hit = await atPoint(point);
            p.target = describeAt(hit, x, y);
            p.outcome = `Typed into ${p.target}${doSubmit ? ' and submitted' : ''}.`;
            return needsConfirm('type', hit, doSubmit)
              ? `Type into ${p.target} and submit on "${last?.title ?? ''}"`
              : undefined;
          },
          // The click focuses the field; the frame holding the focus prepares
          // it, behind the secret-field refusal, and the text follows through
          // the protocol, which reaches a cross-origin frame too.
          step: async () => {
            await real.click(point.x, point.y);
            const answers = (
              await injectAll(ctx.tabId, actOnPage, [
                0,
                'prepare-type',
                '',
                false,
                SECRET_FIELDS,
              ])
            ).map((frame) => frame.result as ActResult | undefined);
            const refused = answers.find((a) =>
              /^Refused:/.test(a?.error ?? ''),
            );
            if (refused) return refused;
            if (!answers.some((a) => a?.ok))
              return {
                ok: false,
                error:
                  'Nothing at that point takes text; click a field first or use an element number.',
              };
            await real.insertText(value);
            if (doSubmit) await real.pressEnter();
            return { ok: true };
          },
          signal: abortSignal,
        };
        return perform(p);
      },
    });
  }

  return {
    tools,
    snapshot: () => serial(() => snapshot()),
    picture: () => latest,
  };
}
