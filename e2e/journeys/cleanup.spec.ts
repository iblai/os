import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { E2E_MENTOR_RE } from '../utils/mentor-sweeper';

/**
 * Post-suite cleanup: deletes test mentors created during the test run.
 * This is NOT a user journey — it is infrastructure cleanup.
 * Original: cleanup.mentornextjs.cleanup.ts
 *
 * SAFETY: Only deletes the currently-loaded mentor if its name matches the
 * timestamped E2E pattern (e.g. "E2E Mentor 1720000000000"). This prevents
 * accidentally removing seed/default mentors that don't carry a timestamp.
 */
test.describe('Cleanup: Delete test mentors', () => {
  test('admin goes to mentor settings and deletes test mentors created during the test run', async ({
    page,
    editMentorPage,
  }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Cleanup requires admin access');

    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Navigate to the Basic sub-tab to read the mentor's name from the name
    // input field — this is the authoritative source of the currently loaded
    // mentor's identity.
    await editMentorPage.settings.selectSubTab('Basic');
    const nameInput = editMentorPage.dialog.getByRole('textbox', {
      name: /name/i,
    });
    let mentorName = '';
    try {
      await nameInput.waitFor({ state: 'visible', timeout: 10_000 });
      mentorName = (await nameInput.inputValue()) ?? '';
    } catch {
      // Name input not visible — cannot determine mentor identity; skip deletion.
      return;
    }

    // SAFETY GUARD: only delete if the name matches the E2E timestamped pattern.
    if (!E2E_MENTOR_RE.test(mentorName)) {
      return;
    }

    const deleteBtn = editMentorPage.settings.deleteButton;
    let deleteBtnVisible = false;
    try {
      await deleteBtn.waitFor({ state: 'visible', timeout: 5_000 });
      deleteBtnVisible = true;
    } catch {
      deleteBtnVisible = false;
    }
    if (!deleteBtnVisible) return;

    await editMentorPage.settings.deleteMentor();
    await expect(page).toHaveURL(/\/platform\//, { timeout: 15_000 });
  });
});
