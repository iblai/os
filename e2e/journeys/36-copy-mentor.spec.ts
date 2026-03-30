import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { safeWaitForURL, logger } from '@iblai/iblai-js/playwright';

/**
 * Create a fresh mentor via the sidebar "New Mentor" button.
 * Returns the generated mentor name.
 */
async function createMentor(
  page: import('@playwright/test').Page,
): Promise<string> {
  const mentorName = `E2E Copy Test ${Date.now()}`;
  const newMentorBtn = page.getByRole('button', {
    name: 'New Mentor',
    exact: true,
  });
  await expect(newMentorBtn).toBeVisible({ timeout: 10_000 });
  await newMentorBtn.click();

  const dialog = page.getByRole('dialog', {
    name: /create.*mentor|new mentor/i,
  });
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  const nameInput = dialog.getByPlaceholder(/mentor name|name/i).first();
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  await nameInput.fill(mentorName);

  const createBtn = dialog.getByRole('button', { name: /create|save/i }).last();
  await expect(createBtn).toBeEnabled({ timeout: 5_000 });
  await createBtn.click();

  await safeWaitForURL(page, (url) => url.href.includes('/platform/'), {
    timeout: 30_000,
  });
  await waitForPageReady(page);
  logger.info(`Created mentor: ${mentorName}`);
  return mentorName;
}

/**
 * Enable "Allow Copies" toggle on the current mentor and save.
 */
async function enableAllowCopies(
  page: import('@playwright/test').Page,
  editMentorDialog: import('@playwright/test').Locator,
) {
  const allowCopiesToggle = editMentorDialog.locator(
    'button[role="switch"][aria-label*="Allow copies"]',
  );
  await expect(allowCopiesToggle).toBeVisible({ timeout: 10_000 });

  const isChecked = await allowCopiesToggle.getAttribute('aria-checked');
  if (isChecked !== 'true') {
    await allowCopiesToggle.click();
  }

  const saveButton = editMentorDialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  await saveButton.click();

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);

  logger.info('Allow Copies enabled and saved');
}

/**
 * Open the Copy Mentor modal from an already-open settings tab.
 */
async function openCopyMentorModal(
  page: import('@playwright/test').Page,
  editMentorDialog: import('@playwright/test').Locator,
) {
  const copyButton = editMentorDialog.getByRole('button', {
    name: 'Copy',
    exact: true,
  });
  await expect(copyButton).toBeVisible({ timeout: 10_000 });
  await copyButton.click();

  const copyDialog = page.getByRole('dialog', { name: /Copy Mentor/i });
  await expect(copyDialog).toBeVisible({ timeout: 10_000 });

  logger.info('Copy Mentor modal opened');
  return copyDialog;
}

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
    editMentorPage,
  }) => {
    await createMentor(page);

    // Open settings — Copy button should NOT be visible (forkable defaults to false)
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const copyButtonInitial = editMentorPage.dialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    await expect(copyButtonInitial).not.toBeVisible({ timeout: 5_000 });
    logger.info('Copy button is hidden for non-forkable mentor');

    // Enable Allow Copies
    const allowCopiesToggle = editMentorPage.dialog.locator(
      'button[role="switch"][aria-label*="Allow copies"]',
    );
    await expect(allowCopiesToggle).toBeVisible({ timeout: 10_000 });
    await allowCopiesToggle.click();

    const saveButton = editMentorPage.dialog.getByRole('button', {
      name: 'Save',
    });
    await saveButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);

    // Close and reopen to verify persistence
    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const copyButtonAfterEnable = editMentorPage.dialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    await expect(copyButtonAfterEnable).toBeVisible({ timeout: 10_000 });
    logger.info('Copy button is visible after enabling Allow Copies');

    // Disable Allow Copies
    const toggleAfterReopen = editMentorPage.dialog.locator(
      'button[role="switch"][aria-label*="Allow copies"]',
    );
    await toggleAfterReopen.click();
    const saveButton2 = editMentorPage.dialog.getByRole('button', {
      name: 'Save',
    });
    await saveButton2.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);

    // Close and reopen to verify Copy button is gone
    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const copyButtonAfterDisable = editMentorPage.dialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    await expect(copyButtonAfterDisable).not.toBeVisible({ timeout: 5_000 });
    logger.info('Copy button is hidden after disabling Allow Copies');
    await editMentorPage.close();
  });

  test('admin opens Copy Mentor modal with correct defaults and closes via Cancel', async ({
    page,
    editMentorPage,
  }) => {
    const mentorName = await createMentor(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await enableAllowCopies(page, editMentorPage.dialog);

    const copyDialog = await openCopyMentorModal(page, editMentorPage.dialog);

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
    editMentorPage,
  }) => {
    await createMentor(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await enableAllowCopies(page, editMentorPage.dialog);

    const copyDialog = await openCopyMentorModal(page, editMentorPage.dialog);
    await expect(copyDialog).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await expect(copyDialog).not.toBeVisible({ timeout: 5_000 });
    logger.info('Modal closed via Escape key');
    await editMentorPage.close();
  });

  test('admin copies a mentor with default name and navigates to the new mentor', async ({
    page,
    editMentorPage,
  }) => {
    const mentorName = await createMentor(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await enableAllowCopies(page, editMentorPage.dialog);

    const copyDialog = await openCopyMentorModal(page, editMentorPage.dialog);

    // Click Copy
    const copyButton = copyDialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    await copyButton.click();

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
    editMentorPage,
  }) => {
    await createMentor(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await enableAllowCopies(page, editMentorPage.dialog);

    const copyDialog = await openCopyMentorModal(page, editMentorPage.dialog);

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
    editMentorPage,
  }) => {
    await createMentor(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await enableAllowCopies(page, editMentorPage.dialog);

    const copyDialog = await openCopyMentorModal(page, editMentorPage.dialog);

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
    editMentorPage,
  }) => {
    await createMentor(page);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await enableAllowCopies(page, editMentorPage.dialog);

    const copyDialog = await openCopyMentorModal(page, editMentorPage.dialog);

    // Check if the Destination dropdown appears (user has multiple admin tenants)
    const destinationLabel = copyDialog.getByText('Destination');
    const hasMultipleTenants = await destinationLabel
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (!hasMultipleTenants) {
      logger.info(
        'User is admin in only one tenant — skipping cross-tenant copy test',
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
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
    const selectTrigger = copyDialog.getByRole('combobox', {
      name: 'Select destination tenant',
    });
    await selectTrigger.click();
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
      await page.waitForTimeout(500);
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
