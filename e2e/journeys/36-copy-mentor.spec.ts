import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { safeWaitForURL, logger } from '@iblai/iblai-js/playwright';
import path from 'path';

const FILES_DIR = path.resolve(__dirname, '../files/testing_folder');
const PDF_FILE = path.join(
  FILES_DIR,
  '0028-oop-object-oriented-programming-using-cpp.pdf',
);
const IMAGE_FILE = path.join(FILES_DIR, 'acessibility png.png');

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

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await expect(editMentorPage.settings.copyMentorButton).not.toBeVisible({
      timeout: 30_000,
    });
    logger.info('Copy button is hidden for non-forkable mentor');

    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await expect(editMentorPage.settings.copyMentorButton).toBeVisible({
      timeout: 30_000,
    });
    logger.info('Copy button is visible after enabling Allow Copies');

    await editMentorPage.settings.disableAllowCopies();

    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await expect(editMentorPage.settings.copyMentorButton).not.toBeVisible({
      timeout: 30_000,
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

    await editMentorPage.settings.copyMentorButton.click();
    const { copyMentorDialog } = editMentorPage;
    await copyMentorDialog.waitForOpen();

    await expect(copyMentorDialog.dialog.getByText('Copy Agent')).toBeVisible();
    await expect(
      copyMentorDialog.dialog.getByText(/Create a copy of this agent/),
    ).toBeVisible();

    const nameValue = await copyMentorDialog.getName();
    expect(nameValue).toContain(`Copy of ${mentorName}`);
    logger.info(`Name input pre-filled with: ${nameValue}`);

    await expect(
      copyMentorDialog.dialog.getByText('Include training data'),
    ).toBeVisible();
    await expect(copyMentorDialog.cancelButton).toBeVisible();
    await expect(copyMentorDialog.copyButton).toBeVisible();

    await copyMentorDialog.close();
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
    await editMentorPage.copyMentorDialog.waitForOpen();

    await editMentorPage.copyMentorDialog.closeViaEscape();
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
    await editMentorPage.copyMentorDialog.waitForOpen();

    logger.info('Waiting for copy to complete...');
    await editMentorPage.copyMentorDialog.submitCopy();

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
    const { copyMentorDialog } = editMentorPage;
    await copyMentorDialog.waitForOpen();

    const customName = `Custom Copy ${Date.now()}`;
    await copyMentorDialog.setName(customName);
    await copyMentorDialog.submitCopy();

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
    const { copyMentorDialog } = editMentorPage;
    await copyMentorDialog.waitForOpen();

    await copyMentorDialog.nameInput.clear();
    await expect(copyMentorDialog.copyButton).toBeDisabled();
    logger.info('Copy button is disabled when name is empty');

    await copyMentorDialog.closeViaEscape();
    await editMentorPage.close();
  });

  test('admin copies a mentor without including training data', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    const mentorName = await createMentorPage.openAndCreate();

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const { copyMentorDialog } = editMentorPage;
    await copyMentorDialog.waitForOpen();

    await copyMentorDialog.setIncludeTrainingData(false);
    logger.info('Include training data toggled off');

    await copyMentorDialog.submitCopy();

    const expectedCopyName = `Copy of ${mentorName}`;
    const mentorHeading = page
      .locator('h1')
      .filter({ hasText: new RegExp(expectedCopyName) });
    await expect(mentorHeading).toBeVisible({ timeout: 30_000 });
    logger.info(`Copied mentor without training data: ${expectedCopyName}`);
  });

  test('admin copies a mentor with training data and the copied mentor has datasets', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(400_000);
    await createMentorPage.openAndCreate();

    // Upload 2 files to the Datasets tab
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(PDF_FILE, 'PDF');
    logger.info('Uploaded PDF file');

    await editMentorPage.datasets.uploadFile(IMAGE_FILE, 'Image');
    logger.info('Uploaded Image file');

    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    expect(hasDatasets).toBe(true);
    logger.info('Verified datasets exist on source mentor');

    // Copy with training data
    await editMentorPage.navigateToTab('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const { copyMentorDialog } = editMentorPage;
    await copyMentorDialog.waitForOpen();

    await copyMentorDialog.setIncludeTrainingData(true);
    logger.info('Include training data is ON');

    await copyMentorDialog.submitCopy();
    logger.info('Mentor copied with training data');

    // Verify the copied mentor has datasets (dialog stays open after copy)
    await editMentorPage.navigateToTab('Datasets');
    await waitForPageReady(page);
    const copiedHasDatasets = await editMentorPage.datasets.hasDatasets();
    expect(copiedHasDatasets).toBe(true);
    logger.info('Copied mentor has datasets — training data was included');
    await editMentorPage.close();
  });

  test('admin copies a mentor without training data and the copied mentor has no datasets', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(400_000);
    await createMentorPage.openAndCreate();

    // Upload 2 files to the Datasets tab
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(PDF_FILE, 'PDF');
    logger.info('Uploaded PDF file');

    await editMentorPage.datasets.uploadFile(IMAGE_FILE, 'Image');
    logger.info('Uploaded Image file');

    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    expect(hasDatasets).toBe(true);
    logger.info('Verified datasets exist on source mentor');

    // Copy without training data
    await editMentorPage.navigateToTab('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.enableAllowCopies();

    await editMentorPage.settings.copyMentorButton.click();
    const { copyMentorDialog } = editMentorPage;
    await copyMentorDialog.waitForOpen();

    await copyMentorDialog.setIncludeTrainingData(false);
    logger.info('Include training data is OFF');

    await copyMentorDialog.submitCopy();
    logger.info('Mentor copied without training data');

    // Verify the copied mentor has NO datasets (dialog stays open after copy)
    await editMentorPage.navigateToTab('Datasets');
    await waitForPageReady(page);
    const copiedHasDatasets = await editMentorPage.datasets.hasDatasets();
    expect(copiedHasDatasets).toBe(false);
    logger.info('Copied mentor has no datasets — training data was excluded');
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
    const { copyMentorDialog } = editMentorPage;
    await copyMentorDialog.waitForOpen();

    const hasMultipleTenants = await copyMentorDialog.hasDestinationSelector();

    if (!hasMultipleTenants) {
      logger.info(
        'User is admin in only one tenant — skipping cross-tenant copy test',
      );
      await copyMentorDialog.closeViaEscape();
      await editMentorPage.close();
      test.skip();
      return;
    }

    logger.info('Destination dropdown found — user has multiple admin tenants');

    const currentUrl = new URL(page.url());
    const currentTenantKey = currentUrl.pathname.split('/')[2];
    logger.info(`Current tenant: ${currentTenantKey}`);

    const selectedTenantName =
      await copyMentorDialog.selectDifferentTenant(currentTenantKey);

    if (!selectedTenantName) {
      logger.info(
        'Could not find a different tenant option — skipping cross-tenant test',
      );
      await copyMentorDialog.closeViaEscape();
      await editMentorPage.close();
      test.skip();
      return;
    }

    logger.info(`Selected destination tenant: ${selectedTenantName}`);

    await copyMentorDialog.copyButton.click();

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

    expect(page.url()).not.toContain(`/platform/${currentTenantKey}/`);
    logger.info('Cross-tenant copy verified — no longer on original tenant');
  });
});
