import { Page, Locator, expect } from "@playwright/test";

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
    this.addResourceButton = dialog.getByRole("button", {
      name: /add resource/i,
    });
    this.datasetRows = dialog.locator(
      '[class*="dataset-row"], [data-testid*="dataset-row"]',
    );
    this.emptyState = dialog.getByText(/no datasets/i);
    this.paginationNext = dialog.getByRole("button", { name: /next/i });
    // H22 fix: training switch uses "training for document" name pattern
    this.trainingSwitch = dialog
      .getByRole("switch", { name: /training for document/i })
      .first();
    this.deleteButton = dialog.getByRole("button", { name: /delete/i }).first();
  }

  // H22 fix: visibility toggle is an eye-icon button, not a switch
  get visibilityToggle(): Locator {
    return this.dialog
      .getByRole("button")
      .filter({ has: this.page.locator("svg.lucide-eye, svg.lucide-eye-off") })
      .first();
  }

  // H23 fix: schedule retrain button is identified by clock icon, not name
  get scheduleRetrainButton(): Locator {
    return this.dialog
      .getByRole("button")
      .filter({ has: this.page.locator("svg.lucide-clock") })
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
      .getByRole("dialog")
      .filter({ hasText: /add resource/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
  }

  async hasDatasets(): Promise<boolean> {
    // Wait briefly for content to load before checking
    await this.page.waitForTimeout(2_000);
    const hasRows = await this.datasetRows
      .first()
      .isVisible()
      .catch(() => false);
    return hasRows;
  }
}
