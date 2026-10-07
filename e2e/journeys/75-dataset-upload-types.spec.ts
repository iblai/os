/**
 * Journey 75: Dataset Upload Types
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
import { expectedResourceEnabled } from '../utils/dataset-resource-gating';
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
const PDF_FILE = path.join(
  FILES_DIR,
  '0028-oop-object-oriented-programming-using-cpp.pdf',
);
const ZIP_FILE = path.join(FILES_DIR, 'test-data.zip');

// Small, stable, public targets for the URL-shaped resource types — kept
// minimal (no large crawl depth/page counts) per the resource's own docs.
const EXAMPLE_URL = 'https://example.com';
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const GITHUB_REPO_URL = 'https://github.com/octocat/Hello-World';

test.describe('Journey 75: Dataset Upload Types', () => {
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

  // ── du-09: PDF ─────────────────────────────────────────────────────────────
  // Was commented out in journey 20 (TC — see 20:189-207); reinstated here in
  // the journey-75 style: real submit, hard assert the row appears.

  test('admin creates a mentor and uploads a PDF file to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.uploadFile(PDF_FILE, 'PDF');

    const entry = editMentorPage.dialog.getByText(/0028-oop/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-09: PDF file uploaded and visible in dataset list');
  });

  // ── du-10: URL ─────────────────────────────────────────────────────────────

  test('admin creates a mentor and adds a URL resource to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.submitUrlLikeResource('url', EXAMPLE_URL);

    const entry = editMentorPage.dialog.getByText(/example\.com/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info('du-10: URL resource submitted and visible in dataset list');
  });

  // ── du-11: YouTube ─────────────────────────────────────────────────────────

  test('admin creates a mentor and adds a YouTube resource to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.submitUrlLikeResource('youtube', YOUTUBE_URL);

    // The row shows document_name once the backend resolves the video's
    // title, else falls back to the raw URL — match either so this isn't
    // coupled to how fast that metadata lookup settles.
    const entry = editMentorPage.dialog.getByText(
      /dQw4w9WgXcQ|Rick Astley|Never Gonna Give You Up/i,
    );
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info(
      'du-11: YouTube resource submitted and visible in dataset list',
    );
  });

  // ── du-12: GitHub ──────────────────────────────────────────────────────────

  test('admin creates a mentor and adds a GitHub repo resource to its datasets tab', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    await editMentorPage.datasets.submitGithubResource(GITHUB_REPO_URL);

    const entry = editMentorPage.dialog.getByText(/Hello-World|octocat/i);
    await expect(entry).toBeVisible({ timeout: 20_000 });
    logger.info('du-12: GitHub resource submitted and visible in dataset list');
  });

  // ── du-13/14: Web Crawler + optional User-Agent ───────────────────────────
  // The Web Crawler create form's "User-Agent (optional)" field is sent as
  // `crawler_extra_headers: { 'User-Agent': <value> }` on the POST to
  // `.../documents/train/` ONLY when non-blank (see
  // `useWebsiteCrawlerResource` in `@iblai/web-containers`). Assert both
  // directions directly off the network request rather than trusting the UI
  // alone, since that's the actual shipped contract.

  test('admin creates a mentor and adds a Web Crawler resource with a User-Agent, which is sent as crawler_extra_headers', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    const userAgent = 'E2E-Test-Bot/1.0';
    const dialog = await editMentorPage.datasets.openAndFillWebCrawlerResource({
      url: EXAMPLE_URL,
      maxDepth: 1,
      maxPages: 1,
      userAgent,
    });

    const createRequestPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/documents/train/') && req.method() === 'POST',
      { timeout: 15_000 },
    );
    await editMentorPage.datasets.submitButtonIn(dialog).click();
    const createRequest = await createRequestPromise;

    const postData = createRequest.postData() ?? '';
    expect(postData).toContain('crawler_extra_headers');
    expect(postData).toContain(userAgent);
    logger.info(
      'du-13: Web Crawler create request carried crawler_extra_headers with the filled User-Agent',
    );

    await editMentorPage.datasets.closeResourceDialogAndModal(dialog);
    const entry = editMentorPage.dialog.getByText(/example\.com/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
  });

  test('admin creates a mentor and adds a Web Crawler resource with no User-Agent, which omits crawler_extra_headers', async ({
    page,
    createMentorPage,
    editMentorPage,
  }) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    const dialog = await editMentorPage.datasets.openAndFillWebCrawlerResource({
      url: EXAMPLE_URL,
      maxDepth: 1,
      maxPages: 1,
      // userAgent intentionally omitted/blank
    });

    const createRequestPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/documents/train/') && req.method() === 'POST',
      { timeout: 15_000 },
    );
    await editMentorPage.datasets.submitButtonIn(dialog).click();
    const createRequest = await createRequestPromise;

    const postData = createRequest.postData() ?? '';
    expect(postData).not.toContain('crawler_extra_headers');
    logger.info(
      'du-14: Web Crawler create request omitted crawler_extra_headers when User-Agent was left blank',
    );

    await editMentorPage.datasets.closeResourceDialogAndModal(dialog);
    const entry = editMentorPage.dialog.getByText(/example\.com/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
  });

  // ── du-15/16: ZIP and Course — config-gated resource types ────────────────
  // Disabled by default (`NEXT_PUBLIC_DISABLED_DATASETS` defaults to
  // 'zip|courses' — see lib/config.ts's `disabedDatasets()`). The expected
  // state is read independently of the button under test (see
  // `dataset-resource-gating.ts`) so a mismatch in either direction fails
  // rather than the test silently skipping past it.

  test('admin creates a mentor and sees the ZIP resource button match its configured enabled/disabled state', async ({
    page,
    createMentorPage,
    editMentorPage,
  }, testInfo) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    const modal = await editMentorPage.datasets.openAddResourceModal();
    const zipButton = editMentorPage.datasets.resourceButton(modal, 'zip');
    await expect(zipButton).toBeVisible({ timeout: 10_000 });

    const expectedEnabled = await expectedResourceEnabled(page, 'zip');
    testInfo.annotations.push({
      type: 'gating-branch',
      description: `zip expectedEnabled=${expectedEnabled}`,
    });

    if (!expectedEnabled) {
      await expect(zipButton).toBeDisabled();
      logger.info('du-15: ZIP is disabled as expected — full flow not run');
      return;
    }

    await expect(zipButton).toBeEnabled();
    await editMentorPage.datasets.uploadFile(ZIP_FILE, 'ZIP');
    const entry = editMentorPage.dialog.getByText(/test-data\.zip/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info(
      'du-15: ZIP is enabled — full upload flow ran and row appeared',
    );
  });

  test('admin creates a mentor and sees the Course resource button match its configured enabled/disabled state', async ({
    page,
    createMentorPage,
    editMentorPage,
  }, testInfo) => {
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Datasets');
    await waitForPageReady(page);

    const modal = await editMentorPage.datasets.openAddResourceModal();
    const courseButton = editMentorPage.datasets.resourceButton(
      modal,
      'courses',
    );
    await expect(courseButton).toBeVisible({ timeout: 10_000 });

    const expectedEnabled = await expectedResourceEnabled(page, 'courses');
    testInfo.annotations.push({
      type: 'gating-branch',
      description: `courses expectedEnabled=${expectedEnabled}`,
    });

    if (!expectedEnabled) {
      await expect(courseButton).toBeDisabled();
      logger.info('du-16: Course is disabled as expected — full flow not run');
      return;
    }

    // Enabled Course resource renders a generic file-upload dialog
    // (`LocalFileUploadModal`, same component PDF/DOCX/etc. use) — not a
    // course browser — per the SDK's resource-types definition
    // (id: 'courses', type: 'local'). No feasible generic fixture exists for
    // "a course" beyond a file, so this exercises the same upload flow the
    // other local types use.
    await expect(courseButton).toBeEnabled();
    await editMentorPage.datasets.uploadFile(PDF_FILE, 'Course');
    const entry = editMentorPage.dialog.getByText(/0028-oop/i);
    await expect(entry).toBeVisible({ timeout: 15_000 });
    logger.info(
      'du-16: Course is enabled — full upload flow ran and row appeared',
    );
  });
});
