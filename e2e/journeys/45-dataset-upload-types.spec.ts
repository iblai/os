/**
 * Journey 45: Dataset Upload Types
 *
 * Verifies that each of the 8 local file-upload resource types in the Add
 * Resources modal accepts a real fixture file and that the uploaded file
 * subsequently appears as a row in the dataset list.
 *
 * Each test creates a FRESH mentor first so uploads are made against a clean
 * dataset list — pre-existing rows from other tests can't mask a missing
 * upload. The pattern matches journey 36 (Copy Mentor):
 *   navigate → check admin → createMentorPage.openAndCreate() →
 *   editMentorPage.open('Datasets') → uploadFile(...) → assert row.
 *
 * All 8 resource types are `type: 'local'` in resource-types.tsx, so clicking
 * any of them opens the ResourceModal (not a cloud-picker flow). The
 * DatasetsTab.uploadFile() helper handles the full flow:
 *   open Add Resources modal → click resource type button → setInputFiles →
 *   click Submit → wait networkidle → close dialogs.
 *
 * Assertion: the uploaded filename must appear in the dataset list within 15 s.
 * A failed upload → no row → the test fails loudly. No try/catch, no soft
 * assertions — same rigor as journey 44.
 *
 * Cleanup: the freshly-created mentors are left in place. cleanup.spec.ts
 * (or manual teardown) removes E2E test mentors after the suite runs.
 */

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { logger } from '@iblai/iblai-js/playwright';
import path from 'path';

const FILES_DIR = path.resolve(__dirname, '../../e2e/files/testing_folder');

const PPTX_FILE = path.join(FILES_DIR, 'Title Lorem Ipsum.pptx');
const DOCX_FILE = path.join(FILES_DIR, 'audrey.docx');
const XLSX_FILE = path.join(FILES_DIR, 'test-data.xlsx');
const CSV_FILE = path.join(FILES_DIR, 'test-data.csv');
const TXT_FILE = path.join(FILES_DIR, 'outerHTML.txt');
const MP3_FILE = path.join(FILES_DIR, 'Fally_Ipupa_-_Nous2_CeeNaija.com_.mp3');
const MP4_FILE = path.join(FILES_DIR, 'IMG_4019.MP4');
const PNG_FILE = path.join(FILES_DIR, 'acessibility png.png');

test.describe('Journey 45: Dataset Upload Types', () => {
  // Each test creates a mentor + uploads a file; videos and PowerPoint
  // can be slow under load, so allow a generous per-test budget.
  test.setTimeout(200_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    // Hard-fail on non-admin — same pattern as journey 44.
    // If the test user is not admin, the environment is misconfigured.
    expect(
      isAdmin,
      'Test user must be admin — check PLAYWRIGHT_USERNAME in e2e/.env.local',
    ).toBe(true);
  });

  // ── du-01: PowerPoint ──────────────────────────────────────────────────────

  test('admin creates a mentor and uploads a PowerPoint file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(PPTX_FILE, 'PowerPoint');

    const entry = editMentorPage.dialog.getByText(/Title Lorem Ipsum\.pptx/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-01: PowerPoint file uploaded and visible in dataset list');
  });

  // ── du-02: DOCX ────────────────────────────────────────────────────────────

  test('admin creates a mentor and uploads a DOCX file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(DOCX_FILE, 'DOCX');

    const entry = editMentorPage.dialog.getByText(/audrey\.docx/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-02: DOCX file uploaded and visible in dataset list');
  });

  // ── du-03: CSV ─────────────────────────────────────────────────────────────

  test('admin creates a mentor and uploads a CSV file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(CSV_FILE, 'CSV');

    const entry = editMentorPage.dialog.getByText(/test-data\.csv/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-03: CSV file uploaded and visible in dataset list');
  });

  // ── du-04: TXT ─────────────────────────────────────────────────────────────

  test('admin creates a mentor and uploads a TXT file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(TXT_FILE, 'TXT');

    const entry = editMentorPage.dialog.getByText(/outerHTML\.txt/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-04: TXT file uploaded and visible in dataset list');
  });

  // ── du-05: Audio ───────────────────────────────────────────────────────────

  test('admin creates a mentor and uploads an Audio file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(MP3_FILE, 'Audio');

    // The backend receives the filename as-is. Match on the distinctive
    // prefix rather than the full URL-encoded name.
    const entry = editMentorPage.dialog.getByText(/Fally_Ipupa/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-05: Audio file uploaded and visible in dataset list');
  });

  // ── du-06: Video ───────────────────────────────────────────────────────────

  test('admin creates a mentor and uploads a Video file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    // Large video uploads can be slow — the suite-level setTimeout(200_000)
    // gives the upload + networkidle step room to breathe. If the file is
    // too large for the CI upload limit this test will fail loudly, which
    // is the correct behaviour (do not catch or skip).
    await editMentorPage.datasets.uploadFile(MP4_FILE, 'Video');

    const entry = editMentorPage.dialog.getByText(/IMG_4019/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-06: Video file uploaded and visible in dataset list');
  });

  // ── du-07: Image ───────────────────────────────────────────────────────────

  test('admin creates a mentor and uploads an Image file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(PNG_FILE, 'Image');

    const entry = editMentorPage.dialog.getByText(/acessibility png/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-07: Image file uploaded and visible in dataset list');
  });

  // ── du-08: Excel ───────────────────────────────────────────────────────────

  test('admin creates a mentor and uploads an Excel file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(XLSX_FILE, 'Excel');

    const entry = editMentorPage.dialog.getByText(/test-data\.xlsx/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-08: Excel file uploaded and visible in dataset list');
  });
});
