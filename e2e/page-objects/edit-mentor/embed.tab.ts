import { Page, Locator, expect } from "@playwright/test";

export class EmbedTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly embedCodeBlock: Locator;
  readonly copyButton: Locator;
  readonly voiceCallToggle: Locator;
  readonly voiceRecordToggle: Locator;
  readonly attachmentToggle: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.embedCodeBlock = dialog.locator("pre").first();
    this.copyButton = dialog.getByRole("button", { name: /copy/i }).first();
    this.voiceCallToggle = dialog.getByRole("switch", { name: /voice call/i });
    this.voiceRecordToggle = dialog.getByRole("switch", {
      name: /voice record|voice input/i,
    });
    this.attachmentToggle = dialog.getByRole("switch", {
      name: /attachment|attach/i,
    });
  }

  async getEmbedCode(): Promise<string> {
    await expect(this.embedCodeBlock).toBeVisible({ timeout: 10_000 });
    return (await this.embedCodeBlock.textContent()) ?? "";
  }

  async copyEmbedCode(): Promise<void> {
    await expect(this.copyButton).toBeVisible({ timeout: 5_000 });
    await this.copyButton.click();
  }
}
