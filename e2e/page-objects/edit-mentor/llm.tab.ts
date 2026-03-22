import { Page, Locator, expect } from "@playwright/test";

export class LlmTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly providerTabpanel: Locator;
  readonly modelCombobox: Locator;
  readonly saveButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.providerTabpanel = dialog
      .getByRole("tabpanel", { name: /llm/i, exact: true })
      .first();
    this.modelCombobox = dialog
      .getByRole("combobox", { name: /model/i })
      .first();
    this.saveButton = dialog.getByRole("button", { name: /save/i }).first();
  }

  async setProvider(providerName: string): Promise<void> {
    await expect(this.providerCombobox).toBeVisible({ timeout: 10_000 });
    await this.providerCombobox.click();
    const opt = this.page.getByRole("option", {
      name: new RegExp(providerName, "i"),
    });
    await expect(opt).toBeVisible({ timeout: 5_000 });
    await opt.click();
  }

  async setModel(modelName: string): Promise<void> {
    await expect(this.modelCombobox).toBeVisible({ timeout: 10_000 });
    await this.modelCombobox.click();
    const opt = this.page.getByRole("option", {
      name: new RegExp(modelName, "i"),
    });
    await expect(opt).toBeVisible({ timeout: 5_000 });
    await opt.click();
  }
}
