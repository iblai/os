import { Page, Locator, expect } from '@playwright/test';

export class ToolsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly toolToggles: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.toolToggles = dialog.getByRole('switch');
  }

  private getToolToggle(toolName: string): Locator {
    return this.dialog.getByRole('switch', {
      name: new RegExp(toolName, 'i'),
    });
  }

  async toggleTool(toolName: string): Promise<void> {
    const toggle = this.getToolToggle(toolName);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
  }

  /**
   * Enable a tool if it is not already enabled. Tools tab auto-saves on toggle.
   */
  async enableTool(toolName: string): Promise<void> {
    const toggle = this.getToolToggle(toolName);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    const isChecked = (await toggle.getAttribute('aria-checked')) === 'true';
    if (!isChecked) {
      await toggle.click();
      await this.page.waitForTimeout(2_000);
    }
  }

  /**
   * Disable a tool if it is currently enabled. Tools tab auto-saves on toggle.
   */
  async disableTool(toolName: string): Promise<void> {
    const toggle = this.getToolToggle(toolName);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    const isChecked = (await toggle.getAttribute('aria-checked')) === 'true';
    if (isChecked) {
      await toggle.click();
      await this.page.waitForTimeout(2_000);
    }
  }

  async isToolEnabled(toolName: string): Promise<boolean> {
    const toggle = this.getToolToggle(toolName);
    return (await toggle.getAttribute('aria-checked')) === 'true';
  }

  async getToolCount(): Promise<number> {
    return this.toolToggles.count();
  }
}
