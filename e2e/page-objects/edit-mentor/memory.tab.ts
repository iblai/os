import { Page, Locator, expect } from '@playwright/test';

export class MemoryTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly referenceToggle: Locator;
  readonly addMemoryButton: Locator;
  readonly emptyState: Locator;
  // Each memory entry has an unnamed icon button (MoreHorizontal) as its action trigger.
  // We use these as a proxy for the memory entry count.
  readonly memoryActionButtons: Locator;

  /**
   * @deprecated Use memoryActionButtons for counting entries.
   * Kept for backward compat; resolves to same locator.
   */
  get deleteButtons(): Locator {
    return this.memoryActionButtons;
  }

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.referenceToggle = dialog
      .getByText('Reference saved memories')
      .locator('..')
      .locator('..')
      .getByRole('switch');
    this.addMemoryButton = dialog
      .locator('button')
      .filter({ hasText: /add memory/i });
    this.emptyState = dialog.getByText('No saved memories yet.');
    // The per-memory action button is an unnamed icon-only button (MoreHorizontal).
    // It lives inside each memory entry card alongside the memory content text.
    // We identify it as buttons inside the memory list that have no accessible name.
    this.memoryActionButtons = dialog
      .locator('.space-y-3 button:not([aria-label]):not([name])')
      .or(dialog.locator('button[class*="ghost"][class*="h-6"]'));
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

  /**
   * Deletes the first memory entry by clicking its action menu (MoreHorizontal)
   * and selecting "Delete" from the dropdown, then confirming if a dialog appears.
   */
  async deleteFirst(): Promise<void> {
    // Click the MoreHorizontal icon button for the first memory entry.
    const firstActionBtn = this.memoryActionButtons.first();
    await expect(firstActionBtn).toBeVisible({ timeout: 10_000 });
    await firstActionBtn.click();

    // Wait for the dropdown menu to appear and click "Delete".
    const deleteMenuItem = this.page
      .getByRole('menuitem', { name: /delete/i })
      .last();
    await expect(deleteMenuItem).toBeVisible({ timeout: 5_000 });
    await deleteMenuItem.click();

    // Handle optional confirmation dialog.
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
