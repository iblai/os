import { Page, Locator, expect } from '@playwright/test';

export class MemoryTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly referenceToggle: Locator;
  readonly addMemoryButton: Locator;
  readonly emptyState: Locator;
  readonly deleteButtons: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.referenceToggle = dialog
      .getByText('Reference saved memories')
      .locator('..')
      .locator('..')
      .getByRole('switch');
    this.addMemoryButton = dialog.getByRole('button', { name: /add memory/i });
    this.emptyState = dialog.getByText('No saved memories yet.');
    this.deleteButtons = dialog.getByRole('button', { name: /delete/i });
  }

  async isReferenceEnabled(): Promise<boolean> {
    return (
      (await this.referenceToggle
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true'
    );
  }

  async toggleReference(): Promise<void> {
    await expect(this.referenceToggle).toBeVisible({ timeout: 10_000 });
    await this.referenceToggle.click();
    await expect(
      this.page.getByText('Reference saved memories updated'),
    ).toBeVisible({ timeout: 10_000 });
  }

  async hasMemories(): Promise<boolean> {
    const empty = await this.emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    return !empty;
  }

  async deleteFirst(): Promise<void> {
    const btn = this.deleteButtons.first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    const confirmDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /delete|confirm/i })
      .last();
    const confirmVisible = await confirmDialog
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (confirmVisible) {
      await confirmDialog
        .getByRole('button', { name: /delete|confirm/i })
        .last()
        .click();
    }
  }
}
