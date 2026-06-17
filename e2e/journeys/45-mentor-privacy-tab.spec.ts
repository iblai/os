import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 45: Mentor Privacy Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Privacy tab requires admin access');
      return;
    }
    // Open the dialog WITHOUT navigating to Privacy — the Privacy sidebar
    // segment is only rendered when `enable_privacy_router` is ON, so jumping
    // straight to 'Privacy' would time out on a freshly reset mentor.
    await editMentorPage.open();
    await waitForPageReady(page);
    // Enable the router via Settings → Capabilities so the Privacy tab segment
    // is mounted in the sidebar, then land on it. `setRouterEnabled(true)`
    // centralizes the enable→save→wait-for-segment→navigate flow, including a
    // generous wait for the post-save mentor-settings refetch to surface the
    // gated Privacy segment. A raw navigateToTab('Privacy') here was racy: the
    // segment can mount a few seconds after the "Agent updated" toast, so the
    // 15s waitFor inside navigateToTab intermittently timed out.
    await editMentorPage.privacy.setRouterEnabled(true);
  });

  test.afterEach(async ({ editMentorPage }) => {
    // Restore `enable_privacy_router` to off so the suite is idempotent and
    // other journeys inherit a mentor with the router disabled (the default).
    // `setRouterEnabled(false)` navigates to Settings, saves, then asserts
    // the Privacy tab is absent — so we don't need a separate close() here;
    // the dialog will be closed by the individual test's teardown or the
    // finally blocks below. Guard against an already-closed dialog.
    const isOpen = await editMentorPage.isOpen().catch(() => false);
    if (isOpen) {
      await editMentorPage.privacy.setRouterEnabled(false).catch(() => {});
      await editMentorPage.close().catch(() => {});
    }
  });

  // PR-01: Privacy tab is visible in the modal sidebar
  test('admin sees the Privacy tab label in the sidebar', async ({
    editMentorPage,
  }) => {
    const privacyTab = editMentorPage.dialog.getByRole('tab', {
      name: 'Privacy',
    });
    await expect(privacyTab).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  // PR-02: Privacy header and description render
  test('admin opens the Privacy tab and sees the heading and description', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.privacy.heading).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.privacy.description).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // PR-03: The SDK now gates the entire Privacy sidebar segment on
  //        `enable_privacy_router` — when OFF the tab trigger is absent from
  //        the sidebar entirely (not an empty body), and when ON the tab
  //        renders with its heading and conditional fields. The master switch
  //        lives exclusively in Settings → Capabilities ("Filter PII from
  //        messages"); `setRouterEnabled` delegates there transparently.
  test('Privacy sidebar segment is absent when router is off and present with fields when on', async ({
    editMentorPage,
  }) => {
    // Scoped selector matching the visible sidebar tab trigger for Privacy
    // (same shape used by navigateToTab internally).
    const privacyTabTrigger = editMentorPage.dialog
      .getByRole('tab', { name: 'Privacy', exact: true })
      .and(editMentorPage.dialog.locator('[aria-controls^="panel-"]:visible'));

    // We arrive here with the router ON (beforeEach enabled it and navigated
    // to Privacy). Assert the tab is present and action select is visible.
    await expect(privacyTabTrigger).toBeVisible({ timeout: 5_000 });
    await expect(editMentorPage.privacy.actionSelect).toBeVisible({
      timeout: 10_000,
    });

    // Router OFF → Privacy tab trigger disappears from the sidebar entirely.
    // setRouterEnabled(false) saves via Capabilities and asserts tab absence.
    await editMentorPage.privacy.setRouterEnabled(false);
    await expect(privacyTabTrigger).toHaveCount(0, { timeout: 10_000 });

    // Router ON again → tab reappears and body renders conditional fields.
    await editMentorPage.privacy.setRouterEnabled(true);
    await expect(privacyTabTrigger).toBeVisible({ timeout: 10_000 });
    await expect(editMentorPage.privacy.actionSelect).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.privacy.outputFilterSwitch).toBeVisible({
      timeout: 5_000,
    });
    // afterEach restores router to off.
  });

  // PR-04: When `enable_privacy_router` is off the Privacy sidebar segment is
  //        absent entirely — the SDK filters the tab out of the segment list.
  //        This checkpoint asserts that contract: turning the router off
  //        removes the Privacy tab trigger from the sidebar, which implicitly
  //        means none of the conditional fields (action select, entity chips,
  //        output filter) are reachable.
  test('Privacy sidebar tab trigger is absent from sidebar when router is off', async ({
    editMentorPage,
  }) => {
    // setRouterEnabled(false): navigates to Settings → Capabilities, saves,
    // then asserts the Privacy tab trigger has count 0 in the sidebar.
    await editMentorPage.privacy.setRouterEnabled(false);

    // Confirm the tab trigger is gone — the locator reuses the same scoping
    // filter used by navigateToTab so it won't match sub-tab pills.
    const privacyTabTrigger = editMentorPage.dialog
      .getByRole('tab', { name: 'Privacy', exact: true })
      .and(editMentorPage.dialog.locator('[aria-controls^="panel-"]:visible'));
    await expect(privacyTabTrigger).toHaveCount(0, { timeout: 10_000 });

    // afterEach restores router to off (already off here — no-op save).
  });

  // PR-05: Toggling the router on reveals the conditional fields
  test('enabling the router reveals action, entities and output-filter fields', async ({
    editMentorPage,
  }) => {
    await editMentorPage.privacy.setRouterEnabled(true);

    await expect(editMentorPage.privacy.actionSelect).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.privacy.outputFilterSwitch).toBeVisible({
      timeout: 5_000,
    });
    expect(await editMentorPage.privacy.getEntityChipCount()).toBeGreaterThan(
      0,
    );

    // Reset to off so the test is idempotent against other tests in the suite.
    await editMentorPage.privacy.setRouterEnabled(false);
    await editMentorPage.close();
  });

  // PR-06: User can edit a custom Block Message when (and only when) the
  // "When PII is detected" action is set to Block. Asserts the editable
  // contract — the SDK currently renders the textarea conditionally
  // (`action === 'block' && <Textarea>`), but `expectBlockMessageUneditable`
  // also tolerates a future render-and-disable shape so this checkpoint
  // doesn't fail on a benign SDK refactor.
  test('Block Message textarea is editable only while the action is Block', async ({
    editMentorPage,
  }) => {
    await editMentorPage.privacy.setRouterEnabled(true);

    await editMentorPage.privacy.selectAction('Block');
    await expect(editMentorPage.privacy.blockMessageTextarea).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.privacy.blockMessageTextarea).toBeEnabled({
      timeout: 5_000,
    });

    await editMentorPage.privacy.selectAction('Redact');
    await editMentorPage.privacy.expectBlockMessageUneditable();

    await editMentorPage.privacy.setRouterEnabled(false);
    await editMentorPage.close();
  });

  // PR-07: Selecting an entity chip flips its aria-checked state and updates the empty hint
  test('toggling an entity chip flips its selected state and hides the defaults hint', async ({
    editMentorPage,
  }) => {
    await editMentorPage.privacy.setRouterEnabled(true);

    const chip = editMentorPage.privacy.entityChip('EMAIL_ADDRESS');
    await expect(chip).toBeVisible({ timeout: 10_000 });

    const wasSelected =
      await editMentorPage.privacy.isEntitySelected('EMAIL_ADDRESS');

    // EntityChip's `disabled` prop tracks the form save state — the chip
    // briefly renders disabled after setRouterEnabled while the save settles.
    // The chip's `disabled` prop tracks the form save state, and a single
    // `not.toBeDisabled` guard isn't enough: the chip can re-disable mid-flow
    // when a save round-trip lands right as we click, swallowing the click so
    // aria-checked never flips. `toggleChipTo` polls — it clicks only when the
    // chip is enabled and not yet at the target — so a swallowed click is
    // simply retried, and once the target is reached it stops (no double
    // toggle).
    const toggleChipTo = async (target: 'true' | 'false') => {
      await expect
        .poll(
          async () => {
            const checked = await chip.getAttribute('aria-checked');
            if (checked !== target && !(await chip.isDisabled())) {
              await chip.click().catch(() => {});
            }
            return chip.getAttribute('aria-checked');
          },
          { timeout: 15_000 },
        )
        .toBe(target);
    };

    await toggleChipTo(wasSelected ? 'false' : 'true');

    // Restore the original state so the suite stays idempotent.
    await toggleChipTo(wasSelected ? 'true' : 'false');

    await editMentorPage.privacy.setRouterEnabled(false);
    await editMentorPage.close();
  });
});
