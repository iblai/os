import { Page, Locator, expect } from '@playwright/test';

/** Tenant-wide "Users Models" editor opened from the LLM tab (iblai-platform#2675). */
export class UsersModelsDialog {
  readonly page: Page;
  readonly openButton: Locator;
  readonly dialog: Locator;
  readonly providerCards: Locator;
  readonly saveError: Locator;
  readonly removeRejected: Locator;
  readonly confirmEmptySave: Locator;
  readonly confirmEmptyCancel: Locator;
  readonly done: Locator;

  constructor(page: Page, editDialog: Locator) {
    this.page = page;
    this.openButton = editDialog.getByTestId('llm-users-models-button');
    this.dialog = page.getByTestId('users-models-dialog');
    this.providerCards = this.dialog.getByTestId('users-models-provider-card');
    this.saveError = page.getByTestId('users-models-save-error');
    this.removeRejected = page.getByTestId('users-models-remove-rejected');
    this.confirmEmptySave = page.getByTestId('users-models-confirm-empty-save');
    this.confirmEmptyCancel = page.getByTestId(
      'users-models-confirm-empty-cancel',
    );
    this.done = page.getByTestId('users-models-done');
  }

  async open(): Promise<void> {
    await expect(this.openButton).toBeVisible({ timeout: 30_000 });
    await this.openButton.click();
    await expect(this.dialog).toBeVisible({ timeout: 15_000 });
  }

  count(provider: string): Locator {
    return this.dialog.getByTestId(`users-models-count-${provider}`);
  }

  card(provider: string): Locator {
    return this.dialog.locator(
      `[data-testid="users-models-provider-card"][data-provider="${provider}"]`,
    );
  }

  model(provider: string, llmName: string): Locator {
    return this.page.getByTestId(`users-models-model-${provider}-${llmName}`);
  }

  allowAll(provider: string): Locator {
    return this.page.getByTestId(`users-models-allow-all-${provider}`);
  }

  async openProvider(provider: string): Promise<void> {
    await this.card(provider).click();
    await expect(this.allowAll(provider)).toBeVisible({ timeout: 15_000 });
  }

  /** `llm_name`s listed in the open provider picker, in DOM order. */
  async modelNames(provider: string): Promise<string[]> {
    return this.page
      .locator(`[data-testid^="users-models-model-${provider}-"]`)
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-model') ?? ''),
      );
  }

  /** Provider key of the first card with at least `min` models (opens it to count). */
  async firstProviderWithModels(min: number): Promise<string> {
    const keys = await this.providerCards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-provider') ?? ''),
    );
    for (const key of keys) {
      await this.openProvider(key);
      const names = await this.modelNames(key);
      await this.page.keyboard.press('Escape');
      await expect(this.allowAll(key)).not.toBeVisible();
      if (names.length >= min) return key;
    }
    throw new Error(`No provider with at least ${min} models`);
  }
}
