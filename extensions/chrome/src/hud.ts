// What the user sees on the page itself while a run drives it: a brand ring
// around the viewport, a bar naming the action as it happens with a Stop in
// it, and a ring on the element about to be touched.
//
// The worker owns it from here; the page only paints. Keeping it on this side
// is what lets the bar say exactly what the panel's action list says, and what
// lets it come back by itself after a navigation.
import { t } from './i18n';
import {
  mountHud,
  removeHud,
  setHudHidden,
  type HudOptions,
} from './page-scripts';
import { markTab, unmarkTab, type TabMark } from './tab-group';

/**
 * The ibl.ai primary colour — the one the platform ships as an embed's default
 * `primary_color`. `panel.css` carries the same value for the side panel;
 * hud.test.ts holds the two together.
 */
export const BRAND = '#2467eb';

/** How often the overlay is re-asserted: its watchdog's heartbeat, and what puts it back after a navigation. */
export const BEAT_MS = 2000;
/** How long the overlay waits for a beat before taking itself off the page. */
export const WATCHDOG_MS = 15000;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Present tense, because the bar says what is happening, not what happened —
 * the panel's own list, which is written after the fact, keeps the past tense.
 */
const DOING: Record<string, string> = {
  click: 'hudClick',
  double_click: 'hudDoubleClick',
  type: 'hudType',
  select: 'hudSelect',
  scroll: 'hudScroll',
  navigate: 'hudNavigate',
  back: 'hudBack',
  read_page: 'hudReadPage',
  wait: 'hudWait',
};

/**
 * The tools that put something down on the page, so the pointer shows a press
 * where it lands. Typing is left out on purpose: the keyboard is not the
 * pointer, and a tap mark on a field the agent is typing into reads as a click
 * that never happened.
 */
const PRESSES = new Set(['click', 'double_click', 'select']);

/** `Clicking [12] button "Continue"`, or just the fallback when the tool has no wording of its own. */
export function doingLine(tool: string, target: string): string {
  const label = DOING[tool];
  if (!label) return t('hudWorking');
  return `${t(label)} ${target}`.trim();
}

export interface Hud {
  /** The action about to run, and the element it is on. */
  say(tool: string, target: string, rect?: Rect | null): void;
  /**
   * The action landed: show a press where the pointer is, if that tool presses.
   *
   * Separate from `say` because `say` runs BEFORE the confirmation card and
   * before the action executes — a declined, refused or failed click would
   * otherwise leave a press animating on a page where nothing was clicked.
   */
  pressed(tool: string): void;
  /** Between actions, while the model decides what is next. */
  thinking(): void;
  /** Runs `fn` with the bar out of the way, but only if it covers `point`. */
  dodge<T>(point: { x: number; y: number }, fn: () => Promise<T>): Promise<T>;
  /** Runs `fn` with the whole overlay hidden — what a capture needs. */
  away<T>(fn: () => Promise<T>): Promise<T>;
  /** Takes the overlay off the page and puts the tab back in the strip. */
  stop(): Promise<void>;
}

/**
 * Puts the overlay up on `tabId` and keeps it there until `stop()`.
 *
 * `goal` names the tab group in the strip, so two runs are told apart there.
 */
export function startHud(tabId: number, goal?: string | null): Hud {
  let stopped = false;
  let mark: TabMark | null = null;
  /** Whether the overlay has ever reached the page, and whether we have said why not. */
  let painted = false;
  let saidWhyNotPainted = false;
  const state: HudOptions = {
    color: BRAND,
    status: t('hudWorking'),
    stop: t('hudStop'),
    stopping: t('hudStopping'),
    label: t('hudLabel'),
    watchdogMs: WATCHDOG_MS,
    target: null,
  };

  const paint = async (): Promise<void> => {
    if (stopped) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        func: mountHud,
        args: [{ ...state }],
      });
      painted = true;
    } catch (err) {
      // Mid-navigation, or a page that cannot be injected into: the next beat
      // puts it back. The overlay is never a reason a run fails.
      //
      // Said once per run, and only while nothing has been painted yet: a beat
      // every BEAT_MS would otherwise fill the worker's console with the same
      // line, and a failure between two good paints is the ordinary kind. A
      // marker that never appears used to look exactly like a run that was
      // never started, which is a question only the user's eyes could answer.
      if (!painted && !saidWhyNotPainted) {
        saidWhyNotPainted = true;
        console.warn(
          '[ibl.ai panel] the on-page marker could not be put on this tab; the run continues without it:',
          err,
        );
      }
    }
  };

  const hidden = async (payload: {
    hidden: boolean;
    point?: { x: number; y: number } | null;
  }): Promise<boolean> => {
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        func: setHudHidden,
        args: [payload],
      });
      return injection?.result === true;
    } catch {
      return false;
    }
  };

  // The beat is three things at once: it keeps the page-side watchdog from
  // firing, it re-mounts the overlay a navigation took away, and it is what
  // makes a worker that dies mid-run leave no trace on the user's page.
  const beat = setInterval(() => void paint(), BEAT_MS);
  void paint();
  void markTab(tabId, goal).then((marked) => {
    // A run that ended while the marking was in flight must not leave the tab
    // grouped behind it.
    if (stopped) void unmarkTab(marked);
    else mark = marked;
  });

  const withHidden = async <T>(
    point: { x: number; y: number } | null,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const wasHidden = await hidden({ hidden: true, point });
    try {
      return await fn();
    } finally {
      if (wasHidden) await hidden({ hidden: false });
    }
  };

  return {
    say(tool, target, rect) {
      state.status = doingLine(tool, target);
      state.target = rect ?? null;
      void paint();
    },
    pressed(tool) {
      if (!state.target || !PRESSES.has(tool)) return;
      // Counted, not flagged: the heartbeat re-paints this same state, and a
      // standing flag would replay the press every beat.
      state.pressId = (state.pressId ?? 0) + 1;
      void paint();
    },
    thinking() {
      state.status = t('hudWorking');
      state.target = null;
      void paint();
    },
    dodge: (point, fn) => withHidden(point, fn),
    away: (fn) => withHidden(null, fn),
    async stop() {
      stopped = true;
      clearInterval(beat);
      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [0] },
          func: removeHud,
          args: [],
        });
      } catch {
        // The tab is gone, or navigated somewhere we cannot inject. The
        // page-side watchdog clears the overlay within WATCHDOG_MS either way.
      }
      await unmarkTab(mark);
      mark = null;
    },
  };
}
