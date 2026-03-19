import { Page, Locator, expect } from '@playwright/test';

export class ToolsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly toolToggles: Locator;
  readonly saveButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.toolToggles = dialog.getByRole('switch');
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();
  }

  async toggleTool(toolName: string): Promise<void> {
    const toggle = this.dialog.getByRole('switch', {
      name: new RegExp(toolName, 'i'),
    });
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
  }

  async getToolCount(): Promise<number> {
    return this.toolToggles.count();
  }
}
