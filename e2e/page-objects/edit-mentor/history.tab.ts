import { Page, Locator, expect } from '@playwright/test';

export class HistoryTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly conversationRows: Locator;
  readonly emptyState: Locator;
  readonly nextButton: Locator;
  readonly exportButton: Locator;
  readonly sentimentFilter: Locator;
  readonly topicFilter: Locator;
  readonly previewPanel: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.conversationRows = dialog.locator('[class*="cursor-pointer"]');
    this.emptyState = dialog.getByText(/no conversations/i);
    this.nextButton = dialog.getByRole('button', { name: /next/i });
    this.exportButton = dialog.getByRole('button', { name: /export/i });
    this.sentimentFilter = dialog
      .getByRole('combobox', { name: /sentiment/i })
      .first();
    this.topicFilter = dialog
      .getByRole('combobox', { name: /topic/i })
      .first();
    this.previewPanel = dialog
      .locator('[class*="preview"], [class*="transcript"], [data-testid*="preview"]')
      .first();
  }

  async hasConversations(): Promise<boolean> {
    return this.conversationRows
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
  }

  async clickFirstRow(): Promise<void> {
    await expect(this.conversationRows.first()).toBeVisible({ timeout: 10_000 });
    await this.conversationRows.first().click();
  }

  async triggerExport(): Promise<import('@playwright/test').Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 30_000 }),
      this.exportButton.click(),
    ]);
    return download;
  }
}
