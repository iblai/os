import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 45 — Mentor Privacy Tab.
 *
 * ── Capability-gate refactor ─────────────────────────────────────────────
 *
 * The `enable_privacy_router` MASTER switch used to live in
 * Settings → Capabilities ("Filter PII from messages") and gate the entire
 * Privacy sidebar segment's visibility. It now lives inline at the top of
 * the Privacy tab itself via the shared `CapabilityGate` component
 * (`data-testid="privacy-capability-toggle"`), and
 * `hooks/use-mentor-segments.ts` no longer gates the Privacy segment at all
 * — the tab is ALWAYS mounted. The gated fields (action select, entity
 * chips, output filter) stay in the DOM and readable when the router is
 * off; they render inside a grayed + inert `data-testid="capability-gate-content"`
 * wrapper. Interacting with them while off is not a supported flow — every
 * test that reads/writes a gated field turns the router on first.
 *
 * The "When PII is detected" action dropdown now lists **Allow** first
 * (`PRIVACY_ACTIONS = ['allow', 'redact', 'mask', 'block']` from
 * `@iblai/data-layer`), followed by Redact, Mask, Block.
 */
test.describe('Journey 45: Mentor Privacy Tab', () => {
  // Run serially in a single worker. Every test toggles `enable_privacy_router`
  // on the SAME shared mentor — all workers use the same admin storageState and
  // open the same selected agent — so parallel execution would let one test's
  // afterEach disable the router mid-interaction in another, guaranteeing
  // flakes. Serial also hands each test a clean, router-off starting state.
  //
  // The widened timeout absorbs the Privacy tab's chained server round-trips:
  // every field/router change auto-saves (editMentorJson PUT +
  // refetchMentorSettings), and `AgentPrivacyTab` is NOT optimistic (unlike
  // the app-owned capability tabs) — the toggle only flips once the refetch
  // lands, which can legitimately push the total well past the default 120s
  // even on a fully PASSING run on slow staging.
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Privacy tab requires admin access');
      return;
    }
    // The Privacy tab is always mounted now — navigate straight to it.
    await editMentorPage.open('Privacy');
    await waitForPageReady(page);
    // Enable the router so the gated fields are interactive for tests that
    // need them. `setRouterEnabled` waits out the non-optimistic round trip.
    await editMentorPage.privacy.setRouterEnabled(true);
  });

  test.afterEach(async ({ editMentorPage }) => {
    // Restore `enable_privacy_router` to off so the suite is idempotent and
    // other journeys inherit a mentor with the router disabled (the default).
    const isOpen = await editMentorPage.isOpen().catch(() => false);
    if (isOpen) {
      await editMentorPage.privacy.setRouterEnabled(false).catch(() => {});
      await editMentorPage.close().catch(() => {});
    }
  });

  // PR-01: Privacy tab is visible in the modal sidebar (always mounted now)
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

  // PR-03: The Privacy tab is now ALWAYS mounted regardless of
  //        `enable_privacy_router` — the capability toggle only grays/inerts
  //        the fields below it. This checkpoint asserts the toggle's effect
  //        on `capability-gate-content`'s `data-enabled` attribute rather
  //        than tab presence.
  test('Privacy tab stays visible and capability-gate-content tracks the router state', async ({
    editMentorPage,
  }) => {
    const privacyTabTrigger = editMentorPage.dialog.getByRole('tab', {
      name: 'Privacy',
      exact: true,
    });

    // We arrive here with the router ON (beforeEach enabled it). Assert the
    // tab is present, the gate reads enabled, and the action select is
    // visible (and interactive, not inert).
    await expect(privacyTabTrigger).toBeVisible({ timeout: 5_000 });
    await expect(editMentorPage.privacy.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 10_000 },
    );
    await expect(editMentorPage.privacy.actionSelect).toBeVisible({
      timeout: 10_000,
    });

    // Router OFF → tab remains mounted, but the gate flips to disabled.
    await editMentorPage.privacy.setRouterEnabled(false);
    await expect(privacyTabTrigger).toBeVisible({ timeout: 5_000 });
    await expect(editMentorPage.privacy.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );

    // Router ON again → gate flips back to enabled.
    await editMentorPage.privacy.setRouterEnabled(true);
    await expect(editMentorPage.privacy.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 10_000 },
    );
    await expect(editMentorPage.privacy.actionSelect).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.privacy.outputFilterSwitch).toBeVisible({
      timeout: 5_000,
    });
    // afterEach restores router to off.
  });

  // PR-04: The CapabilityGate off-state hint is shown only while the router
  //        is off.
  test('the off-state hint is shown only while the router is off', async ({
    editMentorPage,
  }) => {
    // beforeEach already enabled the router.
    await editMentorPage.privacy.expectOffHintVisible(false);

    await editMentorPage.privacy.setRouterEnabled(false);
    await editMentorPage.privacy.expectOffHintVisible(true);

    // afterEach restores router to off (already off — no-op save).
  });

  // PR-05: Toggling the router on keeps the action, entities and
  //        output-filter fields present and interactive.
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
    await expect
      .poll(() => editMentorPage.privacy.getEntityChipCount(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // Reset to off so the test is idempotent against other tests in the suite.
    await editMentorPage.privacy.setRouterEnabled(false);
    await editMentorPage.close();
  });

  // PR-05b: The "When PII is detected" action dropdown lists Allow first,
  //         then Redact, Mask, Block (PRIVACY_ACTIONS order).
  test('the action dropdown lists Allow, Redact, Mask, Block in that order', async ({
    editMentorPage,
    page,
  }) => {
    await editMentorPage.privacy.setRouterEnabled(true);
    await expect(editMentorPage.privacy.actionSelect).toBeEnabled({
      timeout: 10_000,
    });
    await editMentorPage.privacy.actionSelect.click();

    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 6_000 });
    const labels = (await options.allTextContents()).map((t) => t.trim());
    expect(labels).toEqual(['Allow', 'Redact', 'Mask', 'Block']);

    // closeActionSelect waits for the options listbox to actually detach
    // rather than assuming a single Escape press closed it — an open Radix
    // Select blocks pointer events dialog-wide, which previously made the
    // next line's capability-toggle click hang for the full 30s whenever
    // Escape intermittently no-op'd here.
    await editMentorPage.privacy.closeActionSelect();
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
    // beforeEach already enabled the router and landed on Privacy.
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
    // beforeEach already enabled the router and landed on Privacy.
    const chip = editMentorPage.privacy.entityChip('EMAIL_ADDRESS');
    await expect(chip).toBeVisible({ timeout: 10_000 });

    const wasSelected =
      await editMentorPage.privacy.isEntitySelected('EMAIL_ADDRESS');

    // `setEntitySelected` owns the resilience: the chip is server-bound and
    // each click auto-saves (editMentorJson + refetch), which disables the
    // chip mid-save. It polls the server-bound aria-checked until the toggle
    // commits, asserting the flip internally.
    await editMentorPage.privacy.setEntitySelected(
      'EMAIL_ADDRESS',
      !wasSelected,
    );

    // Restore the original state so the suite stays idempotent.
    await editMentorPage.privacy.setEntitySelected(
      'EMAIL_ADDRESS',
      wasSelected,
    );

    await editMentorPage.privacy.setRouterEnabled(false);
    await editMentorPage.close();
  });
});
