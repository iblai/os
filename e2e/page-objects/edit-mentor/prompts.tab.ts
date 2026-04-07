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
    const textarea = this.page
      .getByRole('dialog', { name: 'Edit System Prompt', exact: true })
      .getByRole('textbox')
      .first()
      .locator('div');
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.clear();
    await textarea.fill(content);
    const saveButton = this.page
      .getByRole('dialog', { name: 'Edit System Prompt', exact: true })
      .getByRole('button', { name: 'Save', exact: true })
      .first();

    await expect(saveButton).toBeVisible({ timeout: 10_000 });
    await saveButton.click();
    await this.page.waitForTimeout(5000);

    const closeButton = this.page
      .getByRole('dialog', { name: 'Edit System Prompt', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .first();

    await expect(closeButton).toBeVisible({ timeout: 10_000 });
    await closeButton.click();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
  }
}
