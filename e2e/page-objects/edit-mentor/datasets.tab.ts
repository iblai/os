import { Page, Locator, expect } from '@playwright/test';

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

  async search(query: string): Promise<void> {
    await expect(this.searchInput).toBeVisible({ timeout: 10_000 });
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async openAddResourceModal(): Promise<Locator> {
    await expect(this.addResourceButton).toBeVisible({ timeout: 10_000 });
    await this.addResourceButton.click();
    const modal = this.page
      .getByRole('dialog')
      .filter({ hasText: /add resource/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
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
