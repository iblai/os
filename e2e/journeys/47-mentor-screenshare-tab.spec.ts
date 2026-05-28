import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 47 — Mentor Screen Share Tab.
 *
 * The Screen Share top-level tab is rendered by the SDK's
 * `AgentScreenShareTab` (`@iblai/iblai-js/web-containers/next`). It's
 * gated in the host by `call_configuration.enable_video`, which is the
 * same value the "Allow screen sharing on a call" toggle on the
 * Settings tab writes to.
 *
 * Selector policy:
 *   • The Settings toggle is reached via `editMentorPage.settings.enableVideoToggle`
 *     which resolves a stable `data-testid` ("settings-enable-video-switch").
 *   • The tab trigger in the sidebar is `[role="tab"][aria-controls="panel-screenshare"]`
 *     (host-rendered, unique).
 *   • The tab body, heading, save button, and disabled hint are SDK
 *     `data-testid`s exposed by `iblai-js`'s SCREENSHARE_LABELS helpers.
 *
 * No CSS class selectors anywhere — every locator survives style
 * refactors on either side.
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

  // SS-01: With screen sharing off in Settings, the Screen Share top-level
  // tab is hidden entirely from the sidebar.
  test('Screen Share tab is hidden when "Allow screen sharing on a call" is off', async ({
    editMentorPage,
  }) => {
    // Force the precondition: enable_video = false. The helper is a
    // no-op when already false, so we don't double-save fixtures that
    // already match.
    await editMentorPage.settings.setEnableVideoAndSave(false);

    await expect(editMentorPage.screenshare.tabLink).not.toBeVisible({
      timeout: 5_000,
    });

    await editMentorPage.close();
  });

  // SS-02: Flipping the Settings toggle on (+ Save) reveals the Screen
  // Share tab in the sidebar after the mentor-settings refetch
  // completes.
  test('enabling the Settings toggle reveals the Screen Share tab', async ({
    editMentorPage,
  }) => {
    const wasOn = await editMentorPage.settings.isEnableVideoEnabled();

    await editMentorPage.settings.setEnableVideoAndSave(true);

    await expect(editMentorPage.screenshare.tabLink).toBeVisible({
      timeout: 15_000,
    });

    // Restore so other tests run from a clean slate.
    if (!wasOn) {
      await editMentorPage.settings.setEnableVideoAndSave(false);
    }

    await editMentorPage.close();
  });

  // SS-03: Once the Screen Share tab is visible, navigating to it
  // renders the SDK-owned body (testid `screenshare-tab-body`).
  test('admin can switch to the Screen Share tab and sees the SDK body', async ({
    editMentorPage,
  }) => {
    const wasOn = await editMentorPage.settings.isEnableVideoEnabled();
    if (!wasOn) {
      await editMentorPage.settings.setEnableVideoAndSave(true);
    }

    await editMentorPage.screenshare.switchTo();
    await expect(editMentorPage.screenshare.heading).toBeVisible({
      timeout: 10_000,
    });

    // Restore.
    if (!wasOn) {
      await editMentorPage.navigateToTab('Settings');
      await editMentorPage.settings.setEnableVideoAndSave(false);
    }

    await editMentorPage.close();
  });
});
