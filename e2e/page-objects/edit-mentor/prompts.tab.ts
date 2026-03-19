import { Page, Locator, expect } from '@playwright/test';

export class PromptsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly systemPromptTextarea: Locator;
  readonly saveButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.systemPromptTextarea = dialog
      .getByRole('textbox')
      .or(dialog.locator('textarea'))
      .first();
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();
  }

  async setSystemPrompt(content: string): Promise<void> {
    await expect(this.systemPromptTextarea).toBeVisible({ timeout: 10_000 });
    await this.systemPromptTextarea.clear();
    await this.systemPromptTextarea.fill(content);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
  }
}
