import { Page, Locator, expect } from '@playwright/test';

export class LlmTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly providerTabpanel: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.providerTabpanel = dialog
      .getByRole('tabpanel', { name: /llm/i, exact: true })
      .first();
  }

  /**
   * Click a provider card by name (e.g. "OpenAI", "Anthropic").
   * Opens the LLM Selection dialog.
   */
  async openProvider(providerName: string): Promise<Locator> {
    const providerText = this.dialog.getByText(providerName, { exact: true });
    await expect(providerText).toBeVisible({ timeout: 15_000 });
    await providerText.click();

    const llmSelectionDialog = this.page.getByRole('dialog', {
      name: /llm selection/i,
    });
    await expect(llmSelectionDialog).toBeVisible({ timeout: 10_000 });
    return llmSelectionDialog;
  }

  /**
   * Select a model from the LLM Selection dialog by its exact accessible name.
   * If the model is already selected (disabled), skips the click.
   * Closes the LLM Selection dialog afterwards.
   */
  async selectModel(
    llmSelectionDialog: Locator,
    modelButtonName: string,
  ): Promise<void> {
    const modelButton = llmSelectionDialog.getByRole('button', {
      name: modelButtonName,
      exact: true,
    });
    await expect(modelButton).toBeVisible({ timeout: 10_000 });

    const isDisabled = await modelButton.isDisabled();
    if (!isDisabled) {
      await modelButton.click();
    }

    await llmSelectionDialog.getByRole('button', { name: 'Close' }).click();

    // Wait for success toast (may be brief)
    try {
      const successToast = this.page
        .locator('[data-sonner-toast]')
        .filter({ hasText: /success|saved|updated/i });
      await successToast.waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      // Toast may be very brief; continue
    }
  }

  /**
   * Convenience: open a provider and select a model in one call.
   * Example: `await llm.selectProviderAndModel('OpenAI', 'OpenAI icon gpt-5')`
   */
  async selectProviderAndModel(
    providerName: string,
    modelButtonName: string,
  ): Promise<void> {
    const llmSelectionDialog = await this.openProvider(providerName);
    await this.selectModel(llmSelectionDialog, modelButtonName);
  }
}
