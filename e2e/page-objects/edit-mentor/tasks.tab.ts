import { expect, Page, Locator } from '@playwright/test';
import {
  TASKS_LABELS,
  deleteTask,
  expectCompletedTasks,
  expectFailedTasks,
  expectTaskInList,
  expectTaskNotInList,
  expectTasksEmpty,
  expectTotalTasks,
  getScheduleTaskButton,
  getSearchInput,
  getTaskRow,
  isTasksTabVisible,
  openScheduleTaskDialog,
  scheduleTask,
  searchTasks,
  selectTaskInList,
  switchToTasksTab,
  type TaskRepeat,
} from '@iblai/iblai-js/playwright';

export type { TaskRepeat };

/**
 * Page object for the Tasks tab inside the Edit Mentor modal.
 *
 * The tab is rendered by the SDK's `AgentTasksTab`
 * (`@iblai/iblai-js/web-containers/next`). All DOM access goes through the
 * semantic helpers exported from `@iblai/iblai-js/playwright`, which resolve
 * elements via accessible names, placeholders and roles emitted by the SDK
 * — so a label change in the SDK is picked up via a single bump of
 * `@iblai/iblai-js` rather than rewriting selectors here.
 *
 * Sole exception: `scheduleTaskAhead`'s midnight-crossing branch drives the
 * schedule dialog's desktop calendar directly (the SDK exposes no helper
 * that can set the date). Its labels still come from `TASKS_LABELS`, but
 * the day-button and date-heading locators depend on the dialog's DOM
 * structure — re-verify that branch when bumping the SDK.
 *
 * The instance scopes every helper to the Edit Mentor `dialog` Locator so
 * that other portaled dialogs in the same page (e.g. an unrelated toast or
 * confirm dialog) cannot match by accident.
 */
export class TasksTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Default labels shipped with the SDK — handy when a test wants to assert
   * the exact heading/description text rather than going through a helper. */
  static readonly LABELS = TASKS_LABELS;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /** True when the Tasks tab is rendered (permission-gated tab guard). */
  isTabVisible(): Promise<boolean> {
    return isTasksTabVisible(this.page);
  }

  /** Click the Tasks tab inside the Edit Mentor modal. */
  switchToTab(): Promise<void> {
    return switchToTasksTab(this.page);
  }

  // ---------------------------------------------------------------------------
  // Toolbar / surface locators
  // ---------------------------------------------------------------------------

  scheduleTaskButton(): Locator {
    return getScheduleTaskButton(this.dialog);
  }

  searchInput(): Locator {
    return getSearchInput(this.dialog);
  }

  /** Heading and description live in the SDK panel and are matched by the
   * default `TASKS_LABELS` strings. The heading is resolved by its `heading`
   * role so it never clashes with the same-named sidebar `tab`. */
  heading(): Locator {
    return this.dialog.getByRole('heading', {
      name: TASKS_LABELS.headerTitle,
      exact: true,
    });
  }

  description(): Locator {
    return this.dialog.getByText('Configure automated tasks for your', {
      exact: false,
    });
  }

  taskRow(name: string): Locator {
    return getTaskRow(this.dialog, name);
  }

  /** Heading of a metric card — `total` | `completed` | `failed`. Resolved by
   * the `heading` role + `TASKS_LABELS` text so task-status badges sharing the
   * "Completed"/"Failed" wording are never matched. */
  metricHeading(which: 'total' | 'completed' | 'failed'): Locator {
    return this.dialog.getByRole('heading', {
      name: TASKS_LABELS.metrics[which],
      exact: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Schedule (create) flow
  // ---------------------------------------------------------------------------

  openScheduleDialog(): Promise<void> {
    return openScheduleTaskDialog(this.dialog);
  }

  /** The portaled Schedule Task dialog, identified by its Task Name field. */
  scheduleDialog(): Locator {
    return this.page.getByRole('dialog').filter({ has: this.taskNameField() });
  }

  /** Task Name input inside the schedule dialog (matched by placeholder). */
  taskNameField(): Locator {
    return this.page.getByPlaceholder(
      TASKS_LABELS.scheduleDialog.taskNamePlaceholder,
    );
  }

  /** Task Prompt input inside the schedule dialog (matched by placeholder). */
  taskPromptField(): Locator {
    return this.page.getByPlaceholder(
      TASKS_LABELS.scheduleDialog.taskPromptPlaceholder,
    );
  }

  /** Dismiss the schedule dialog via its Cancel button and wait for close. */
  async cancelScheduleDialog(): Promise<void> {
    await this.scheduleDialog()
      .getByRole('button', { name: TASKS_LABELS.scheduleDialog.cancel })
      .click();
  }

  scheduleTask(opts: {
    name: string;
    prompt?: string;
    time: string;
    repeat?: TaskRepeat;
    notifyByEmail?: boolean;
  }): Promise<void> {
    return scheduleTask(this.dialog, opts);
  }

  /**
   * Schedule a task `minutesAhead` minutes from now (default 120).
   *
   * The dialog's date defaults to today, so near midnight every remaining
   * same-day time is (about to be) in the past and the "Start time must be
   * in the future" validation keeps the submit button disabled. When the
   * target instant falls on a later calendar day, this picks that day in
   * the dialog calendar and fills the form field-by-field (the SDK's
   * one-shot `scheduleTask` cannot set a date); otherwise it defers to the
   * SDK helper unchanged.
   *
   * `minutesAhead` must stay within [90, 3 days]: the dialog resolves
   * DST-ambiguous fall-back wall times to the earlier offset (so up to an
   * hour of margin can vanish once a year), and the calendar path never
   * navigates months (the target must sit in the initially rendered grid —
   * current month plus at least 5 next-month spillover days).
   */
  async scheduleTaskAhead(opts: {
    name: string;
    prompt?: string;
    minutesAhead?: number;
    repeat?: TaskRepeat;
    notifyByEmail?: boolean;
  }): Promise<void> {
    const { minutesAhead = 120, ...task } = opts;
    if (minutesAhead < 90 || minutesAhead > 3 * 24 * 60) {
      throw new Error(
        `scheduleTaskAhead: minutesAhead must be within [90, ${3 * 24 * 60}] ` +
          `(DST fall-back margin / rendered-calendar reach); got ${minutesAhead}`,
      );
    }
    const now = new Date();
    const target = new Date(now.getTime() + minutesAhead * 60_000);
    const h = String(target.getHours()).padStart(2, '0');
    const m = String(target.getMinutes()).padStart(2, '0');
    const time = `${h}:${m}`;

    if (target.toDateString() === now.toDateString()) {
      return scheduleTask(this.dialog, { ...task, time });
    }

    await openScheduleTaskDialog(this.dialog);
    // Portaled dialog — resolved from the page by its aria-label, exactly
    // like the SDK's own (non-exported) getScheduleTaskDialog.
    const dialog = this.page.getByRole('dialog', {
      name: TASKS_LABELS.scheduleDialog.dialogName,
    });
    // The dialog's desktop calendar is a hand-rolled 42-cell grid of plain
    // buttons whose accessible name is just the day number; past days are
    // `disabled`. For a next-day target the first enabled exact match is
    // always the target: any earlier cell with the same number belongs to a
    // past month (disabled), and when today is the month's last day the
    // target "1" is the next month's spillover cell, which the grid always
    // shows.
    await dialog
      .getByRole('button', {
        name: String(target.getDate()),
        exact: true,
        disabled: false,
      })
      .first()
      .click();
    // The form panel's heading echoes the selected date ("July 4, 2026") —
    // assert the click landed on the right day before filling the form.
    await expect(
      dialog.getByRole('heading', {
        name: target.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        exact: true,
      }),
    ).toBeVisible({ timeout: 5_000 });
    await dialog
      .getByLabel(TASKS_LABELS.scheduleDialog.taskName)
      .fill(task.name);
    if (task.prompt !== undefined) {
      await dialog
        .getByLabel(TASKS_LABELS.scheduleDialog.taskPrompt)
        .fill(task.prompt);
    }
    await dialog.getByLabel(TASKS_LABELS.scheduleDialog.time).fill(time);
    if (task.repeat) {
      const repeatLabel = {
        "don't-repeat": TASKS_LABELS.scheduleDialog.dontRepeat,
        daily: TASKS_LABELS.scheduleDialog.daily,
        weekly: TASKS_LABELS.scheduleDialog.weekly,
        monthly: TASKS_LABELS.scheduleDialog.monthly,
      }[task.repeat];
      await dialog.getByLabel(TASKS_LABELS.scheduleDialog.repeat).click();
      // Radix renders the option list in a portal outside the dialog.
      await this.page.getByRole('option', { name: repeatLabel }).click();
    }
    if (task.notifyByEmail) {
      await dialog
        .getByLabel(TASKS_LABELS.scheduleDialog.notifyByEmail)
        .click();
    }
    const submit = dialog.getByRole('button', {
      name: TASKS_LABELS.scheduleDialog.schedule,
    });
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await submit.click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  searchTasks(query: string): Promise<void> {
    return searchTasks(this.dialog, query);
  }

  /** Clear the search input. The orchestrator debounces by 300 ms — assert on
   * row visibility afterwards. */
  clearSearch(): Promise<void> {
    return searchTasks(this.dialog, '');
  }

  // ---------------------------------------------------------------------------
  // Selection / logs
  // ---------------------------------------------------------------------------

  selectTaskInList(name: string): Promise<void> {
    return selectTaskInList(this.dialog, name);
  }

  // ---------------------------------------------------------------------------
  // Delete flow
  // ---------------------------------------------------------------------------

  deleteTask(name: string): Promise<void> {
    return deleteTask(this.dialog, name);
  }

  // ---------------------------------------------------------------------------
  // Assertions
  // ---------------------------------------------------------------------------

  expectTaskInList(name: string): Promise<void> {
    return expectTaskInList(this.dialog, name);
  }

  expectTaskNotInList(name: string): Promise<void> {
    return expectTaskNotInList(this.dialog, name);
  }

  expectTasksEmpty(): Promise<void> {
    return expectTasksEmpty(this.dialog);
  }

  expectTotalTasks(n: number): Promise<void> {
    return expectTotalTasks(this.dialog, n);
  }

  expectCompletedTasks(n: number): Promise<void> {
    return expectCompletedTasks(this.dialog, n);
  }

  expectFailedTasks(n: number): Promise<void> {
    return expectFailedTasks(this.dialog, n);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /** A task name unlikely to collide across parallel workers or retries. */
  static uniqueTaskName(prefix = 'e2e-task'): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${ts}-${rand}`;
  }
}
