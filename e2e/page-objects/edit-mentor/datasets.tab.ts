import { Page, Locator, expect } from '@playwright/test';
import type { DatasetResourceId } from '../../utils/dataset-resource-gating';

// URL query keys the SDK Datasets tab owns, synced by the OS host wrapper
// (components/modals/edit-mentor-modal/tabs/datasets-tab/agent-datasets-tab.tsx)
// from lib/constants.ts's `DATASETS_TAB_URL_PARAMS`. Page objects don't import
// app source, so these are duplicated here as literals — keep in sync if the
// constant is ever renamed.
export const DATASETS_PAGE_PARAM = 'datasetsPage';
export const DATASETS_SEARCH_PARAM = 'datasetsSearch';

// Visible button label in the Add Resources modal for each gate-able resource
// id (see `dataset-resource-gating.ts`). Verified against the live
// `.yalc/@iblai/web-containers` resource-types definition on 2026-09-28 —
// keep in sync if the SDK ever renames a label.
export const RESOURCE_LABEL_BY_ID: Record<DatasetResourceId, string> = {
  powerpoint: 'PowerPoint',
  onedrive: 'Microsoft OneDrive',
  'google-drive': 'Google Drive',
  dropbox: 'Dropbox',
  youtube: 'YouTube',
  url: 'URL',
  pdf: 'PDF',
  docx: 'DOCX',
  excel: 'Excel',
  csv: 'CSV',
  github: 'GitHub',
  text: 'TXT',
  markdown: 'Markdown',
  audio: 'Audio',
  video: 'Video',
  image: 'Image',
  'web-crawler': 'Web Crawler',
  zip: 'ZIP',
  courses: 'Course',
};

export class DatasetsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly searchInput: Locator;
  readonly addResourceButton: Locator;
  readonly datasetRows: Locator;
  readonly emptyState: Locator;
  readonly paginationNext: Locator;
  readonly trainingSwitch: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.searchInput = dialog.getByPlaceholder(/search datasets/i);
    this.addResourceButton = dialog.getByRole('button', {
      name: /add resource/i,
    });
    this.datasetRows = dialog.locator(
      '[class*="dataset-row"], [data-testid*="dataset-row"]',
    );
    this.emptyState = dialog.getByText(/no datasets/i);
    this.paginationNext = dialog.getByRole('button', { name: /next/i });
    // H22 fix: training switch uses "training for document" name pattern
    this.trainingSwitch = dialog
      .getByRole('switch', { name: /training for document/i })
      .first();
    this.deleteButton = dialog.getByRole('button', { name: /delete/i }).first();
  }

  // H22 fix: visibility toggle is an eye-icon button, not a switch
  get visibilityToggle(): Locator {
    return this.dialog
      .getByRole('button')
      .filter({ has: this.page.locator('svg.lucide-eye, svg.lucide-eye-off') })
      .first();
  }

  // H23 fix: schedule retrain button is identified by clock icon, not name
  get scheduleRetrainButton(): Locator {
    return this.dialog
      .getByRole('button')
      .filter({ has: this.page.locator('svg.lucide-clock') })
      .first();
  }

  // The shadcn Pagination's Prev/Next/page links render as plain `<a>`
  // elements with no `href` attribute (onClick-driven) — without an `href`,
  // browsers don't expose an implicit ARIA "link" role, so `getByRole('link')`
  // won't match them. The `<nav>` wrapper DOES set an explicit
  // `role="navigation"` (and `aria-label="pagination"`, see
  // messages/en.json's uiPagination.paginationAriaLabel), which getByRole
  // reliably resolves regardless of the anchors' role mapping. Scope every
  // pagination locator through this container and fall back to CSS/text
  // matching for the anchors themselves.
  get paginationNav(): Locator {
    return this.dialog.getByRole('navigation', { name: /pagination/i });
  }

  get paginationNextLink(): Locator {
    return this.paginationNav.locator('a[aria-label="Go to next page"]');
  }

  get paginationPreviousLink(): Locator {
    return this.paginationNav.locator('a[aria-label="Go to previous page"]');
  }

  get activePaginationPageLink(): Locator {
    return this.paginationNav.locator('a[aria-current="page"]');
  }

  paginationPageLink(pageNumber: number): Locator {
    return this.paginationNav
      .locator('a')
      .filter({ hasText: new RegExp(`^${pageNumber}$`) });
  }

  /**
   * True when the pagination nav is rendered at all — `IblPagination`
   * renders nothing when `totalPages <= 1`, so this doubles as "there is more
   * than one page of datasets". Callers that need deterministic pagination
   * should `test.skip` when this is false rather than asserting on a
   * potentially-empty/single-page tenant.
   */
  async hasPagination(): Promise<boolean> {
    // Let the initial datasets fetch settle before checking — the nav only
    // mounts once `totalPages` is known (see AgentDatasetsTab).
    await this.page.waitForTimeout(1_500);
    let visible = false;
    try {
      await this.paginationNav.waitFor({ state: 'visible', timeout: 10_000 });
      visible = true;
    } catch {
      visible = false;
    }
    return visible;
  }

  /**
   * Reads the datasets-tab-owned URL query params (`datasetsPage` /
   * `datasetsSearch`) off the current page URL. Returns `null` for a param
   * that isn't present, matching `URLSearchParams.get`.
   */
  getUrlParams(): { page: string | null; search: string | null } {
    const url = new URL(this.page.url());
    return {
      page: url.searchParams.get(DATASETS_PAGE_PARAM),
      search: url.searchParams.get(DATASETS_SEARCH_PARAM),
    };
  }

  /**
   * Clicks a numbered pagination link and waits for the URL's `datasetsPage`
   * param to reflect it. Pagination clicks push a history entry
   * (`router.push` — see `AgentDatasetsTabWrapper.handlePageChange`), so
   * callers testing browser Back/Forward should call this multiple times to
   * build up history.
   */
  async goToPage(pageNumber: number): Promise<void> {
    const link = this.paginationPageLink(pageNumber);

    // The click can be silently dropped. `AgentDatasetsTab` renders the
    // pagination with `disabled={isDatasetsFetching || isDatasetsLoading}`, and
    // `IblPagination` returns early from `onClick` while disabled — but the
    // element stays in the DOM and Playwright still considers it actionable, so
    // the click "succeeds" and nothing happens. Any refetch opens that window,
    // and it repeats every 2s while a document is training.
    //
    // Retry until the URL reflects the page rather than asserting on a single
    // attempt. Each attempt waits out a plausible fetch, so a dropped click
    // costs a retry rather than the test.
    const attempts = 4;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await link.click();
      try {
        await expect
          .poll(() => this.getUrlParams().page, { timeout: 5_000 })
          .toBe(String(pageNumber));
        return;
      } catch {
        if (attempt === attempts) break;
        await this.page.waitForTimeout(1_000);
      }
    }

    // Out of retries — report the same way the single-attempt version did.
    await expect
      .poll(() => this.getUrlParams().page, {
        timeout: 5_000,
        message:
          `Expected datasetsPage to become "${pageNumber}" after clicking page ` +
          `${pageNumber} (${attempts} attempts)`,
      })
      .toBe(String(pageNumber));
  }

  /**
   * Fills the search input and waits for the debounced `datasetsSearch` URL
   * param to land. The tab debounces 500ms before reporting the value back to
   * the host (`useDatasetsWithPagination`'s `useDebounce`), and the host
   * writes it via `router.replace` (no history entry per keystroke) — see
   * `AgentDatasetsTabWrapper.handleSearchChange`.
   */
  async searchAndWaitForUrlSync(query: string): Promise<void> {
    await expect(this.searchInput).toBeVisible({ timeout: 10_000 });
    await this.searchInput.fill(query);
    await expect
      .poll(() => this.getUrlParams().search, {
        timeout: 5_000,
        message: `Expected datasetsSearch to become "${query}" after the debounced search sync`,
      })
      .toBe(query);
  }

  async search(query: string): Promise<void> {
    await expect(this.searchInput).toBeVisible({ timeout: 10_000 });
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async openAddResourceModal(): Promise<Locator> {
    await expect(this.addResourceButton).toBeVisible({ timeout: 10_000 });
    await this.addResourceButton.click();
    const modal = this.page.getByRole('dialog', { name: /add resources/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
  }

  /**
   * Returns the "Google Drive" button inside the Add Resources modal. The
   * button text comes from the SDK's resource-types definition
   * (`@iblai/web-containers`, id: 'google-drive') → name: 'Google Drive'.
   */
  googleDriveButton(modal: Locator): Locator {
    return modal.getByRole('button', { name: /Google Drive/i });
  }

  /**
   * Returns the "Microsoft OneDrive" button inside the Add Resources modal.
   * The button text comes from the SDK's resource-types definition
   * (`@iblai/web-containers`, id: 'onedrive') → name: 'Microsoft OneDrive'.
   */
  oneDriveButton(modal: Locator): Locator {
    return modal.getByRole('button', { name: /Microsoft OneDrive/i });
  }

  /**
   * Returns the "Dropbox" button inside the Add Resources modal. The button
   * text comes from the SDK's resource-types definition
   * (`@iblai/web-containers`, id: 'dropbox') → name: 'Dropbox'.
   */
  dropboxButton(modal: Locator): Locator {
    return modal.getByRole('button', { name: /^Dropbox$/i });
  }

  /**
   * Upload a file via the Add Resource flow.
   * Opens Add Resources modal → clicks the resource type → sets file → clicks Submit → closes dialogs.
   */
  async uploadFile(filePath: string, resourceType: string): Promise<void> {
    // Open Add Resources modal
    const addModal = await this.openAddResourceModal();

    // Click the resource type button (e.g., "PDF", "Image", "TXT")
    const typeBtn = addModal
      .locator('button')
      .filter({ hasText: new RegExp(`^${resourceType}$`, 'i') });
    await expect(typeBtn).toBeVisible({ timeout: 5_000 });
    await typeBtn.click();

    // Wait for the file upload sub-dialog
    const uploadDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: new RegExp(resourceType, 'i') })
      .last();
    await expect(uploadDialog).toBeVisible({ timeout: 10_000 });

    // Set the file
    await uploadDialog.locator('input[type="file"]').setInputFiles(filePath);
    await this.page.waitForTimeout(2_000);

    // Click Submit to trigger the actual upload
    const submitBtn = uploadDialog.getByRole('button', { name: /submit/i });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // Wait for the upload to complete (toast: "Document has been queued for
    // training"). Bounded + non-fatal: the app's long-lived connections /
    // analytics heartbeat mean the network may never idle, so cap
    // networkidle so it can't hang until the default timeout.
    await this.page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
    await this.page.waitForTimeout(3_000);

    // Close the upload dialog, then the Add Resources modal
    const uploadClose = uploadDialog.getByRole('button', { name: 'Close' });
    let isUploadOpen = false;
    try {
      await uploadClose.waitFor({ state: 'visible', timeout: 3_000 });
      isUploadOpen = true;
    } catch {
      isUploadOpen = false;
    }
    if (isUploadOpen) {
      await uploadClose.click();
      await this.page.waitForTimeout(1_000);
    }

    const addResourcesModal = this.page.getByRole('dialog', {
      name: /Add Resources/i,
    });
    let isAddResourcesOpen = false;
    try {
      await addResourcesModal.waitFor({ state: 'visible', timeout: 3_000 });
      isAddResourcesOpen = true;
    } catch {
      isAddResourcesOpen = false;
    }
    if (isAddResourcesOpen) {
      await addResourcesModal.getByRole('button', { name: 'Close' }).click();
      await this.page.waitForTimeout(1_000);
    }
  }

  /**
   * The Add Resources modal button for `resourceId` (e.g. `'zip'` → the
   * "ZIP" button). Shared by the gating checks (journeys 20/74/75) and by
   * every resource-creation helper below so the button-matching regex lives
   * in exactly one place.
   */
  resourceButton(modal: Locator, resourceId: DatasetResourceId): Locator {
    const label = RESOURCE_LABEL_BY_ID[resourceId];
    return modal
      .locator('button')
      .filter({ hasText: new RegExp(`^${label}$`, 'i') });
  }

  /**
   * Clicks the `resourceId` button in an already-open Add Resources modal and
   * returns the resulting resource dialog (DialogTitle === the resource's
   * label, e.g. "PDF" / "Web Crawler").
   */
  async openResourceDialog(
    modal: Locator,
    resourceId: DatasetResourceId,
  ): Promise<Locator> {
    const label = RESOURCE_LABEL_BY_ID[resourceId];
    const typeBtn = this.resourceButton(modal, resourceId);
    await expect(typeBtn).toBeVisible({ timeout: 5_000 });
    await expect(typeBtn).toBeEnabled({ timeout: 5_000 });
    await typeBtn.click();
    const dialog = this.page.getByRole('dialog', { name: label }).last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  /**
   * Closes a resource dialog and the Add Resources modal behind it. Mirrors
   * `uploadFile()`'s tail — shared here so the newer URL/GitHub/Web Crawler
   * helpers below don't duplicate it.
   */
  async closeResourceDialogAndModal(dialog: Locator): Promise<void> {
    await this.page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
    await this.page.waitForTimeout(2_000);

    let isDialogOpen = false;
    try {
      await dialog.waitFor({ state: 'visible', timeout: 3_000 });
      isDialogOpen = true;
    } catch {
      isDialogOpen = false;
    }
    if (isDialogOpen) {
      await dialog.getByRole('button', { name: 'Close' }).click();
      await this.page.waitForTimeout(1_000);
    }

    const addResourcesModal = this.page.getByRole('dialog', {
      name: /Add Resources/i,
    });
    let isAddResourcesOpen = false;
    try {
      await addResourcesModal.waitFor({ state: 'visible', timeout: 3_000 });
      isAddResourcesOpen = true;
    } catch {
      isAddResourcesOpen = false;
    }
    if (isAddResourcesOpen) {
      await addResourcesModal.getByRole('button', { name: 'Close' }).click();
      await this.page.waitForTimeout(1_000);
    }
  }

  /**
   * Submits the URL or YouTube resource dialog (identical `UrlUploadModal`
   * form under both labels — a single `#resource-url` input).
   */
  async submitUrlLikeResource(
    resourceId: 'url' | 'youtube',
    url: string,
  ): Promise<void> {
    const modal = await this.openAddResourceModal();
    const dialog = await this.openResourceDialog(modal, resourceId);
    await dialog.getByPlaceholder('URL').fill(url);
    const submit = dialog.getByRole('button', { name: /submit/i });
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await submit.click();
    await this.closeResourceDialogAndModal(dialog);
  }

  /**
   * Submits the GitHub resource dialog: fills the repo URL, waits for the
   * branch combobox to populate (a debounced backend lookup), picks the
   * first branch, then submits.
   */
  async submitGithubResource(repoUrl: string): Promise<void> {
    const modal = await this.openAddResourceModal();
    const dialog = await this.openResourceDialog(modal, 'github');
    await dialog.getByPlaceholder('Github Repo URL').fill(repoUrl);

    const branchCombobox = dialog.getByRole('combobox');
    await expect(branchCombobox).toBeEnabled({ timeout: 20_000 });
    await branchCombobox.click();
    const firstBranchOption = this.page.getByRole('option').first();
    await expect(firstBranchOption).toBeVisible({ timeout: 10_000 });
    await firstBranchOption.click();

    const submit = dialog.getByRole('button', { name: /submit/i });
    await expect(submit).toBeEnabled({ timeout: 5_000 });
    await submit.click();
    await this.closeResourceDialogAndModal(dialog);
  }

  /**
   * Opens the Web Crawler resource dialog and fills its form WITHOUT
   * submitting — callers that need to assert on the create request (e.g. the
   * `crawler_extra_headers` User-Agent contract) must arm
   * `page.waitForRequest(...)` before clicking Submit themselves.
   */
  async openAndFillWebCrawlerResource(opts: {
    url: string;
    maxDepth?: number;
    maxPages?: number;
    userAgent?: string;
  }): Promise<Locator> {
    const modal = await this.openAddResourceModal();
    const dialog = await this.openResourceDialog(modal, 'web-crawler');
    await dialog.locator('#url').fill(opts.url);
    if (opts.maxDepth !== undefined) {
      await dialog.locator('#crawler_max_depth').fill(String(opts.maxDepth));
    }
    if (opts.maxPages !== undefined) {
      await dialog
        .locator('#crawler_max_pages_limit')
        .fill(String(opts.maxPages));
    }
    if (opts.userAgent !== undefined) {
      await dialog.locator('#crawler_user_agent').fill(opts.userAgent);
    }
    return dialog;
  }

  /** The Submit button inside an open resource dialog. */
  submitButtonIn(dialog: Locator): Locator {
    return dialog.getByRole('button', { name: /submit/i });
  }

  /**
   * The dataset row (table `<tr>`) whose name/link text matches `name` —
   * scoping every row-level action (train switch, schedule retrain,
   * visibility) to one deterministically-seeded dataset instead of guessing
   * "the first untrained switch" among whatever else the tenant holds.
   */
  datasetRowByName(name: string | RegExp): Locator {
    return this.dialog.getByRole('row').filter({ hasText: name });
  }

  /** The training switch inside a specific row (see `datasetRowByName`). */
  trainingSwitchInRow(row: Locator): Locator {
    return row.getByRole('switch', { name: /training for document/i });
  }

  /** The Schedule Retrain (clock icon) button inside a specific row. */
  scheduleRetrainButtonInRow(row: Locator): Locator {
    return row
      .getByRole('button')
      .filter({ has: this.page.locator('svg.lucide-clock') });
  }

  /** The visibility (eye/eye-off icon) toggle inside a specific row. */
  visibilityToggleInRow(row: Locator): Locator {
    return row
      .getByRole('button')
      .filter({ has: this.page.locator('svg.lucide-eye, svg.lucide-eye-off') });
  }

  /**
   * Clicks a row's training switch and returns whichever modal it opens:
   * `TrainOrDeleteModal` ("What would you like to do?") for an untrained row,
   * or `DeleteDatasetModal` ("Delete Dataset") for a trained row (untraining
   * a trained row is immediate — no choice — and auto-opens the delete
   * confirmation).
   */
  async clickTrainingSwitchInRow(row: Locator): Promise<Locator> {
    await this.trainingSwitchInRow(row).click();
    const modal = this.page
      .getByRole('dialog')
      .filter({ hasText: /What would you like to do\?|Delete Dataset/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
  }

  async hasDatasets(): Promise<boolean> {
    await this.page.waitForTimeout(2_000);
    // Check class-based rows first
    const hasClassRows = await this.datasetRows
      .first()
      .isVisible()
      .catch(() => false);
    if (hasClassRows) return true;
    // Fall back to checking if the "No datasets found" empty state is absent
    let isEmpty = false;
    try {
      await this.emptyState.waitFor({ state: 'visible', timeout: 3_000 });
      isEmpty = true;
    } catch {
      isEmpty = false;
    }
    return !isEmpty;
  }
}
