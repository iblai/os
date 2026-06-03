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
  readonly advancedSandboxToggle: Locator;
  readonly chatAccessCombobox: Locator;
  readonly memoryToggle: Locator;
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
    // Renamed in the Capabilities sub-tab: aria-label is now
    // "Allow other admins to clone this agent" (no enabled/disabled
    // suffix — state is exposed via aria-checked).
    this.allowCopiesToggle = dialog.getByRole('switch', {
      name: /allow other admins to clone this agent/i,
    });
    this.copyMentorButton = dialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    // Capabilities sub-tab. Renamed visible label "Enable voice calls".
    this.showVoiceCallToggle = dialog.getByRole('switch', {
      name: /enable voice calls/i,
    });
    // Capabilities sub-tab. Renamed visible label "Enable advanced sandbox".
    this.advancedSandboxToggle = dialog.getByRole('switch', {
      name: /enable advanced sandbox/i,
    });
    this.chatAccessCombobox = dialog.getByRole('combobox', {
      name: 'Select who can chat',
    });
    // Capabilities sub-tab. Renamed visible label "Remember past conversations".
    this.memoryToggle = dialog.getByRole('switch', {
      name: /remember past conversations/i,
    });
    // Capabilities sub-tab. Renamed visible label "Improve document retrieval".
    this.enhanceDocumentRetrievalToggle = dialog.getByRole('switch', {
      name: /improve document retrieval/i,
    });
    this.enhanceDocumentRetrievalTooltipTrigger = dialog.getByRole('button', {
      name: 'More info about improve document retrieval',
    });
  }

  /**
   * Settings is now split into Basic / Discovery / Capabilities sub-tabs.
   * Each interaction below auto-switches to the right sub-tab so callers
   * don't have to know the layout. No-op when already on the target tab.
   *
   * The parent category Tabs use distinct names (Configurations /
   * Integrations / Analytics), so an exact-name role match is sufficient
   * to target only the inner sub-tab without extra filters.
   */
  async selectSubTab(
    name: 'Basic' | 'Discovery' | 'Capabilities',
  ): Promise<void> {
    const tab = this.dialog.getByRole('tab', { name, exact: true });
    await expect(tab).toBeVisible({ timeout: 10_000 });
    const selected = await tab.getAttribute('aria-selected').catch(() => null);
    if (selected !== 'true') {
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true', {
        timeout: 5_000,
      });
    }
  }

  async copyUniqueId(): Promise<void> {
    await expect(this.copyButton).toBeVisible({ timeout: 10_000 });
    await this.copyButton.click();
  }

  async setVisibility(label: string): Promise<void> {
    await this.selectSubTab('Discovery');
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
    await this.selectSubTab('Discovery');
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
    await this.setAllowCopies(true);
  }

  async disableAllowCopies(): Promise<void> {
    await this.setAllowCopies(false);
  }

  /**
   * Toggles the Copies switch to the desired state and waits until the
   * mutation is fully observable — the success toast must appear AND the next
   * mentor settings refetch has to settle, otherwise the Copy button on the
   * subsequent reopen can lag behind the form's toggle state by several
   * seconds (the cache invalidation is propagated async by RTK Query).
   */
  private async setAllowCopies(target: boolean): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.allowCopiesToggle).toBeVisible({ timeout: 10_000 });
    const isChecked =
      (await this.allowCopiesToggle.getAttribute('aria-checked')) === 'true';
    if (isChecked === target) {
      return;
    }
    await this.allowCopiesToggle.click();
    await expect(this.allowCopiesToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 30_000 },
    );
    await expect(this.saveButton).toBeEnabled({ timeout: 30_000 });
    await this.saveButton.click();
    // Block until the backend confirms the write — the success toast is the
    // earliest reliable signal that the mutation resolved and RTK Query has
    // started invalidating the mentor cache. Don't wait for networkidle here:
    // the app fires a periodic analytics heartbeat (~every 30s) so networkidle
    // can hang indefinitely in steady state.
    await expect(
      this.page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // Small buffer to let the post-mutation refetch land and React re-render
    // with fresh mentor data before the caller closes/reopens the dialog.
    await this.page.waitForTimeout(500);
  }

  async enableVoiceCall(): Promise<void> {
    await this.selectSubTab('Capabilities');
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
    await this.selectSubTab('Capabilities');
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

  /**
   * Returns true if the Memory toggle is currently checked.
   * The Memory toggle moved from the Memory tab to the Settings tab in fix/1584.
   * It is a form-driven switch — changes only persist after Save is clicked.
   */
  async isMemoryEnabled(): Promise<boolean> {
    await this.selectSubTab('Capabilities');
    await expect(this.memoryToggle).toBeVisible({ timeout: 10_000 });
    return (
      (await this.memoryToggle
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true'
    );
  }

  /**
   * Sets the Memory toggle to the desired state and saves the form.
   * A no-op if the toggle is already in the desired state.
   *
   * Design note: Save is called internally (same as enableVoiceCall /
   * setAllowCopies) so callers don't need to know about the form lifecycle.
   */
  async setMemoryEnabled(target: boolean): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.memoryToggle).toBeVisible({ timeout: 10_000 });
    const isChecked =
      (await this.memoryToggle.getAttribute('aria-checked')) === 'true';
    if (isChecked === target) {
      return;
    }
    await this.memoryToggle.click();
    await expect(this.memoryToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 10_000 },
    );
    await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
    await this.saveButton.click();
    await expect(
      this.page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // Small buffer for RTK Query cache invalidation before the caller
    // closes or re-opens the dialog.
    await this.page.waitForTimeout(500);
  }

  async isEnhanceDocumentRetrievalEnabled(): Promise<boolean> {
    await this.selectSubTab('Capabilities');
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
    await this.selectSubTab('Capabilities');
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked = await this.isEnhanceDocumentRetrievalEnabled();
    if (!isChecked) {
      await this.enhanceDocumentRetrievalToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    // Bounded + non-fatal: the periodic analytics heartbeat (~30s) means
    // the network may never idle, so cap networkidle so it can't hang.
    await this.page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  async disableEnhanceDocumentRetrieval(): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked = await this.isEnhanceDocumentRetrievalEnabled();
    if (isChecked) {
      await this.enhanceDocumentRetrievalToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    // Bounded + non-fatal: the periodic analytics heartbeat (~30s) means
    // the network may never idle, so cap networkidle so it can't hang.
    await this.page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  /**
   * Returns true when the Sandbox toggle is ON (aria-checked="true").
   */
  async isAdvancedSandboxEnabled(): Promise<boolean> {
    await this.selectSubTab('Capabilities');
    const state = await this.advancedSandboxToggle
      .getAttribute('aria-checked')
      .catch(() => 'false');
    return state === 'true';
  }

  /**
   * Sets the Sandbox toggle to the desired state and clicks Save.
   * Does nothing if the toggle is already in the desired state.
   *
   * Waits for the success toast to confirm the save completed before returning,
   * so callers can immediately assert on the downstream UI changes (Sandbox tab
   * appearing, Agent Configuration showing, etc.) without race conditions.
   */
  async setAdvancedSandbox(desired: boolean): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.advancedSandboxToggle).toBeVisible({ timeout: 10_000 });
    const current = await this.isAdvancedSandboxEnabled();
    if (current !== desired) {
      await this.advancedSandboxToggle.click();
      await expect(this.advancedSandboxToggle).toHaveAttribute(
        'aria-checked',
        desired ? 'true' : 'false',
        { timeout: 5_000 },
      );
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    await expect(
      this.page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  async deleteMentor(): Promise<void> {
    await expect(this.deleteButton).toBeVisible({ timeout: 10_000 });
    await this.deleteButton.click();
    const confirmDialog = this.page.getByRole('alertdialog', {
      name: /delete agent/i,
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
