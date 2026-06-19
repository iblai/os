import { Page, Locator, expect } from '@playwright/test';

export class LlmTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly providerTabpanel: Locator;
  readonly searchProvidersInput: Locator;
  /** The "LLM Selection" model-picker dialog (a separate portal) opened when a
   * provider card is clicked. */
  readonly llmSelectionDialog: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.providerTabpanel = dialog
      .getByRole('tabpanel', { name: /llm/i, exact: true })
      .first();
    this.searchProvidersInput = dialog.getByPlaceholder(/search providers/i);
    this.llmSelectionDialog = page.getByRole('dialog', {
      name: /llm selection/i,
    });
  }

  /**
   * Returns the clickable provider card for a given provider (e.g. "OpenAI").
   * Each card renders the provider logo (alt "<Provider> logo") and the
   * provider name; clicking it opens the LLM Selection model picker.
   */
  providerCard(providerName: string): Locator {
    return this.dialog.getByRole('img', { name: `${providerName} logo` });
  }

  /**
   * Select a provider and a chat model for the mentor.
   *
   * @param providerName Provider display name as shown on the LLM tab card,
   *   e.g. "OpenAI".
   * @param modelName The model button's accessible name inside the LLM
   *   Selection dialog — the provider icon alt ("<Provider> icon") concatenated
   *   with the model name, e.g. "OpenAI icon gpt-5".
   *
   * Selecting a model saves immediately (a "LLM updated successfully" toast is
   * shown). The LLM Selection dialog stays open after the save, so this method
   * dismisses it before returning so the parent Edit Agent dialog is usable.
   */
  async selectProviderAndModel(
    providerName: string,
    modelName: string,
  ): Promise<void> {
    const card = this.providerCard(providerName);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    await expect(this.llmSelectionDialog).toBeVisible({ timeout: 10_000 });

    // Exact match: model names are prefixes of one another (e.g. "gpt-5" vs
    // "gpt-5.1", "gpt-5-mini"), so a substring match resolves to many buttons.
    const modelButton = this.llmSelectionDialog.getByRole('button', {
      name: modelName,
      exact: true,
    });
    await expect(modelButton).toBeVisible({ timeout: 10_000 });
    await modelButton.click();

    // The selection is persisted via the edit-mentor mutation and confirmed
    // with a success toast.
    await expect(
      this.page.getByText(/LLM updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Close the model picker (it does not auto-close) so the parent dialog is
    // interactable again.
    await this.page.keyboard.press('Escape');
    await expect(this.llmSelectionDialog).not.toBeVisible({ timeout: 10_000 });
    // Small buffer for RTK Query cache invalidation.
    await this.page.waitForTimeout(500);
  }
}
