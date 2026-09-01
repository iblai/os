import { Page, Locator, expect } from '@playwright/test';

// URL query keys the SDK Datasets tab owns, synced by the OS host wrapper
// (components/modals/edit-mentor-modal/tabs/datasets-tab/agent-datasets-tab.tsx)
// from lib/constants.ts's `DATASETS_TAB_URL_PARAMS`. Page objects don't import
// app source, so these are duplicated here as literals — keep in sync if the
// constant is ever renamed.
export const DATASETS_PAGE_PARAM = 'datasetsPage';
export const DATASETS_SEARCH_PARAM = 'datasetsSearch';

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
   * Returns the "Google Drive" button inside the Add Resources modal.
   * The button text comes from resource-types.tsx → name: 'Google Drive'.
   */
  googleDriveButton(modal: Locator): Locator {
    return modal.getByRole('button', { name: /Google Drive/i });
  }

  /**
   * Returns the "Microsoft OneDrive" button inside the Add Resources modal.
   * The button text comes from resource-types.tsx → name: 'Microsoft OneDrive'.
   */
  oneDriveButton(modal: Locator): Locator {
    return modal.getByRole('button', { name: /Microsoft OneDrive/i });
  }

  /**
   * Returns the "Dropbox" button inside the Add Resources modal.
   * The button text comes from resource-types.tsx → name: 'Dropbox'.
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
