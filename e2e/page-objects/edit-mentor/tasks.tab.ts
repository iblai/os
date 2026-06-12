import { Page, Locator } from '@playwright/test';
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
    return this.dialog.getByText(TASKS_LABELS.headerDescription, {
      exact: true,
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

  /**
   * Returns "HH:mm" for `minutesAhead` minutes from now, clamped to today so
   * the schedule dialog does not reject it as past. When the computed time
   * would roll over midnight, returns "23:55" instead.
   */
  static futureTimeOfDay(minutesAhead = 60): string {
    const now = new Date();
    const target = new Date(now.getTime() + minutesAhead * 60 * 1000);
    if (target.getDate() !== now.getDate()) {
      return '23:55';
    }
    const h = String(target.getHours()).padStart(2, '0');
    const m = String(target.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}
