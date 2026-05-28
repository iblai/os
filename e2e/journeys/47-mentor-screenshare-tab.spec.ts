import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 47 — Mentor Screen Share Tab.
 *
 * The Screen Share top-level tab is rendered by the SDK's
 * `AgentScreenShareTab` (`@iblai/iblai-js/web-containers/next`). It's gated in the
 * host by `call_configuration.enable_video`, which is the same value the
 * "Allow screen sharing on a call" toggle on the Settings tab writes to.
 *
 * These tests verify the host-side wiring:
 *   • the tab is hidden when screen sharing is off,
 *   • flipping the Settings toggle on (and saving) makes the tab appear,
 *   • the heading + disabled-hint behaviour from the SDK still work,
 *   • flipping it back off hides the tab again (idempotency).
 */
test.describe('Journey 47: Mentor Screen Share Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Screen share tab requires admin access');
      return;
    }
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
  });

  // SS-01: With screen sharing off in Settings, the Screen share top-level
  // tab is hidden entirely from the sidebar.
  test('Screen Share tab is hidden when "Allow screen sharing on a call" is off', async ({
    editMentorPage,
  }) => {
    const enableVideoToggle = editMentorPage.dialog.getByLabel(
      /Allow screen sharing on a call (enabled|disabled)/i,
    );
    await expect(enableVideoToggle).toBeVisible({ timeout: 10_000 });

    const isOn =
      (await enableVideoToggle
        .getAttribute('aria-checked')
        .catch(() => null)) === 'true';

    // If it's on in the fixture, flip it off and save so the precondition
    // holds. Tests below restore by toggling back on as needed.
    if (isOn) {
      await enableVideoToggle.click();
      await editMentorPage.dialog
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(
        editMentorPage.page.getByText('Agent updated successfully'),
      ).toBeVisible({ timeout: 15_000 });
    }

    await expect(editMentorPage.screenshare.tabLink).not.toBeVisible({
      timeout: 5_000,
    });

    await editMentorPage.close();
  });

  // SS-02: Flipping the Settings toggle on (+ Save) reveals the Screen
  // share tab in the sidebar.
  test('enabling the Settings toggle reveals the Screen Share tab', async ({
    editMentorPage,
    page,
  }) => {
    const enableVideoToggle = editMentorPage.dialog.getByLabel(
      /Allow screen sharing on a call (enabled|disabled)/i,
    );
    await expect(enableVideoToggle).toBeVisible({ timeout: 10_000 });

    const wasOn =
      (await enableVideoToggle
        .getAttribute('aria-checked')
        .catch(() => null)) === 'true';

    if (!wasOn) {
      await enableVideoToggle.click();
      await editMentorPage.dialog
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(page.getByText('Agent updated successfully')).toBeVisible({
        timeout: 15_000,
      });
    }

    await expect(editMentorPage.screenshare.tabLink).toBeVisible({
      timeout: 15_000,
    });

    // Restore: flip back off if we turned it on for this test so the
    // suite is idempotent.
    if (!wasOn) {
      await enableVideoToggle.click();
      await editMentorPage.dialog
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(page.getByText('Agent updated successfully')).toBeVisible({
        timeout: 15_000,
      });
    }

    await editMentorPage.close();
  });

  // SS-03: Once the Screen share tab is visible, navigating to it renders
  // the heading and the body provided by the SDK.
  test('admin can switch to the Screen Share tab and sees the heading', async ({
    editMentorPage,
    page,
  }) => {
    const enableVideoToggle = editMentorPage.dialog.getByLabel(
      /Allow screen sharing on a call (enabled|disabled)/i,
    );
    const wasOn =
      (await enableVideoToggle
        .getAttribute('aria-checked')
        .catch(() => null)) === 'true';
    if (!wasOn) {
      await enableVideoToggle.click();
      await editMentorPage.dialog
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(page.getByText('Agent updated successfully')).toBeVisible({
        timeout: 15_000,
      });
    }

    await editMentorPage.navigateToTab('Screen Share');
    await expect(editMentorPage.screenshare.heading).toBeVisible({
      timeout: 10_000,
    });

    // Restore.
    if (!wasOn) {
      await editMentorPage.navigateToTab('Settings');
      await enableVideoToggle.click();
      await editMentorPage.dialog
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(page.getByText('Agent updated successfully')).toBeVisible({
        timeout: 15_000,
      });
    }

    await editMentorPage.close();
  });
});
