import { Page, Locator, expect } from '@playwright/test';

export class EmbedTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly embedCodeBlock: Locator;
  readonly copyButton: Locator;
  readonly voiceCallToggle: Locator;
  readonly voiceRecordToggle: Locator;
  readonly attachmentToggle: Locator;
  readonly showCatalogueToggle: Locator;
  readonly submitButton: Locator;
  readonly embedCodeDialog: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.embedCodeBlock = dialog.locator('pre').first();
    // A successful submit opens a portal-rendered dialog with the generated
    // snippet. It is a modal, so it renders the Edit Agent dialog inert.
    this.embedCodeDialog = page.getByRole('dialog', { name: /embedded code/i });
    // The footer submit button reads "Create Embed" (or "Generating Embed"
    // while the form is submitting). Clicking it triggers form.handleSubmit().
    this.submitButton = dialog.getByRole('button', {
      name: /create embed|generating embed/i,
    });
    this.copyButton = dialog.getByRole('button', { name: /copy/i }).first();
    this.voiceCallToggle = dialog.getByRole('switch', { name: /voice call/i });
    this.voiceRecordToggle = dialog.getByRole('switch', {
      name: /voice record|voice input/i,
    });
    this.attachmentToggle = dialog.getByRole('switch', {
      name: /attachment|attach/i,
    });
    this.showCatalogueToggle = dialog.getByRole('switch', {
      name: /show catalogue/i,
    });
  }

  async getEmbedCode(): Promise<string> {
    await expect(this.embedCodeBlock).toBeVisible({ timeout: 10_000 });
    return (await this.embedCodeBlock.textContent()) ?? '';
  }

  async copyEmbedCode(): Promise<void> {
    await expect(this.copyButton).toBeVisible({ timeout: 5_000 });
    await this.copyButton.click();
  }

  /** Returns true when the Show Catalogue switch is in the checked/enabled state. */
  async getShowCatalogueState(): Promise<boolean> {
    await expect(this.showCatalogueToggle).toBeVisible({ timeout: 10_000 });
    return (
      (await this.showCatalogueToggle.getAttribute('aria-checked')) === 'true'
    );
  }

  /** Clicks the Show Catalogue switch to toggle its state. */
  async toggleShowCatalogue(): Promise<void> {
    await expect(this.showCatalogueToggle).toBeVisible({ timeout: 10_000 });
    await this.showCatalogueToggle.click();
  }

  /** Ensures the Show Catalogue switch matches `enabled`, toggling if needed. */
  async setShowCatalogue(enabled: boolean): Promise<void> {
    if ((await this.getShowCatalogueState()) !== enabled) {
      await this.toggleShowCatalogue();
      await expect(this.showCatalogueToggle).toHaveAttribute(
        'aria-checked',
        enabled ? 'true' : 'false',
        { timeout: 5_000 },
      );
    }
  }

  /**
   * Clicks the "Create Embed" footer button to submit/persist the form, then
   * dismisses the resulting "Embedded Code" dialog so the parent editor is no
   * longer inert and can be closed/reopened.
   */
  async submit(): Promise<void> {
    await expect(this.submitButton).toBeVisible({ timeout: 10_000 });
    await this.submitButton.click();
    await this.dismissEmbedCodeDialog();
  }

  /** Closes the generated "Embedded Code" dialog if it is showing. */
  async dismissEmbedCodeDialog(): Promise<void> {
    try {
      await this.embedCodeDialog.waitFor({ state: 'visible', timeout: 8_000 });
    } catch {
      // No dialog appeared (e.g. the submit was rejected by validation).
      return;
    }
    await this.embedCodeDialog
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await expect(this.embedCodeDialog).toBeHidden({ timeout: 5_000 });
  }
}
