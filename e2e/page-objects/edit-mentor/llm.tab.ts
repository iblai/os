import { Page, Locator, expect } from '@playwright/test';

/** One provider grid card as rendered by `tabs/llm-tab.tsx`. */
export interface LlmProviderCardInfo {
  /** Raw API provider key from `data-provider` (e.g. "iblai", "bedrock"). */
  provider: string;
  /** Whether the card renders in its grayed/inactive state (`data-disabled`). */
  disabled: boolean;
  /** Visible label text (the display name, e.g. "ibl.ai", "Amazon"). */
  label: string;
}

export class LlmTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly providerTabpanel: Locator;
  readonly searchProvidersInput: Locator;
  /** Every provider grid card (`data-testid="llm-provider-card"`), in DOM order. */
  readonly providerCards: Locator;
  /** The "LLM Selection" model-picker dialog (a separate portal) opened when a
   * provider card is clicked. */
  readonly llmSelectionDialog: Locator;
  /** The model-picker's own search box (placeholder "Search"), scoped to the dialog. */
  readonly modelSearchInput: Locator;
  /**
   * Cloud/local model rows inside the picker — buttons that render a provider
   * logo `<img>`, which excludes the dialog's own Close (X icon) button.
   */
  readonly modelRows: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.providerTabpanel = dialog
      .getByRole('tabpanel', { name: /llm/i, exact: true })
      .first();
    this.searchProvidersInput = dialog.getByPlaceholder(/search providers/i);
    this.providerCards = dialog.locator('[data-testid="llm-provider-card"]');
    this.llmSelectionDialog = page.getByRole('dialog', {
      name: /llm selection/i,
    });
    this.modelSearchInput = this.llmSelectionDialog.getByPlaceholder('Search');
    this.modelRows = this.llmSelectionDialog
      .getByRole('button')
      .filter({ has: page.locator('img') });
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
   * Returns the provider grid card by its raw API key (`data-provider`, e.g.
   * "iblai", "bedrock", "azure_openai") rather than its display label. More
   * robust than {@link providerCard} for asserting on a specific provider's
   * disabled/graying state, since the raw key is stable while the label is a
   * translated/derived display name.
   */
  providerCardByKey(providerKey: string): Locator {
    return this.dialog.locator(
      `[data-testid="llm-provider-card"][data-provider="${providerKey}"]`,
    );
  }

  /**
   * Snapshots every provider card in DOM (render) order — the data needed to
   * assert the two-group ordering invariant (usable providers first, both
   * groups alphabetical by display label) without depending on which
   * providers happen to have credentials in a given environment.
   */
  async getProviderCardsInfo(): Promise<LlmProviderCardInfo[]> {
    const count = await this.providerCards.count();
    const infos: LlmProviderCardInfo[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.providerCards.nth(i);
      const provider = (await card.getAttribute('data-provider')) ?? '';
      const disabled = (await card.getAttribute('data-disabled')) === 'true';
      const label = (
        (await card.locator('span').first().textContent()) ?? ''
      ).trim();
      infos.push({ provider, disabled, label });
    }
    return infos;
  }

  /**
   * Select a provider and a chat model for the mentor.
   *
   * @param providerName Provider display name as shown on the LLM tab card,
   *   e.g. "OpenAI".
   * @param modelKey The model's wire key (`llm_name`), e.g. "gpt-5" — NOT the
   *   label on screen. Rows render the API's `display_name` ("GPT-5"), which is
   *   display data and free to change, so selection goes through the row's
   *   `data-model` attribute instead.
   *
   * Selecting a model saves immediately (a "LLM updated successfully" toast is
   * shown). The LLM Selection dialog stays open after the save, so this method
   * dismisses it before returning so the parent Edit Agent dialog is usable.
   */
  async selectProviderAndModel(
    providerName: string,
    modelKey: string,
  ): Promise<void> {
    const card = this.providerCard(providerName);
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    await expect(this.llmSelectionDialog).toBeVisible({ timeout: 10_000 });

    // Attribute match on the wire key. This is also exact, which still matters:
    // model keys are prefixes of one another ("gpt-5" vs "gpt-5.1",
    // "gpt-5-mini"), so a substring match would resolve to several rows.
    const modelButton = this.llmSelectionDialog.locator(
      `[data-model="${modelKey}"]`,
    );
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
