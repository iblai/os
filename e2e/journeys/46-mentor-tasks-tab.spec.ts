import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 46: Mentor Tasks Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Tasks tab requires admin access');
      return;
    }
    await editMentorPage.open('Tasks');
    await waitForPageReady(page);
  });

  // TA-01: Tasks tab is visible in the modal sidebar
  test('admin sees the Tasks tab label in the sidebar', async ({
    editMentorPage,
  }) => {
    const tasksTab = editMentorPage.dialog.getByRole('tab', {
      name: 'Tasks',
    });
    await expect(tasksTab).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  // TA-02: Tasks header and description render
  test('admin opens the Tasks tab and sees the heading and description', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.tasks.heading).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.tasks.description).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // TA-03: Toolbar exposes the search input and Schedule Task button
  test('admin sees the task search input and the Schedule Task button', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.tasks.searchInput).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.tasks.scheduleTaskButton).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // TA-04: Metric cards render
  test('admin sees the Total Tasks, Active and Inactive metric cards', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.tasks.totalMetric).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.tasks.activeMetric).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.tasks.inactiveMetric).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // TA-05: Schedule Task dialog opens with its fields and Cancel closes it
  test('opening the Schedule Task dialog reveals the name/prompt fields and Cancel dismisses it without persisting', async ({
    editMentorPage,
  }) => {
    await editMentorPage.tasks.openScheduleDialog();

    await expect(editMentorPage.tasks.taskNameInput).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.tasks.taskPromptInput).toBeVisible({
      timeout: 5_000,
    });

    // Cancel closes the dialog and creates nothing (idempotent for the suite).
    await editMentorPage.tasks.cancelScheduleDialog();
    await expect(editMentorPage.tasks.taskNameInput).not.toBeVisible({
      timeout: 5_000,
    });

    await editMentorPage.close();
  });
});
