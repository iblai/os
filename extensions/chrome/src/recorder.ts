// Turns what a person did on a page into steps a skill can be written from.
// The watcher in page-scripts.ts names each element; everything here is about
// which of those events are worth keeping.
import type { RecordedEvent } from './page-scripts';

export interface RecordedStep {
  tool: 'click' | 'type' | 'select' | 'navigate' | 'switch-tab';
  target: { role: string; name: string };
  /**
   * What was typed, for the review screen to offer back. Held for the session
   * only — a value is written into a skill when the person keeps it, never
   * because it was captured. Absent for a secret field, which is never read.
   */
  value?: string;
  url: string;
  /** Where a step that caused one ended up; rule 4 attaches it here. */
  outcomeUrl?: string;
  frameUrl?: string;
  /** Set when the element could not be named, so review can ask. */
  unnamed?: boolean;
}

/** A tab the recording is following, named for the step that moves to it. */
export interface RecordedTab {
  id: number;
  title?: string;
  url?: string;
}

/** How long after a click a navigation still counts as that click's doing. */
export const NAVIGATION_WINDOW_MS = 1500;

const TYPED_ROLES = ['textbox', 'searchbox'];

function named(event: RecordedEvent): {
  target: { role: string; name: string };
  unnamed?: boolean;
} {
  const name = event.name?.trim();
  if (name) return { target: { role: event.role, name } };
  return { target: { role: event.role, name: '' }, unnamed: true };
}

/**
 * One recording. Events arrive from every frame of the tab and in the order
 * the person caused them; `steps()` is what review is shown.
 */
export class Recording {
  private kept: RecordedStep[] = [];
  private typing: RecordedStep | null = null;
  private lastClickAt = 0;
  private current: number | null = null;

  /**
   * The person moved to another tab, so the recording follows.
   *
   * A step for it only when something was recorded on the tab they left:
   * opening a tab and coming straight back is not a step anyone would write
   * down, and a skill that says "switch tabs" twice for nothing is noise.
   */
  switchedTo(tab: RecordedTab, at: number): void {
    if (this.current === tab.id) return;
    this.flushTyping();
    const first = this.current === null;
    this.current = tab.id;
    if (first || !this.kept.length) return;
    this.kept.push({
      tool: 'switch-tab',
      target: { role: 'tab', name: tab.title || hostOf(tab.url ?? '') },
      url: tab.url ?? '',
    });
    this.lastClickAt = at;
  }

  add(event: RecordedEvent, at: number): void {
    if (event.kind === 'input' || event.kind === 'change') {
      this.typed(event);
      return;
    }
    this.flushTyping();
    if (event.kind === 'submit') {
      this.push({ tool: 'click', ...named(event), url: event.url }, event);
      return;
    }
    this.lastClickAt = at;
    this.push({ tool: 'click', ...named(event), url: event.url }, event);
  }

  /**
   * A navigation belongs to the click that caused it, not to the recording.
   * Outside the window it is the person going somewhere themselves, which is
   * a step of its own.
   */
  navigated(url: string, at: number, title = ''): void {
    this.flushTyping();
    const last = this.kept[this.kept.length - 1];
    if (
      last &&
      last.tool === 'click' &&
      at - this.lastClickAt <= NAVIGATION_WINDOW_MS
    ) {
      last.outcomeUrl = url;
      return;
    }
    this.kept.push({
      tool: 'navigate',
      target: { role: 'page', name: title || hostOf(url) },
      url,
    });
  }

  /** Review sees this; the last thing typed is only here once it has settled. */
  steps(): RecordedStep[] {
    this.flushTyping();
    return this.kept.map((step) => ({ ...step }));
  }

  private typed(event: RecordedEvent): void {
    const tool = TYPED_ROLES.includes(event.role) ? 'type' : 'select';
    const step: RecordedStep = {
      tool,
      ...named(event),
      url: event.url,
      ...(event.frameUrl ? { frameUrl: event.frameUrl } : {}),
      ...(event.secret || event.value === undefined
        ? {}
        : { value: event.value }),
    };
    // Typing into the same field again replaces what it held: a person
    // correcting themselves is one step, not two.
    if (
      this.typing &&
      this.typing.tool === tool &&
      this.typing.target.name === step.target.name &&
      this.typing.target.role === step.target.role
    ) {
      this.typing = step;
      return;
    }
    this.flushTyping();
    this.typing = step;
  }

  private flushTyping(): void {
    if (!this.typing) return;
    this.kept.push(this.typing);
    this.typing = null;
  }

  private push(step: RecordedStep, event: RecordedEvent): void {
    if (event.frameUrl) step.frameUrl = event.frameUrl;
    this.kept.push(step);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * The steps as a person reads them, which is also what the skill's playbook is
 * written from. A value appears only when review kept it.
 */
export function describeStep(step: RecordedStep): string {
  const what = step.target.name
    ? `${step.target.role} "${step.target.name}"`
    : step.target.role;
  switch (step.tool) {
    case 'switch-tab':
      return step.target.name
        ? `Switch to the tab showing ${step.target.name}`
        : 'Switch to the other tab';
    case 'navigate':
      return `Go to ${step.url}`;
    case 'type':
      return step.value
        ? `Type "${step.value}" into the ${what}`
        : `Type into the ${what}`;
    case 'select':
      return step.value
        ? `Choose "${step.value}" in the ${what}`
        : `Choose in the ${what}`;
    default:
      return `Click the ${what}`;
  }
}
