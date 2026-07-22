import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 48 — Mentor Screen Share Tab.
 *
 * The Screen Share top-level tab is rendered by the SDK's
 * `AgentScreenShareTab` (`@iblai/iblai-js/web-containers/next`).
 *
 * ── Capability-gate refactor ─────────────────────────────────────────────
 *
 * The "Enable screen sharing" (`enable_video`) toggle used to live on the
 * Settings tab (`settings-enable-video-switch`) and gate the Screen Share
 * top-level tab's visibility. It now lives inline at the top of the Screen
 * Share tab itself via the shared `CapabilityGate` component
 * (`data-testid="screenshare-capability-toggle"`), and
 * `hooks/use-mentor-segments.ts` no longer gates the segment at all — the
 * tab is ALWAYS mounted. The two screensharing prompts render inside a
 * grayed + inert `data-testid="capability-gate-content"` wrapper while the
 * toggle is off; editing them is a separate, still-Save-button-driven flow
 * that requires the capability to be on first.
 *
 * Selector policy:
 *   • The capability toggle is reached via `editMentorPage.screenshare.capabilityToggle`
 *     (`data-testid="screenshare-capability-toggle"`).
 *   • The tab trigger in the sidebar is `[role="tab"][aria-controls="panel-screenshare"]`
 *     (host-rendered, unique).
 *   • The tab body, heading, save button, and off-hint are SDK
 *     `data-testid`s exposed by `iblai-js`'s SCREENSHARE_LABELS helpers and
 *     the shared `CapabilityGate`.
 *
 * No CSS class selectors anywhere — every locator survives style
 * refactors on either side.
 */
test.describe('Journey 48: Mentor Screen Share Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Screen share tab requires admin access');
      return;
    }
    // Screen Share is always mounted now — open straight to it.
    await editMentorPage.open('Screen Share');
    await waitForPageReady(page);
  });

  // SS-01: Screen Share tab stays visible even when "Enable screen sharing"
  // is off — only the gated content grays.
  test('Screen Share tab stays visible and its content grays when "Enable screen sharing" is off', async ({
    editMentorPage,
  }) => {
    const wasOn = await editMentorPage.screenshare.isCapabilityEnabled();

    await editMentorPage.screenshare.setCapabilityEnabled(false);

    await expect(editMentorPage.screenshare.tabLink).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.screenshare.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );
    await editMentorPage.screenshare.expectDisabledHint(true);

    // Restore.
    if (wasOn) {
      await editMentorPage.screenshare.setCapabilityEnabled(true);
    }

    await editMentorPage.close();
  });

  // SS-02: Enabling the capability toggle ungates the prompt cards.
  test('enabling the capability toggle ungates the screensharing prompt cards', async ({
    editMentorPage,
  }) => {
    const wasOn = await editMentorPage.screenshare.isCapabilityEnabled();

    await editMentorPage.screenshare.setCapabilityEnabled(true);

    await expect(editMentorPage.screenshare.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 15_000 },
    );
    await editMentorPage.screenshare.expectDisabledHint(false);

    // Restore so other tests run from a clean slate.
    if (!wasOn) {
      await editMentorPage.screenshare.setCapabilityEnabled(false);
    }

    await editMentorPage.close();
  });

  // SS-03: The Screen Share tab renders the SDK-owned body and heading
  // regardless of the capability's on/off state (it's grayed, not
  // unmounted, when off).
  test('admin can switch to the Screen Share tab and sees the SDK body', async ({
    editMentorPage,
  }) => {
    await editMentorPage.screenshare.switchTo();
    await expect(editMentorPage.screenshare.heading).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.screenshare.capabilityToggle).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });
});
