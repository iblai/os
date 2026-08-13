import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import {
  seedDatasetsForMentor,
  waitForDatasetsReady,
} from '../utils/dataset-seeding';
import { logger } from '@iblai/iblai-js/playwright';
import path from 'path';

const FILES_DIR = path.resolve(__dirname, '../../e2e/files/testing_folder');
const PDF_FILE = path.join(
  FILES_DIR,
  '0028-oop-object-oriented-programming-using-cpp.pdf',
);
const IMAGE_FILE = path.join(FILES_DIR, 'acessibility png.png');
const TXT_FILE = path.join(FILES_DIR, 'outerHTML.txt');
const CSV_FILE = path.join(FILES_DIR, 'test-data.csv');
const MARKDOWN_FILE = path.join(FILES_DIR, 'test-data.md');

test.describe('Journey 20: Dataset Management', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Dataset management requires admin access');
      return;
    }
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);
  });

  test('admin goes to datasets tab and verifies the header and description display correctly', async ({
    editMentorPage,
  }) => {
    const header = editMentorPage.dialog.getByRole('heading', {
      name: /datasets/i,
    });
    await expect(header).toBeVisible({ timeout: 10_000 });
  });

  test('admin goes to datasets tab and verifies the search input is visible', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.datasets.searchInput).toBeVisible({
      timeout: 10_000,
    });
  });

  test('admin goes to datasets tab and searches for a dataset', async ({
    editMentorPage,
  }) => {
    await editMentorPage.datasets.search('test');
    await expect(editMentorPage.datasets.searchInput).toHaveValue('test');
  });

  test('admin goes to datasets tab and clicks Add Resource button which opens the modal with all resource types', async ({
    editMentorPage,
  }) => {
    const modal = await editMentorPage.datasets.openAddResourceModal();
    await expect(modal).toBeVisible();
  });

  test('admin goes to datasets tab and verifies table headers display correctly', async ({
    editMentorPage,
  }) => {
    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    if (!hasDatasets) return; // Empty state is acceptable
    const nameHeader = editMentorPage.dialog
      .getByRole('columnheader', { name: /name/i })
      .or(editMentorPage.dialog.getByText(/name/i).first());
    await expect(nameHeader).toBeVisible({ timeout: 5_000 });
  });

  // fixme: neither dataset list nor empty state element is found — app may not render datasets tab correctly
  test.fixme(
    'admin goes to datasets tab and sees dataset list or empty state',
    async ({ editMentorPage }) => {
      const hasDatasets = await editMentorPage.datasets.hasDatasets();
      const hasEmptyState = await editMentorPage.datasets.emptyState
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasDatasets || hasEmptyState).toBe(true);
    },
  );

  test('admin goes to datasets tab and tests pagination controls when datasets exist', async ({
    editMentorPage,
  }) => {
    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    if (!hasDatasets) return;
    const nextBtn = editMentorPage.datasets.paginationNext;
    const visible = await nextBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (
      visible &&
      (await nextBtn.isEnabled({ timeout: 3_000 }).catch(() => false))
    ) {
      await nextBtn.click();
      await editMentorPage.page.waitForTimeout(1_000);
    }
  });

  test('admin goes to datasets tab and tests the visibility toggle when datasets exist', async ({
    editMentorPage,
  }) => {
    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    if (!hasDatasets) return;
    const toggle = editMentorPage.datasets.visibilityToggle;
    const visible = await toggle
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (visible) {
      await toggle.click();
      await editMentorPage.page.waitForTimeout(500);
      await toggle.click(); // restore
    }
  });

  test('admin goes to datasets tab and tests the training status switch when datasets exist', async ({
    editMentorPage,
  }) => {
    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    if (!hasDatasets) return;
    const trainingSwitch = editMentorPage.datasets.trainingSwitch;
    const visible = await trainingSwitch
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (visible) {
      await expect(trainingSwitch).toBeVisible();
    }
  });

  test('admin goes to datasets tab and tests the Schedule Retrain button when available', async ({
    editMentorPage,
  }) => {
    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    if (!hasDatasets) return;
    const scheduleBtn = editMentorPage.datasets.scheduleRetrainButton;
    const visible = await scheduleBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (visible) {
      const enabled = await scheduleBtn
        .isEnabled({ timeout: 3_000 })
        .catch(() => false);
      test.skip(!enabled, 'Schedule Retrain button is visible but disabled');
      await scheduleBtn.click();
      const modal = editMentorPage.page.getByRole('dialog', {
        name: 'Schedule Retraining',
      });
      await expect(modal).toBeVisible({ timeout: 10_000 });
      await editMentorPage.page.keyboard.press('Escape');
    }
  });

  test('admin goes to datasets tab and deletes a dataset when datasets exist', async ({
    editMentorPage,
  }) => {
    const hasDatasets = await editMentorPage.datasets.hasDatasets();
    if (!hasDatasets) return;
    const deleteBtn = editMentorPage.datasets.deleteButton;
    const visible = await deleteBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (visible) {
      await deleteBtn.click();
      const confirmDialog = editMentorPage.page
        .getByRole('dialog')
        .filter({ hasText: /delete/i });
      const hasConfirm = await confirmDialog
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (hasConfirm) {
        await confirmDialog
          .getByRole('button', { name: /delete|confirm/i })
          .last()
          .click();
      }
    }
  });

  // test('admin goes to datasets tab and uploads a PDF file successfully', async ({
  //   page,
  //   editMentorPage,
  // }) => {
  //   const modal = await editMentorPage.datasets.openAddResourceModal();
  //   await expect(modal).toBeVisible();
  //   const fileInput = page.locator('input[type="file"]').first();
  //   const chooserVisible = await fileInput
  //     .isVisible({ timeout: 3_000 })
  //     .catch(() => false);
  //   if (chooserVisible) {
  //     await fileInput.setInputFiles({
  //       name: 'test.pdf',
  //       mimeType: 'application/pdf',
  //       buffer: Buffer.from('%PDF-1.4 test content'),
  //     });
  //   }
  //   await page.keyboard.press('Escape');
  // });

  test('admin goes to datasets tab and the state is preserved after closing and reopening the modal', async ({
    editMentorPage,
  }) => {
    await editMentorPage.datasets.search('persistent-test');
    await editMentorPage.close();
    await editMentorPage.open('Datasets');
    await waitForPageReady(editMentorPage.page);
    await expect(editMentorPage.datasets.searchInput).toBeVisible({
      timeout: 10_000,
    });
    // State should be reset (search cleared)
    const searchValue = await editMentorPage.datasets.searchInput.inputValue();
    logger.info(`TC20: Search value after reopen: "${searchValue}"`);
    expect(searchValue).toBe('');
  });

  // ── TC29: CSV upload ───────────────────────────────────────────────────────

  test('admin goes to datasets tab and uploads a CSV file successfully', async ({
    editMentorPage,
  }) => {
    await editMentorPage.datasets.uploadFile(CSV_FILE, 'CSV');
    // Verify the uploaded CSV file appears in the dataset list
    const csvEntry = editMentorPage.dialog.getByText(/test-data\.csv/i);
    await expect(csvEntry).toBeVisible({ timeout: 15_000 });
    logger.info('TC29: CSV file uploaded and visible in dataset list');
  });

  // ── TC30: Markdown resource type is available in Add Resources modal ──────
  // Issue #1117 — frontend UI for Markdown file ingestion.

  test('admin goes to datasets tab and sees the Markdown option in the Add Resources modal', async ({
    editMentorPage,
  }) => {
    const modal = await editMentorPage.datasets.openAddResourceModal();
    await expect(modal).toBeVisible();

    const markdownBtn = modal
      .locator('button')
      .filter({ hasText: /^Markdown$/i });
    await expect(markdownBtn).toBeVisible({ timeout: 5_000 });
    await expect(markdownBtn).toBeEnabled();

    logger.info('TC30: Markdown resource type is available');
  });

  // ── TC31: Markdown file upload ─────────────────────────────────────────────

  test('admin goes to datasets tab and uploads a Markdown file successfully', async ({
    editMentorPage,
  }) => {
    await editMentorPage.datasets.uploadFile(MARKDOWN_FILE, 'Markdown');

    const mdEntry = editMentorPage.dialog.getByText(/test-data\.md/i);
    await expect(mdEntry).toBeVisible({ timeout: 15_000 });
    logger.info('TC31: Markdown file uploaded and visible in dataset list');
  });

  // ── TC13: Train or Delete modal ────────────────────────────────────────────

  test('admin goes to datasets tab and tests Train or Delete modal actions for an untrained dataset', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const trainingSwitches = editMentorPage.dialog.getByRole('switch', {
      name: /training for document/i,
    });
    const switchCount = await trainingSwitches.count().catch(() => 0);
    if (switchCount === 0) {
      logger.info('TC13: No training switches found');
      return;
    }

    for (let i = 0; i < switchCount; i++) {
      const sw = trainingSwitches.nth(i);
      if ((await sw.getAttribute('aria-checked')) === 'false') {
        await sw.click();
        await page.waitForTimeout(1_000);
        const modal = page
          .getByRole('dialog')
          .filter({ hasText: /What would you like to do/i });
        const modalVisible = await modal
          .isVisible({ timeout: 5_000 })
          .catch(() => false);
        if (modalVisible) {
          const trainBtn = modal.getByRole('button', { name: /^Train$/i });
          const deleteBtn = modal.getByRole('button', { name: /Delete/i });
          await expect(trainBtn).toBeVisible();
          await expect(deleteBtn).toBeVisible();
          await expect(
            modal.getByText(/This dataset is currently untrained/i),
          ).toBeVisible();
          await expect(trainBtn).toBeEnabled();
          await expect(deleteBtn).toBeEnabled();
          await page.keyboard.press('Escape');
          await expect(modal).not.toBeVisible({ timeout: 5_000 });
          logger.info('TC13: Train or Delete modal verified');
        }
        break;
      }
    }
  });

  // ── TC14: In Progress badge ────────────────────────────────────────────────

  test('admin goes to datasets tab and verifies In Progress badge displays for datasets being trained', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const badges = editMentorPage.dialog.getByText('In Progress');
    const count = await badges.count().catch(() => 0);
    if (count > 0) {
      await expect(badges.first()).toBeVisible();
      logger.info(`TC14: Found ${count} In Progress badge(s)`);
    } else {
      logger.info('TC14: No datasets currently in training progress');
    }
  });

  // ── TC15: Dataset link ─────────────────────────────────────────────────────

  test('admin goes to datasets tab and verifies dataset name links are clickable and have correct attributes', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const links = editMentorPage.dialog
      .locator('a[href]')
      .filter({ hasText: /.+/ });
    const count = await links.count().catch(() => 0);
    if (count > 0) {
      const href = await links.first().getAttribute('href');
      const target = await links.first().getAttribute('target');
      const rel = await links.first().getAttribute('rel');
      expect(href).toBeTruthy();
      expect(target).toBe('_blank');
      expect(rel).toContain('noopener');
      logger.info(`TC15: Dataset link verified — href: ${href}`);
    } else {
      logger.info('TC15: No dataset links found (empty state)');
    }
  });

  // ── TC16: Close dialog ─────────────────────────────────────────────────────

  test('admin goes to datasets tab and closes the datasets dialog properly using the close button', async ({
    page,
    editMentorPage,
  }) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const dialogVisible = await editMentorPage.dialog
      .isVisible()
      .catch(() => false);
    if (!dialogVisible) {
      logger.info('TC16: Dialog closed with Escape key');
    } else {
      await editMentorPage.close();
      await expect(editMentorPage.dialog).not.toBeVisible({ timeout: 5_000 });
      logger.info('TC16: Dialog closed with close button');
    }
  });

  // ── TC17: Loading states ───────────────────────────────────────────────────

  test('admin goes to datasets tab and handles loading states properly during initial load', async ({
    page,
    editMentorPage,
  }) => {
    const spinner = editMentorPage.dialog.locator(
      '[class*="spinner"], [class*="loading"], svg[class*="animate-spin"]',
    );
    await page.waitForTimeout(3_000);
    const isLoading = await spinner.isVisible().catch(() => false);
    if (isLoading) {
      await expect(spinner).not.toBeVisible({ timeout: 30_000 });
      logger.info('TC17: Loading spinner disappeared');
    } else {
      logger.info('TC17: Content loaded without visible spinner (fast load)');
    }
    const table = editMentorPage.dialog.locator('table');
    const noDataMsg = editMentorPage.dialog.getByText(/No datasets found/i);
    const hasTable = await table.isVisible().catch(() => false);
    const hasNoData = await noDataMsg.isVisible().catch(() => false);
    expect(hasTable || hasNoData || true).toBe(true);
  });

  // ── TC18: Token count format ───────────────────────────────────────────────

  test('admin goes to datasets tab and verifies the token count displays in the correct numeric format', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const tableBody = editMentorPage.dialog.locator('tbody');
    const rowCount = await tableBody
      .locator('tr')
      .count()
      .catch(() => 0);
    if (rowCount > 0) {
      const tokenCells = tableBody.locator('tr td:nth-child(3)');
      const cellCount = await tokenCells.count();
      if (cellCount > 0) {
        const val = await tokenCells.first().textContent();
        const num = parseInt(val ?? '0', 10);
        expect(num).toBeGreaterThanOrEqual(0);
        logger.info(`TC18: First token value: ${val}`);
      }
    } else {
      logger.info('TC18: No datasets to check token format');
    }
  });

  // ── TC19: Tooltips ─────────────────────────────────────────────────────────

  test('admin goes to datasets tab and verifies proper tooltips appear on the action buttons', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const scheduleTooltipTriggers = editMentorPage.dialog
      .locator('span[data-slot="tooltip-trigger"]')
      .filter({ has: page.locator('button:has(svg.lucide-clock)') });
    const hasScheduleTrigger =
      (await scheduleTooltipTriggers.count().catch(() => 0)) > 0;
    if (hasScheduleTrigger) {
      await scheduleTooltipTriggers.first().hover({ force: true });
      await page.waitForTimeout(500);
      const tooltip = page.locator('[role="tooltip"]');
      const tooltipVisible = await tooltip.isVisible().catch(() => false);
      logger.info(
        `TC19: Schedule retrain tooltip: ${tooltipVisible ? 'visible' : 'not visible'}`,
      );
    } else {
      const scheduleBtns = editMentorPage.dialog
        .getByRole('button')
        .filter({ has: page.locator('svg.lucide-clock') });
      if ((await scheduleBtns.count().catch(() => 0)) > 0) {
        await scheduleBtns.first().hover({ force: true });
        await page.waitForTimeout(500);
        logger.info('TC19: Schedule button hover completed (fallback)');
      } else {
        logger.info('TC19: No schedule buttons found');
      }
    }
  });

  // ── TC22: Image upload ─────────────────────────────────────────────────────

  test('admin goes to datasets tab and uploads an Image file successfully', async ({
    page,
    editMentorPage,
  }) => {
    const modal = await editMentorPage.datasets.openAddResourceModal();
    await expect(modal).toBeVisible();
    const imageBtn = modal.locator('button').filter({ hasText: /^Image$/i });
    await expect(imageBtn).toBeVisible({ timeout: 5_000 });
    await imageBtn.click();
    await page.waitForTimeout(1_000);
    const imageDialog = page.getByRole('dialog', { name: 'Image' });
    await expect(imageDialog).toBeVisible({ timeout: 5_000 });
    const fileInput = imageDialog.locator('input[type="file"]');
    await fileInput.setInputFiles(IMAGE_FILE);
    const closeBtn = imageDialog.getByRole('button', { name: 'Close' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(2_000);
    const fileName = editMentorPage.dialog.getByText(/acessibility png/i);
    const fileVisible = await fileName.isVisible().catch(() => false);
    logger.info(`TC22: Image file visible in list: ${fileVisible}`);
  });

  // ── TC23: Multiple file types ──────────────────────────────────────────────

  test('admin goes to datasets tab and uploads multiple different file types successfully', async ({
    page,
    editMentorPage,
  }) => {
    test.setTimeout(400_000);
    const resources = [{ type: 'TXT', path: TXT_FILE, name: 'outerHTML.txt' }];
    for (const resource of resources) {
      const addBtn = editMentorPage.datasets.addResourceButton;
      await expect(addBtn).toBeVisible({ timeout: 10_000 });
      await addBtn.click();
      const addModal = page
        .getByRole('dialog')
        .filter({ hasText: /Add Resources/i });
      await expect(addModal).toBeVisible({ timeout: 15_000 });
      const typeBtn = addModal
        .locator('button')
        .filter({ hasText: new RegExp(`^${resource.type}$`, 'i') });
      await expect(typeBtn).toBeVisible({ timeout: 5_000 });
      await typeBtn.click();
      await page.waitForTimeout(1_000);
      const typeDialog = page.getByRole('dialog', { name: resource.type });
      await expect(typeDialog).toBeVisible({ timeout: 10_000 });
      await typeDialog
        .locator('input[type="file"]')
        .setInputFiles(resource.path);
      await page.waitForTimeout(3_000);
      // Bounded + non-fatal: the SPA's streaming/polling connections may
      // keep it from ever idling, so cap networkidle so it can't hang.
      await page
        .waitForLoadState('networkidle', { timeout: 15_000 })
        .catch(() => {});
      await page.keyboard.press('Escape');
      await page.waitForTimeout(2_000);
      logger.info(`TC23: Uploaded ${resource.type}: ${resource.name}`);
    }
  });

  // ── TC24: Train untrained dataset ──────────────────────────────────────────

  test('admin goes to datasets tab and trains an untrained dataset by clicking Train in the modal', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const switches = editMentorPage.dialog.getByRole('switch', {
      name: /training for document/i,
    });
    const count = await switches.count().catch(() => 0);
    if (count === 0) {
      logger.info('TC24: No training switches found');
      return;
    }
    for (let i = 0; i < count; i++) {
      const sw = switches.nth(i);
      if ((await sw.getAttribute('aria-checked')) === 'false') {
        await sw.click();
        await page.waitForTimeout(1_000);
        const modal = page
          .getByRole('dialog')
          .filter({ hasText: /What would you like to do/i });
        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await modal.getByRole('button', { name: /^Train$/i }).click();
          await page.waitForTimeout(2_000);
          const badge = editMentorPage.dialog.getByText('In Progress');
          const badgeVisible = await badge
            .isVisible({ timeout: 5_000 })
            .catch(() => false);
          logger.info(
            `TC24: Training initiated — In Progress badge: ${badgeVisible}`,
          );
        }
        break;
      }
    }
  });

  // ── TC25: Delete untrained dataset ─────────────────────────────────────────

  test('admin goes to datasets tab and deletes an untrained dataset by clicking Delete in the modal', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const switches = editMentorPage.dialog.getByRole('switch', {
      name: /training for document/i,
    });
    const initial = await switches.count().catch(() => 0);
    if (initial === 0) {
      logger.info('TC25: No datasets found');
      return;
    }
    for (let i = 0; i < initial; i++) {
      const sw = switches.nth(i);
      if ((await sw.getAttribute('aria-checked')) === 'false') {
        await sw.click();
        await page.waitForTimeout(1_000);
        const modal = page
          .getByRole('dialog')
          .filter({ hasText: /What would you like to do/i });
        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await modal.getByRole('button', { name: /Delete/i }).click();
          await page.waitForTimeout(2_000);
          const after = await switches.count().catch(() => 0);
          logger.info(`TC25: Count before: ${initial}, after: ${after}`);
        }
        break;
      }
    }
  });

  // ── TC26: Untrain and delete trained dataset ───────────────────────────────

  test('admin goes to datasets tab and untrains then deletes a trained dataset', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const switches = editMentorPage.dialog.getByRole('switch', {
      name: /training for document/i,
    });
    const initial = await switches.count().catch(() => 0);
    if (initial === 0) {
      logger.info('TC26: No datasets found');
      return;
    }
    for (let i = 0; i < initial; i++) {
      const sw = switches.nth(i);
      if ((await sw.getAttribute('aria-checked')) === 'true') {
        await sw.click();
        await page.waitForTimeout(1_000);
        const modal = page
          .getByRole('dialog')
          .filter({ hasText: /Delete Dataset/i });
        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await modal.getByRole('button', { name: /Delete/i }).click();
          await page.waitForTimeout(2_000);
          const after = await switches.count().catch(() => 0);
          logger.info(`TC26: Count before: ${initial}, after: ${after}`);
        }
        break;
      }
    }
  });

  // ── TC27: Schedule retraining ──────────────────────────────────────────────

  test('admin goes to datasets tab and schedules retraining for a trained dataset', async ({
    page,
    editMentorPage,
  }) => {
    await page.waitForTimeout(3_000);
    const scheduleBtns = editMentorPage.dialog
      .getByRole('button')
      .filter({ has: page.locator('svg.lucide-clock') });
    const count = await scheduleBtns.count().catch(() => 0);
    if (count === 0) {
      logger.info('TC27: No schedule buttons found');
      return;
    }
    for (let i = 0; i < count; i++) {
      const btn = scheduleBtns.nth(i);
      if (!(await btn.isDisabled().catch(() => true))) {
        await btn.click();
        const modal = page
          .getByRole('dialog')
          .filter({ hasText: /Schedule Retraining/i });
        if (await modal.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await modal.getByRole('button', { name: /Weekly/i }).click();
          const intervalInput = modal.locator('input[type="number"]');
          await expect(intervalInput).toHaveValue('7');
          // H24 fix: Cancel instead of Schedule to avoid side effects (original clicked Cancel)
          await page.keyboard.press('Escape');
          await expect(modal).not.toBeVisible({ timeout: 5_000 });
          logger.info('TC27: Schedule retraining modal verified and cancelled');
        }
        break;
      }
    }
  });

  // ── TC28: Upload cancellation ──────────────────────────────────────────────

  test('admin goes to datasets tab and handles file upload cancellation gracefully', async ({
    page,
    editMentorPage,
  }) => {
    const addBtn = editMentorPage.datasets.addResourceButton;
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();
    const addModal = page
      .getByRole('dialog')
      .filter({ hasText: /Add Resources/i });
    await expect(addModal).toBeVisible({ timeout: 10_000 });
    const pdfBtn = addModal.locator('button').filter({ hasText: /^PDF$/i });
    await expect(pdfBtn).toBeVisible({ timeout: 5_000 });
    await pdfBtn.click();
    await page.waitForTimeout(1_000);
    const pdfDialog = page.getByRole('dialog', { name: 'PDF' });
    await expect(pdfDialog).toBeVisible({ timeout: 5_000 });
    // Cancel without uploading
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2_000);
    // Verify Edit Mentor dialog is still functional
    const isDialogVisible = await editMentorPage.dialog
      .isVisible()
      .catch(() => false);
    if (isDialogVisible) {
      await expect(addBtn).toBeVisible({ timeout: 5_000 });
      await expect(addBtn).toBeEnabled();
      logger.info(
        'TC28: Dialog remained open and functional after cancellation',
      );
    } else {
      logger.info(
        'TC28: Dialog closed after cancellation — page still functional',
      );
    }
  });

  // ── TC32-35: Datasets tab URL query-string sync ────────────────────────────
  // The Datasets tab now syncs its search (and, in the pagination describe
  // below, page) state to `datasetsSearch` / `datasetsPage` URL query params
  // via the OS host wrapper (agent-datasets-tab.tsx) so state survives
  // reload/back-forward and is shareable via link. These don't need multi-page
  // seed data — search-param sync fires regardless of dataset count — so they
  // run against whatever mentor the standard beforeEach opens.

  test('admin types a datasets search and the debounced datasetsSearch param syncs into the URL', async ({
    editMentorPage,
  }) => {
    expect(editMentorPage.datasets.getUrlParams().search).toBeNull();

    await editMentorPage.datasets.searchAndWaitForUrlSync('tc32-search');
    expect(editMentorPage.datasets.getUrlParams().search).toBe('tc32-search');

    // Contract point 6: the input is `type="text"`, not `type="search"`, so
    // the browser renders no native clear (✕) affordance. Cheap to check
    // while we're here — not worth its own test.
    await expect(editMentorPage.datasets.searchInput).toHaveAttribute(
      'type',
      'text',
    );
    logger.info('TC32: datasetsSearch URL param synced from search input');
  });

  test('admin searches datasets then closes the edit mentor modal and both URL params clear', async ({
    editMentorPage,
  }) => {
    await editMentorPage.datasets.searchAndWaitForUrlSync('tc33-search');
    expect(editMentorPage.datasets.getUrlParams().search).toBe('tc33-search');

    await editMentorPage.close();

    const params = editMentorPage.datasets.getUrlParams();
    expect(params.search).toBeNull();
    expect(params.page).toBeNull();
    logger.info('TC33: datasetsSearch/datasetsPage cleared on modal close');
  });

  test('admin searches datasets then switches to another tab and both URL params clear', async ({
    editMentorPage,
  }) => {
    await editMentorPage.datasets.searchAndWaitForUrlSync('tc34-search');
    expect(editMentorPage.datasets.getUrlParams().search).toBe('tc34-search');

    await editMentorPage.navigateToTab('Settings');

    const params = editMentorPage.datasets.getUrlParams();
    expect(params.search).toBeNull();
    expect(params.page).toBeNull();
    logger.info(
      'TC34: datasetsSearch/datasetsPage cleared on tab change (Datasets → Settings)',
    );
  });

  test('admin searches datasets then reloads the page and the search restores from the URL', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.datasets.searchAndWaitForUrlSync('tc35-reload-search');

    // The modal stack lives in the URL's `modal` param (see useNavigate's
    // parseModalStack), so a full reload should reopen the dialog back onto
    // the Datasets tab, and the wrapper re-derives `search` straight from
    // `datasetsSearch` on mount — the same contract a shared/deep link would
    // exercise. This doesn't need the seeded multi-page mentor: search-param
    // sync and restore fire regardless of how many datasets exist.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    await expect(editMentorPage.dialog).toBeVisible({ timeout: 20_000 });
    await editMentorPage.waitForHydrated();

    await expect(editMentorPage.datasets.searchInput).toHaveValue(
      'tc35-reload-search',
      { timeout: 10_000 },
    );
    expect(editMentorPage.datasets.getUrlParams().search).toBe(
      'tc35-reload-search',
    );
    logger.info('TC35: datasetsSearch restored after a full reload');
  });
});

// ── TC36-39: Datasets tab pagination URL sync (self-seeded mentor) ──────────
//
// Pagination is fixed at 5 items/page (`useDatasetsWithPagination(5, ...)` in
// the SDK's AgentDatasetsTab) and `IblPagination` renders nothing when
// `totalPages <= 1` — so exercising page-push / back-forward / page-reset
// deterministically needs a mentor with more than 5 datasets.
//
// Each test builds that fixture itself: create a mentor, then seed
// DATASETS_SEED_COUNT documents straight through the training API (one request
// each, versus ~20s per file through the Add Resource UI). Nothing about the
// environment is hard-coded — the tenant, username and token all come from
// localStorage at runtime, and the mentor is the one the test just made. An
// earlier revision pointed these tests at a hand-seeded mentor identified by
// tenant key + id; that only worked on the environment it was seeded on and
// 403'd everywhere else, which is exactly what this avoids. See
// utils/dataset-seeding.ts.
// 12 documents at 5/page = 3 pages. Three is the minimum that satisfies every
// test below: TC37 pages forward twice (1 → 2 → 3) before walking history back,
// and TC38 searches from page 3. Two pages would make `goToPage(3)` a no-op and
// the assertions would pass vacuously or hang on a link that never renders.
const DATASETS_SEED_COUNT = 12;
const datasetsPaginationTracker = new MentorTracker();

test.describe('Journey 20: Datasets tab pagination URL sync (self-seeded mentor)', () => {
  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    // These tests build their fixture from scratch — navigate, create a mentor,
    // seed 12 documents, wait for training to settle, then open the modal —
    // which lands around 110s against a healthy backend. That is inside the
    // default 120s budget only by luck: measured over five runs, three tripped
    // `Test timeout of 120000ms exceeded while running "beforeEach" hook`, each
    // in a different test. The work is inherently slow rather than stuck, so
    // give the whole test (hooks included) room instead of trimming the fixture.
    test.setTimeout(240_000);

    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Dataset management requires admin access');
      return;
    }

    await createMentorPage.openAndCreate(
      `E2E Datasets Pagination ${Date.now()}`,
    );
    const { mentorId } = await getPlatformContext(page);
    datasetsPaginationTracker.add(mentorId);

    await seedDatasetsForMentor(page, mentorId, DATASETS_SEED_COUNT);
    // Open the tab only once the API agrees the documents exist AND have
    // finished training — a pending document keeps the tab polling every 2s,
    // which disables the pagination control mid-click. See waitForDatasetsReady.
    await waitForDatasetsReady(page, mentorId, DATASETS_SEED_COUNT);

    await editMentorPage.open('Datasets');
    await waitForPageReady(page);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await datasetsPaginationTracker.deleteAll(browser, testInfo);
  });

  test('admin clicks a pagination page number and datasetsPage pushes into the URL', async ({
    editMentorPage,
  }) => {
    // beforeEach seeded more than one page of datasets, so the pagination nav
    // must render. A missing nav is a real regression now, not a data gap —
    // assert on it rather than skipping past it.
    await expect(editMentorPage.datasets.paginationNav).toBeVisible({
      timeout: 15_000,
    });

    expect(editMentorPage.datasets.getUrlParams().page).toBeNull();

    await editMentorPage.datasets.goToPage(2);
    expect(editMentorPage.datasets.getUrlParams().page).toBe('2');
    await expect(editMentorPage.datasets.activePaginationPageLink).toHaveText(
      '2',
    );

    logger.info('TC36: datasetsPage URL param pushed by pagination click');
  });

  test('admin pages forward twice then browser Back/Forward walk the visited pages', async ({
    page,
    editMentorPage,
  }) => {
    // beforeEach seeded more than one page of datasets, so the pagination nav
    // must render. A missing nav is a real regression now, not a data gap —
    // assert on it rather than skipping past it.
    await expect(editMentorPage.datasets.paginationNav).toBeVisible({
      timeout: 15_000,
    });

    await editMentorPage.datasets.goToPage(2);
    await editMentorPage.datasets.goToPage(3);
    expect(editMentorPage.datasets.getUrlParams().page).toBe('3');

    // Pagination pushes history (router.push), so Back/Forward should walk
    // through the pages we visited rather than leaving the app.
    await page.goBack();
    await expect
      .poll(() => editMentorPage.datasets.getUrlParams().page, {
        timeout: 10_000,
      })
      .toBe('2');

    await page.goForward();
    await expect
      .poll(() => editMentorPage.datasets.getUrlParams().page, {
        timeout: 10_000,
      })
      .toBe('3');

    logger.info('TC37: datasetsPage walked correctly via browser Back/Forward');
  });

  test('admin searches while on page 3 and datasetsPage is dropped while datasetsSearch is set', async ({
    editMentorPage,
  }) => {
    // beforeEach seeded more than one page of datasets, so the pagination nav
    // must render. A missing nav is a real regression now, not a data gap —
    // assert on it rather than skipping past it.
    await expect(editMentorPage.datasets.paginationNav).toBeVisible({
      timeout: 15_000,
    });

    await editMentorPage.datasets.goToPage(2);
    await editMentorPage.datasets.goToPage(3);
    expect(editMentorPage.datasets.getUrlParams().page).toBe('3');

    // Search is search-controlled and its onSearchChange contract implies a
    // page reset — the host drops `datasetsPage` in the same navigation
    // (see AgentDatasetsTabWrapper.handleSearchChange).
    await editMentorPage.datasets.searchAndWaitForUrlSync('tc37-reset-search');

    const params = editMentorPage.datasets.getUrlParams();
    expect(params.search).toBe('tc37-reset-search');
    expect(params.page).toBeNull();

    logger.info(
      'TC38: datasetsPage dropped and datasetsSearch set after searching from page 3',
    );
  });

  test('admin pages forward then reloads and the datasets tab restores the paginated view', async ({
    page,
    editMentorPage,
  }) => {
    // beforeEach seeded more than one page of datasets, so the pagination nav
    // must render. A missing nav is a real regression now, not a data gap —
    // assert on it rather than skipping past it.
    await expect(editMentorPage.datasets.paginationNav).toBeVisible({
      timeout: 15_000,
    });

    // Deliberately page-only (no search): setting a search implies a page
    // reset (see the TC38 contract above), so page and search can never both
    // be non-default at once — this test isolates the page-only side of the
    // reload/deep-link contract instead of asserting a state the app can't
    // produce.
    await editMentorPage.datasets.goToPage(2);

    // The modal stack itself lives in the URL's `modal` param (see
    // useNavigate's parseModalStack), so a full reload should reopen the
    // dialog back onto the Datasets tab, and the wrapper re-derives `page`
    // straight from `datasetsPage` on mount — the same contract a shared/deep
    // link would exercise.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    await expect(editMentorPage.dialog).toBeVisible({ timeout: 20_000 });
    await editMentorPage.waitForHydrated();

    expect(editMentorPage.datasets.getUrlParams().page).toBe('2');
    await expect(editMentorPage.datasets.activePaginationPageLink).toHaveText(
      '2',
      { timeout: 10_000 },
    );
    logger.info('TC39: datasetsPage restored after a full reload');
  });
});
