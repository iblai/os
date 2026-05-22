import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { TasksTab } from '../page-objects/edit-mentor/tasks.tab';

/**
 * Journey 46 — Mentor Tasks Tab.
 *
 * The Tasks tab is the local `TasksTab` wrapper around the SDK's
 * `AgentTasksTab` (`@iblai/iblai-js/web-containers/next`). All task
 * interactions go through the semantic helpers exported from
 * `@iblai/iblai-js/playwright` (via the `TasksTab` page object), so the specs
 * stay decoupled from the SDK's DOM structure.
 *
 * The lifecycle specs (TA-06..TA-08) each create their own uniquely-named
 * periodic agent and delete it in a `finally` block, so every spec is
 * independent, retry-safe and leaves no orphaned tasks on the mentor.
 */
test.describe('Journey 46: Mentor Tasks Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Tasks tab requires admin access');
      return;
    }
    await editMentorPage.open();
    // SDK helper: clicks the Tasks tab and waits for the toolbar to be ready.
    await editMentorPage.tasks.switchToTab();
    await waitForPageReady(page);
  });

  // TA-01: Tasks tab is visible in the modal sidebar
  test('admin sees the Tasks tab label in the sidebar', async ({
    editMentorPage,
  }) => {
    expect(await editMentorPage.tasks.isTabVisible()).toBe(true);

    const tasksTab = editMentorPage.dialog.getByRole('tab', {
      name: TasksTab.LABELS.tabName,
    });
    await expect(tasksTab).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  // TA-02: Tasks header and description render
  test('admin opens the Tasks tab and sees the heading and description', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.tasks.heading()).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.tasks.description()).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // TA-03: Toolbar exposes the search input and Schedule Task button
  test('admin sees the task search input and the Schedule Task button', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.tasks.searchInput()).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.tasks.scheduleTaskButton()).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // TA-04: Metric cards render
  test('admin sees the Total Tasks, Completed and Failed metric cards', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.tasks.metricHeading('total')).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.tasks.metricHeading('completed')).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.tasks.metricHeading('failed')).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // TA-05: Schedule Task dialog opens with its fields and Cancel dismisses it
  test('opening the Schedule Task dialog reveals the name/prompt fields and Cancel dismisses it without persisting', async ({
    editMentorPage,
  }) => {
    const { tasks } = editMentorPage;

    await tasks.openScheduleDialog();
    await expect(tasks.taskNameField()).toBeVisible({ timeout: 10_000 });
    await expect(tasks.taskPromptField()).toBeVisible({ timeout: 5_000 });

    // Cancel closes the dialog and creates nothing (idempotent for the suite).
    await tasks.cancelScheduleDialog();
    await expect(tasks.taskNameField()).not.toBeVisible({ timeout: 5_000 });

    await editMentorPage.close();
  });

  // TA-06: Admin schedules a new task and it appears in the list
  test('admin schedules a new daily task and it appears in the task list', async ({
    editMentorPage,
  }) => {
    const { tasks } = editMentorPage;
    const name = TasksTab.uniqueTaskName('e2e-create');

    try {
      await tasks.scheduleTask({
        name,
        prompt: 'Summarise the latest mentor activity.',
        time: TasksTab.futureTimeOfDay(120),
        repeat: 'daily',
      });

      await tasks.expectTaskInList(name);
    } finally {
      // Clean up so the spec leaves no orphaned periodic agent behind.
      await tasks.deleteTask(name).catch(() => {});
    }

    await editMentorPage.close();
  });

  // TA-07: Searching filters the task list
  test('searching filters the task list — a matching query keeps the task, a non-matching query hides it', async ({
    editMentorPage,
  }) => {
    const { tasks } = editMentorPage;
    const name = TasksTab.uniqueTaskName('e2e-search');

    try {
      await tasks.scheduleTask({
        name,
        prompt: 'Search probe task.',
        time: TasksTab.futureTimeOfDay(120),
        repeat: 'daily',
      });
      await tasks.expectTaskInList(name);

      // A query that matches the task name keeps the row visible.
      await tasks.searchTasks(name);
      await tasks.expectTaskInList(name);

      // A query that matches nothing filters the row out.
      await tasks.searchTasks('zzz-no-such-task-zzz');
      await tasks.expectTaskNotInList(name);

      // Clearing the search restores the row.
      await tasks.clearSearch();
      await tasks.expectTaskInList(name);
    } finally {
      await tasks.clearSearch().catch(() => {});
      await tasks.deleteTask(name).catch(() => {});
    }

    await editMentorPage.close();
  });

  // TA-08: Admin deletes a task and the row is removed
  test('admin deletes a task and the row is removed from the list', async ({
    editMentorPage,
  }) => {
    const { tasks } = editMentorPage;
    const name = TasksTab.uniqueTaskName('e2e-delete');
    let stillPresent = false;

    try {
      await tasks.scheduleTask({
        name,
        prompt: 'Delete probe task.',
        time: TasksTab.futureTimeOfDay(120),
        repeat: 'daily',
      });
      stillPresent = true;
      await tasks.expectTaskInList(name);

      await tasks.deleteTask(name);
      await tasks.expectTaskNotInList(name);
      stillPresent = false;
    } finally {
      // Only needed if the delete assertion above never ran (e.g. create
      // succeeded but a later step threw before the row was removed).
      if (stillPresent) {
        await tasks.deleteTask(name).catch(() => {});
      }
    }

    await editMentorPage.close();
  });
});
