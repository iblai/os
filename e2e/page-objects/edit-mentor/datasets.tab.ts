import { Page, Locator, expect } from '@playwright/test';

export class DatasetsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly searchInput: Locator;
  readonly addResourceButton: Locator;
  readonly datasetRows: Locator;
  readonly emptyState: Locator;
  readonly paginationNext: Locator;
  readonly visibilityToggle: Locator;
  readonly trainingSwitch: Locator;
  readonly scheduleRetrainButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.searchInput = dialog.getByPlaceholder(/search datasets/i);
    this.addResourceButton = dialog.getByRole('button', { name: /add resource/i });
    this.datasetRows = dialog.locator('[class*="dataset-row"], [data-testid*="dataset-row"]');
    this.emptyState = dialog.getByText(/no datasets/i);
    this.paginationNext = dialog.getByRole('button', { name: /next/i });
    this.visibilityToggle = dialog.getByRole('switch', { name: /visibility/i }).first();
    this.trainingSwitch = dialog.getByRole('switch', { name: /train/i }).first();
    this.scheduleRetrainButton = dialog.getByRole('button', { name: /schedule retrain/i }).first();
    this.deleteButton = dialog.getByRole('button', { name: /delete/i }).first();
  }

  async search(query: string): Promise<void> {
    await expect(this.searchInput).toBeVisible({ timeout: 10_000 });
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async openAddResourceModal(): Promise<Locator> {
    await expect(this.addResourceButton).toBeVisible({ timeout: 10_000 });
    await this.addResourceButton.click();
    const modal = this.page.getByRole('dialog').filter({ hasText: /add resource/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    return modal;
  }

  async hasDatasets(): Promise<boolean> {
    return this.datasetRows.first().isVisible({ timeout: 5_000 }).catch(() => false);
  }
}
