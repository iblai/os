import { Page, Locator, expect } from '@playwright/test';
import { reliableClick } from '../../utils/resilient';

/**
 * Page object for the Tasks tab inside the Edit Mentor modal.
 *
 * The tab is rendered by the SDK's `AgentTasksTab` component
 * (`@iblai/iblai-js/web-containers/next`), wrapped locally in an
 * `AgentSettingsProvider` so it can read tenant/mentor/username.
 *
 * All selectors target the default strings in `AGENT_TASKS_TAB_LABELS`.
 * If labels are overridden via the `labels` prop, update the locators here
 * to match.
 */
export class TasksTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** "Tasks" heading rendered at the top of the tab panel (lg+ only). */
  readonly heading: Locator;
  /** Description line below the heading. */
  readonly description: Locator;
  /** Toolbar search input — `toolbar.searchPlaceholder`. */
  readonly searchInput: Locator;
  /** Toolbar "Schedule Task" button that opens the schedule dialog. */
  readonly scheduleTaskButton: Locator;
  /** "Total Tasks" metric card heading. */
  readonly totalMetric: Locator;
  /** "Active" metric card heading. */
  readonly activeMetric: Locator;
  /** "Inactive" metric card heading. */
  readonly inactiveMetric: Locator;

  /** The portaled Schedule Task dialog (separate from the Edit Agent modal). */
  readonly scheduleDialog: Locator;
  /** Task Name input inside the schedule dialog. */
  readonly taskNameInput: Locator;
  /** Task Prompt input inside the schedule dialog. */
  readonly taskPromptInput: Locator;
  /** Cancel button inside the schedule dialog. */
  readonly scheduleCancelButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.heading = dialog.getByRole('heading', { name: 'Tasks', exact: true });
    this.description = dialog.getByText(
      /Configure automated tasks for your mentor\./i,
    );
    this.searchInput = dialog.getByPlaceholder('Search all tasks...');
    this.scheduleTaskButton = dialog
      .getByRole('button', { name: 'Schedule Task' })
      .first();
    this.totalMetric = dialog.getByRole('heading', {
      name: 'Total Tasks',
      exact: true,
    });
    this.activeMetric = dialog.getByRole('heading', {
      name: 'Active',
      exact: true,
    });
    this.inactiveMetric = dialog.getByRole('heading', {
      name: 'Inactive',
      exact: true,
    });

    this.taskNameInput = page.getByPlaceholder('Enter task name');
    this.taskPromptInput = page.getByPlaceholder('Enter task prompt');
    this.scheduleDialog = page
      .getByRole('dialog')
      .filter({ has: this.taskNameInput });
    this.scheduleCancelButton = this.scheduleDialog.getByRole('button', {
      name: 'Cancel',
    });
  }

  /** Opens the Schedule Task dialog from the toolbar and waits for it. */
  async openScheduleDialog(): Promise<void> {
    await reliableClick(this.page, this.scheduleTaskButton);
    await expect(this.taskNameInput).toBeVisible({ timeout: 10_000 });
  }

  /** Cancels the Schedule Task dialog and waits for it to close. */
  async cancelScheduleDialog(): Promise<void> {
    await reliableClick(this.page, this.scheduleCancelButton);
    await expect(this.taskNameInput).not.toBeVisible({ timeout: 5_000 });
  }
}
