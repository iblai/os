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

  /**
   * Enable a tool by name if not already enabled.
   * Idempotent — does nothing if the tool is already on.
   */
  async enableTool(toolName: string): Promise<void> {
    const toggle = this.dialog.getByRole('switch', {
      name: new RegExp(toolName, 'i'),
    });
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    const isChecked = await toggle.getAttribute('aria-checked');
    if (isChecked !== 'true') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'true', {
        timeout: 10_000,
      });
    }
  }

  /**
   * Disable a tool by name if not already disabled.
   * Idempotent — does nothing if the tool is already off.
   */
  async disableTool(toolName: string): Promise<void> {
    const toggle = this.dialog.getByRole('switch', {
      name: new RegExp(toolName, 'i'),
    });
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    const isChecked = await toggle.getAttribute('aria-checked');
    if (isChecked === 'true') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'false', {
        timeout: 10_000,
      });
    }
  }

  async isToolEnabled(toolName: string): Promise<boolean> {
    const toggle = this.dialog.getByRole('switch', {
      name: new RegExp(toolName, 'i'),
    });
    const checked = await toggle.getAttribute('aria-checked');
    return checked === 'true';
  }

  async getToolCount(): Promise<number> {
    return this.toolToggles.count();
  }
}
