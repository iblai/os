import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { safeWaitForURL, logger } from '@iblai/iblai-js/playwright';

test.describe('Journey 36: Copy Mentor', () => {
  test.setTimeout(200_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }
  });

  test('admin creates a mentor and verifies Allow Copies toggle shows and hides the Copy button', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();

    // Open settings — Copy button should NOT be visible (forkable defaults to false)
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await expect(editMentorPage.settings.copyMentorButton).not.toBeVisible({
      timeout: 5_000,
    });
    logger.info('Copy button is hidden for non-forkable mentor');

    // Enable Allow Copies
    await editMentorPage.settings.enableAllowCopies();

    // Close and reopen to verify persistence
    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await expect(editMentorPage.settings.copyMentorButton).toBeVisible({
      timeout: 10_000,
    });
    logger.info('Copy button is visible after enabling Allow Copies');

    // Disable Allow Copies
    await editMentorPage.settings.disableAllowCopies();

    // Close and reopen to verify Copy button is gone
    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await expect(editMentorPage.settings.copyMentorButton).not.toBeVisible({
      timeout: 5_000,
    });
    logger.info('Copy button is hidden after disabling Allow Copies');
    await editMentorPage.close();
  });

  test('admin opens Copy Mentor modal with correct defaults and closes via Cancel', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    const mentorName = await createMentorPage.openAndCreate();

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    // Open Copy Mentor modal
    await editMentorPage.settings.copyMentorButton.click();
    const copyDialog = page.getByRole('dialog', { name: /Copy Mentor/i });
    await expect(copyDialog).toBeVisible({ timeout: 10_000 });

    // Verify title and description
    await expect(copyDialog.getByText('Copy Mentor')).toBeVisible();
    await expect(
      copyDialog.getByText(/Create a copy of this mentor/),
    ).toBeVisible();

    // Verify name input is pre-filled with "Copy of {mentor_name}"
    const nameInput = copyDialog.getByRole('textbox', {
      name: 'Mentor Name',
    });
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toContain(`Copy of ${mentorName}`);
    logger.info(`Name input pre-filled with: ${nameValue}`);

    // Verify training data toggle is visible
    await expect(copyDialog.getByText('Include training data')).toBeVisible();

    // Verify Cancel and Copy buttons
    await expect(
      copyDialog.getByRole('button', { name: 'Cancel' }),
    ).toBeVisible();
    await expect(
      copyDialog.getByRole('button', { name: 'Copy', exact: true }),
    ).toBeVisible();

    // Close via Cancel
    await copyDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(copyDialog).not.toBeVisible({ timeout: 5_000 });
    logger.info('Modal closed via Cancel');
    await editMentorPage.close();
  });

  test('admin opens Copy Mentor modal and closes it via Escape key', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const copyDialog = page.getByRole('dialog', { name: /Copy Mentor/i });
    await expect(copyDialog).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await expect(copyDialog).not.toBeVisible({ timeout: 5_000 });
    logger.info('Modal closed via Escape key');
    await editMentorPage.close();
  });

  test('admin copies a mentor with default name and navigates to the new mentor', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    const mentorName = await createMentorPage.openAndCreate();

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const copyDialog = page.getByRole('dialog', { name: /Copy Mentor/i });
    await expect(copyDialog).toBeVisible({ timeout: 10_000 });

    // Click Copy
    await copyDialog.getByRole('button', { name: 'Copy', exact: true }).click();

    // Wait for the copy dialog to close (indicates success)
    logger.info('Waiting for copy to complete...');
    await expect(copyDialog).not.toBeVisible({ timeout: 60_000 });

    // Wait for navigation to the new mentor
    await waitForPageReady(page);
    await page.waitForLoadState('networkidle');

    // The new mentor should have "Copy of {mentorName}" in the page
    const expectedCopyName = `Copy of ${mentorName}`;
    const mentorHeading = page
      .locator('h1')
      .filter({ hasText: new RegExp(expectedCopyName) });
    await expect(mentorHeading).toBeVisible({ timeout: 30_000 });
    logger.info(`Navigated to copied mentor: ${expectedCopyName}`);
  });

  test('admin copies a mentor with a custom name', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const copyDialog = page.getByRole('dialog', { name: /Copy Mentor/i });
    await expect(copyDialog).toBeVisible({ timeout: 10_000 });

    // Change the name
    const customName = `Custom Copy ${Date.now()}`;
    const nameInput = copyDialog.getByRole('textbox', {
      name: 'Mentor Name',
    });
    await nameInput.clear();
    await nameInput.fill(customName);

    // Click Copy
    await copyDialog.getByRole('button', { name: 'Copy', exact: true }).click();

    // Wait for navigation
    await expect(copyDialog).not.toBeVisible({ timeout: 60_000 });
    await waitForPageReady(page);
    await page.waitForLoadState('networkidle');

    // Verify the custom name
    const mentorHeading = page
      .locator('h1')
      .filter({ hasText: new RegExp(`^${customName}$`) });
    await expect(mentorHeading).toBeVisible({ timeout: 30_000 });
    logger.info(`Navigated to custom-named copy: ${customName}`);
  });

  test('admin sees Copy button disabled when mentor name is empty', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const copyDialog = page.getByRole('dialog', { name: /Copy Mentor/i });
    await expect(copyDialog).toBeVisible({ timeout: 10_000 });

    const nameInput = copyDialog.getByRole('textbox', {
      name: 'Mentor Name',
    });
    await nameInput.clear();

    const copyButton = copyDialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    await expect(copyButton).toBeDisabled();
    logger.info('Copy button is disabled when name is empty');
    await page.keyboard.press('Escape');
    await editMentorPage.close();
  });

  test('admin copies a mentor to a different tenant if user has multiple admin tenants', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const copyDialog = page.getByRole('dialog', { name: /Copy Mentor/i });
    await expect(copyDialog).toBeVisible({ timeout: 10_000 });

    // Wait up to 60s for the Destination tenant selector to appear
    const destinationCombobox = copyDialog.getByRole('combobox', {
      name: 'Select destination tenant',
    });
    const hasMultipleTenants = await destinationCombobox
      .isVisible({ timeout: 60_000 })
      .catch(() => false);

    if (!hasMultipleTenants) {
      logger.info(
        'User is admin in only one tenant — skipping cross-tenant copy test',
      );
      await page.keyboard.press('Escape');
      await editMentorPage.close();
      test.skip();
      return;
    }

    logger.info('Destination dropdown found — user has multiple admin tenants');

    // Get the current tenant from the URL
    const currentUrl = new URL(page.url());
    const currentTenantKey = currentUrl.pathname.split('/')[2];
    logger.info(`Current tenant: ${currentTenantKey}`);

    // Open the destination dropdown and pick a different tenant
    await destinationCombobox.click();
    await page.waitForTimeout(1_000);

    // Find an option that is NOT the current tenant
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();
    let selectedTenantName = '';

    for (let i = 0; i < optionCount; i++) {
      const optionText = await options.nth(i).textContent();
      if (optionText && !optionText.includes(currentTenantKey)) {
        selectedTenantName = optionText.trim();
        await options.nth(i).click();
        logger.info(`Selected destination tenant: ${selectedTenantName}`);
        break;
      }
    }

    if (!selectedTenantName) {
      logger.info(
        'Could not find a different tenant option — skipping cross-tenant test',
      );
      await page.keyboard.press('Escape');
      await editMentorPage.close();
      test.skip();
      return;
    }

    // Click Copy
    await copyDialog.getByRole('button', { name: 'Copy', exact: true }).click();

    // Cross-tenant copy triggers a tenant switch (full page redirect via auth)
    await safeWaitForURL(
      page,
      (url) =>
        !url.pathname.startsWith(`/platform/${currentTenantKey}/`) ||
        url.href.includes('/login'),
      { timeout: 120_000 },
    );

    await page.waitForLoadState('networkidle');
    await waitForPageReady(page);

    logger.info(`Tenant switch completed — landed at: ${page.url()}`);

    // Verify we are no longer on the original tenant
    expect(page.url()).not.toContain(`/platform/${currentTenantKey}/`);
    logger.info('Cross-tenant copy verified — no longer on original tenant');
  });
});
