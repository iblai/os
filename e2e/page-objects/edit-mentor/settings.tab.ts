import { Page, Locator, expect } from "@playwright/test";

export class SettingsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly uniqueIdField: Locator;
  readonly copyButton: Locator;
  readonly visibilityCombobox: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;
  readonly advancedCssSection: Locator;
  readonly advancedCssEditor: Locator;
  readonly advancedCssSaveButton: Locator;
  readonly advancedCssDiscardButton: Locator;
  readonly advancedJsEditor: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.uniqueIdField = dialog
      .locator("input[readonly], input[disabled]")
      .filter({
        hasText: /.{8}-.{4}-.{4}-.{4}-.{12}/,
      })
      .or(dialog.locator('[data-testid="unique-id-field"]'))
      .or(dialog.getByLabel(/unique id/i));
    this.copyButton = dialog.getByRole("button", { name: /copy/i }).first();
    this.visibilityCombobox = dialog.getByRole("combobox", {
      name: "Select Who Can View",
      exact: true,
    });
    this.saveButton = dialog.getByRole("button", { name: /save/i }).first();
    this.deleteButton = dialog.getByRole("button", { name: /delete/i }).first();
    this.advancedCssSection = dialog
      .getByText(/advanced css/i)
      .locator("..")
      .locator("..");
    this.advancedCssEditor = dialog
      .locator('[data-testid="advanced-css-editor"], .cm-editor')
      .first();
    this.advancedCssSaveButton = dialog
      .getByRole("button", { name: /save.*css|save.*advanced/i })
      .first();
    this.advancedCssDiscardButton = dialog
      .getByRole("button", { name: /discard/i })
      .first();
    this.advancedJsEditor = dialog
      .locator('[data-testid="advanced-js-editor"]')
      .or(dialog.locator(".cm-editor").nth(1));
  }

  async copyUniqueId(): Promise<void> {
    await expect(this.copyButton).toBeVisible({ timeout: 10_000 });
    await this.copyButton.click();
  }

  async setVisibility(label: string): Promise<void> {
    await expect(this.visibilityCombobox).toBeVisible({ timeout: 5_000 });
    await this.visibilityCombobox.click();
    // Use the Radix UI option (div[role="option"]) rather than native <option>
    const opt = this.page.locator('div[role="option"]').filter({
      hasText: new RegExp(`^${label}$`, "i"),
    });
    const radixVisible = await opt
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (radixVisible) {
      await opt.first().click();
    } else {
      // Fallback: try any role="option" with matching text
      const fallback = this.page.getByRole("option", {
        name: new RegExp(label, "i"),
      });
      await expect(fallback.first()).toBeVisible({ timeout: 5_000 });
      await fallback.first().click();
    }
  }

  async setVisibilityAnyone(): Promise<void> {
    await this.setVisibility("Anyone");
  }

  async deleteMentor(): Promise<void> {
    await expect(this.deleteButton).toBeVisible({ timeout: 10_000 });
    await this.deleteButton.click();
    const confirmButton = this.page
      .getByRole("dialog")
      .filter({ hasText: /delete/i })
      .getByRole("button", { name: /delete|confirm/i })
      .last();
    await expect(confirmButton).toBeVisible({ timeout: 5_000 });
    await confirmButton.click();
  }
}
