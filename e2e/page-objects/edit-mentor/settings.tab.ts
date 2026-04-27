import { Page, Locator, expect } from '@playwright/test';

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
  readonly allowCopiesToggle: Locator;
  readonly copyMentorButton: Locator;
  readonly showVoiceCallToggle: Locator;
  readonly chatAccessCombobox: Locator;
  readonly enhanceDocumentRetrievalToggle: Locator;
  readonly enhanceDocumentRetrievalTooltipTrigger: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.uniqueIdField = dialog
      .locator('input[readonly], input[disabled]')
      .filter({
        hasText: /.{8}-.{4}-.{4}-.{4}-.{12}/,
      })
      .or(dialog.locator('[data-testid="unique-id-field"]'))
      .or(dialog.getByLabel(/unique id/i));
    this.copyButton = dialog.getByRole('button', { name: /copy/i }).first();
    this.visibilityCombobox = dialog.getByRole('combobox', {
      name: 'Select Who Can View',
      exact: true,
    });
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();
    this.deleteButton = dialog.getByRole('button', { name: /delete/i }).first();
    this.advancedCssSection = dialog
      .getByText(/advanced css/i)
      .locator('..')
      .locator('..');
    this.advancedCssEditor = dialog
      .locator('[data-testid="advanced-css-editor"], .cm-editor')
      .first();
    this.advancedCssSaveButton = dialog
      .getByRole('button', { name: /save.*css|save.*advanced/i })
      .first();
    this.advancedCssDiscardButton = dialog
      .getByRole('button', { name: /discard/i })
      .first();
    this.advancedJsEditor = dialog
      .locator('[data-testid="advanced-js-editor"]')
      .or(dialog.locator('.cm-editor').nth(1));
    this.allowCopiesToggle = dialog.locator(
      'button[role="switch"][aria-label*="Allow copies"]',
    );
    this.copyMentorButton = dialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    this.showVoiceCallToggle = dialog.getByRole('switch', {
      name: /show voice call/i,
    });
    this.chatAccessCombobox = dialog.getByRole('combobox', {
      name: 'Select who can chat',
    });
    this.enhanceDocumentRetrievalToggle = dialog.getByRole('switch', {
      name: /enhance document retrieval/i,
    });
    this.enhanceDocumentRetrievalTooltipTrigger = dialog.getByRole('button', {
      name: 'More info about enhance document retrieval',
    });
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
      hasText: new RegExp(`^${label}$`, 'i'),
    });
    const radixVisible = await opt
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (radixVisible) {
      await opt.first().click();
    } else {
      // Fallback: try any role="option" with matching text
      const fallback = this.page.getByRole('option', {
        name: new RegExp(label, 'i'),
      });
      await expect(fallback.first()).toBeVisible({ timeout: 5_000 });
      await fallback.first().click();
    }
  }

  async setVisibilityAnyone(): Promise<void> {
    await this.setVisibility('Anyone');
  }

  async setChatAccess(label: string): Promise<void> {
    await expect(this.chatAccessCombobox).toBeVisible({ timeout: 5_000 });
    await this.chatAccessCombobox.click();
    const opt = this.page.locator('div[role="option"]').filter({
      hasText: new RegExp(`^${label}$`, 'i'),
    });
    const radixVisible = await opt
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (radixVisible) {
      await opt.first().click();
    } else {
      const fallback = this.page.getByRole('option', {
        name: new RegExp(label, 'i'),
      });
      await expect(fallback.first()).toBeVisible({ timeout: 5_000 });
      await fallback.first().click();
    }
  }

  async setChatAccessAnyone(): Promise<void> {
    await this.setChatAccess('Anyone');
  }

  async enableAllowCopies(): Promise<void> {
    await expect(this.allowCopiesToggle).toBeVisible({ timeout: 10_000 });
    const isChecked = await this.allowCopiesToggle.getAttribute('aria-checked');
    if (isChecked !== 'true') {
      await this.allowCopiesToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1_000);
  }

  async disableAllowCopies(): Promise<void> {
    await expect(this.allowCopiesToggle).toBeVisible({ timeout: 10_000 });
    const isChecked = await this.allowCopiesToggle.getAttribute('aria-checked');
    if (isChecked === 'true') {
      await this.allowCopiesToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1_000);
  }

  async enableVoiceCall(): Promise<void> {
    await expect(this.showVoiceCallToggle).toBeVisible({ timeout: 10_000 });
    const isChecked =
      (await this.showVoiceCallToggle.getAttribute('aria-checked')) === 'true';
    if (!isChecked) {
      await this.showVoiceCallToggle.click();
      await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
      await this.saveButton.click();
      await this.page.waitForTimeout(2_000);
    }
  }

  async disableVoiceCall(): Promise<void> {
    await expect(this.showVoiceCallToggle).toBeVisible({ timeout: 10_000 });
    const isChecked =
      (await this.showVoiceCallToggle.getAttribute('aria-checked')) === 'true';
    if (isChecked) {
      await this.showVoiceCallToggle.click();
      await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
      await this.saveButton.click();
      await this.page.waitForTimeout(2_000);
    }
  }

  async isEnhanceDocumentRetrievalEnabled(): Promise<boolean> {
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    return (
      (await this.enhanceDocumentRetrievalToggle.getAttribute(
        'aria-checked',
      )) === 'true'
    );
  }

  async enableEnhanceDocumentRetrieval(): Promise<void> {
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked = await this.isEnhanceDocumentRetrievalEnabled();
    if (!isChecked) {
      await this.enhanceDocumentRetrievalToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1_000);
  }

  async disableEnhanceDocumentRetrieval(): Promise<void> {
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked = await this.isEnhanceDocumentRetrievalEnabled();
    if (isChecked) {
      await this.enhanceDocumentRetrievalToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1_000);
  }

  async deleteMentor(): Promise<void> {
    await expect(this.deleteButton).toBeVisible({ timeout: 10_000 });
    await this.deleteButton.click();
    const confirmDialog = this.page.getByRole('alertdialog', {
      name: /delete mentor/i,
    });
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    const confirmButton = confirmDialog.getByRole('button', {
      name: /^delete$|confirm/i,
    });
    await expect(confirmButton).toBeEnabled({ timeout: 5_000 });
    // Stacked Radix dialogs leave overlapping overlays that intercept
    // pointer events; activate via keyboard instead of click.
    await confirmButton.focus();
    await confirmButton.press('Enter');
  }
}
