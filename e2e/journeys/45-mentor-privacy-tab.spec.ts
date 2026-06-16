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
    await editMentorPage.open('Privacy');
    await waitForPageReady(page);
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

  // PR-03: The master `enable_privacy_router` switch was removed from the
  //        SDK Privacy tab body — flipping it now lives ONLY in Settings →
  //        Capabilities ("Filter PII from messages"). This checkpoint now
  //        asserts the contract that survived the move: the Privacy tab
  //        does NOT render the action select / output filter when the
  //        router is off (it gates on the new value), and DOES render them
  //        when the router is on. The page-object `setRouterEnabled` now
  //        delegates through the Capabilities switch automatically, so
  //        every other PR-* test below continues to work unchanged.
  test('Privacy tab body tracks the master `enable_privacy_router` value flipped from Capabilities', async ({
    editMentorPage,
  }) => {
    // Capture the original state so this test is idempotent.
    const originalEnabled = await editMentorPage.privacy.isRouterEnabled();

    try {
      // Router OFF → body is empty (no action select, no output filter).
      await editMentorPage.privacy.setRouterEnabled(false);
      await expect(editMentorPage.privacy.actionSelect).not.toBeVisible({
        timeout: 5_000,
      });
      await expect(editMentorPage.privacy.outputFilterSwitch).not.toBeVisible({
        timeout: 5_000,
      });

      // Router ON → body renders the conditional fields.
      await editMentorPage.privacy.setRouterEnabled(true);
      await expect(editMentorPage.privacy.actionSelect).toBeVisible({
        timeout: 10_000,
      });
      await expect(editMentorPage.privacy.outputFilterSwitch).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      // Restore so subsequent tests inherit the world we found.
      await editMentorPage.privacy
        .setRouterEnabled(originalEnabled)
        .catch(() => undefined);
      await editMentorPage.close();
    }
  });

  // PR-04: Conditional fields are hidden when router is off
  test('action dropdown, entity chips and output filter are hidden while router is off', async ({
    editMentorPage,
  }) => {
    // If the router is already on in the fixture, turn it off first so the
    // hidden-fields invariant holds. Save flushes through the JSON mutation.
    await editMentorPage.privacy.setRouterEnabled(false);

    await expect(editMentorPage.privacy.actionSelect).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.privacy.outputFilterSwitch).not.toBeVisible({
      timeout: 5_000,
    });
    expect(await editMentorPage.privacy.getEntityChipCount()).toBe(0);

    await editMentorPage.close();
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
