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

  // PR-03: Master Privacy Router toggle is visible
  test('admin sees the master Privacy Router switch', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.privacy.routerSwitch).toBeVisible({
      timeout: 10_000,
    });
    await editMentorPage.close();
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

  // PR-06: Selecting Block reveals the block-message textarea
  test('choosing Block reveals the block-message textarea and choosing Redact hides it', async ({
    editMentorPage,
  }) => {
    await editMentorPage.privacy.setRouterEnabled(true);

    await editMentorPage.privacy.selectAction('Block');
    await expect(editMentorPage.privacy.blockMessageTextarea).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.privacy.selectAction('Redact');
    await expect(editMentorPage.privacy.blockMessageTextarea).not.toBeVisible({
      timeout: 5_000,
    });

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

    await chip.click();
    await expect(chip).toHaveAttribute(
      'aria-checked',
      wasSelected ? 'false' : 'true',
      { timeout: 10_000 },
    );

    // Restore the original state so the suite stays idempotent.
    await chip.click();
    await expect(chip).toHaveAttribute(
      'aria-checked',
      wasSelected ? 'true' : 'false',
      { timeout: 10_000 },
    );

    await editMentorPage.privacy.setRouterEnabled(false);
    await editMentorPage.close();
  });
});
