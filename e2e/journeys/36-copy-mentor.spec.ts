import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { logger } from '@iblai/iblai-js/playwright';
import path from 'path';
import { registerMentor } from '../utils/resource-tracker';

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

  test('admin creates a mentor and verifies Copies toggle shows and hides the Copy button', async ({
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
    logger.info('Copy button is visible after enabling Copies');

    await editMentorPage.settings.disableAllowCopies();

    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await expect(editMentorPage.settings.copyMentorButton).not.toBeVisible({
      timeout: 30_000,
    });
    logger.info('Copy button is hidden after disabling Copies');
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
      .locator('h1:not(.sr-only)')
      .filter({ hasText: new RegExp(expectedCopyName) });
    await expect(mentorHeading).toBeVisible({ timeout: 30_000 });
    await registerMentor(page, expectedCopyName);
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
      .locator('h1:not(.sr-only)')
      .filter({ hasText: new RegExp(`^${customName}$`) });
    await expect(mentorHeading).toBeVisible({ timeout: 30_000 });
    await registerMentor(page, customName);
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
      .locator('h1:not(.sr-only)')
      .filter({ hasText: new RegExp(expectedCopyName) });
    await expect(mentorHeading).toBeVisible({ timeout: 30_000 });
    await registerMentor(page, expectedCopyName);
    logger.info(`Copied mentor without training data: ${expectedCopyName}`);
  });

  test('admin copies a mentor with training data and the copied mentor has datasets', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(400_000);
    const mentorName = await createMentorPage.openAndCreate();

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
    await registerMentor(page, `Copy of ${mentorName}`);
    logger.info('Mentor copied with training data');

    // Verify the copied mentor has datasets (dialog stays open after copy).
    // The copy is an async server-side job — datasets are materialized on the
    // copied mentor in a background worker, so they may not be visible on the
    // first read. Poll over a 60s window (re-navigating to Datasets each
    // iteration so the RTK Query tag refetch fires) until materialization
    // settles or the budget is exhausted.
    await expect
      .poll(
        async () => {
          await editMentorPage.navigateToTab('Datasets');
          await waitForPageReady(page);
          return editMentorPage.datasets.hasDatasets();
        },
        {
          timeout: 60_000,
          intervals: [2_000, 5_000, 5_000],
        },
      )
      .toBe(true);
    logger.info('Copied mentor has datasets — training data was included');
    await editMentorPage.close();
  });

  test('admin copies a mentor without training data and the copied mentor has no datasets', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    test.setTimeout(400_000);
    const mentorName = await createMentorPage.openAndCreate();

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
    await registerMentor(page, `Copy of ${mentorName}`);
    logger.info('Mentor copied without training data');

    // Verify the copied mentor has NO datasets (dialog stays open after copy)
    await editMentorPage.navigateToTab('Datasets');
    await waitForPageReady(page);
    const copiedHasDatasets = await editMentorPage.datasets.hasDatasets();
    expect(copiedHasDatasets).toBe(false);
    logger.info('Copied mentor has no datasets — training data was excluded');
    await editMentorPage.close();
  });

  // cpm-10: copying into another organization is handed to the auth app,
  // which is the only place that can mint that organization's tokens. This
  // app's share of it is the hand-off, so that is what is asserted here —
  // the copy and the switch that follow are covered by the auth app's own
  // chooser journey, and driving them from here would mean a second real
  // organization and a popup this suite cannot follow.
  test('admin copying elsewhere is handed to the auth app with the request attached', async ({
    page,
    context,
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

    const currentTenantKey = new URL(page.url()).pathname.split('/')[2];
    await copyMentorDialog.chooseAnotherOrganization();

    // The chooser opens in its own tab, leaving this one where it is — so a
    // user who closes it has copied nothing.
    const [chooser] = await Promise.all([
      context.waitForEvent('page', { timeout: 60_000 }),
      copyMentorDialog.continueButton.click(),
    ]);

    const chooserUrl = new URL(chooser.url());
    expect(chooserUrl.pathname).toBe('/me');
    expect(chooserUrl.searchParams.get('action')).toBe('copy-agent');
    expect(chooserUrl.searchParams.get('tenant')).toBe(currentTenantKey);

    const request = JSON.parse(
      chooserUrl.searchParams.get('extra-params') ?? '{}',
    );
    expect(request.name).toBe(`Copy of ${mentorName}`);
    expect(request.org).toBe(currentTenantKey);
    expect(typeof request.mentorId).toBe('string');
    expect(request.mentorId.length).toBeGreaterThan(0);
    logger.info(`Copy handed to the auth app for agent ${request.mentorId}`);

    // Nothing was copied here, and this tab never moved.
    expect(page.url()).toContain(`/platform/${currentTenantKey}/`);
    await chooser.close();
  });
});
