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
    // The Advanced Sandbox switch — aria-label reflects its current state
    this.advancedSandboxToggle = dialog.getByRole('switch', {
      name: /^Advanced sandbox/i,
    });
    this.chatAccessCombobox = dialog.getByRole('combobox', {
      name: 'Select who can chat',
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
    await this.setAllowCopies(true);
  }

  async disableAllowCopies(): Promise<void> {
    await this.setAllowCopies(false);
  }

  /**
   * Toggles the Allow Copies switch to the desired state and waits until the
   * mutation is fully observable — the success toast must appear AND the next
   * mentor settings refetch has to settle, otherwise the Copy button on the
   * subsequent reopen can lag behind the form's toggle state by several
   * seconds (the cache invalidation is propagated async by RTK Query).
   */
  private async setAllowCopies(target: boolean): Promise<void> {
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
      this.page.getByText(/Mentor updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // Small buffer to let the post-mutation refetch land and React re-render
    // with fresh mentor data before the caller closes/reopens the dialog.
    await this.page.waitForTimeout(500);
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

  /**
   * Returns true when the Advanced Sandbox toggle is ON (aria-checked="true").
   */
  async isAdvancedSandboxEnabled(): Promise<boolean> {
    const state = await this.advancedSandboxToggle
      .getAttribute('aria-checked')
      .catch(() => 'false');
    return state === 'true';
  }

  /**
   * Sets the Advanced Sandbox toggle to the desired state and clicks Save.
   * Does nothing if the toggle is already in the desired state.
   *
   * Waits for the success toast to confirm the save completed before returning,
   * so callers can immediately assert on the downstream UI changes (Sandbox tab
   * appearing, Agent Configuration showing, etc.) without race conditions.
   */
  async setAdvancedSandbox(desired: boolean): Promise<void> {
    await expect(this.advancedSandboxToggle).toBeVisible({ timeout: 10_000 });
    const current = await this.isAdvancedSandboxEnabled();
    if (current !== desired) {
      await this.advancedSandboxToggle.click();
      // Wait for aria-checked to flip so we don't race ahead to Save
      await expect(this.advancedSandboxToggle).toHaveAttribute(
        'aria-checked',
        desired ? 'true' : 'false',
        { timeout: 5_000 },
      );
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    // Wait for the success toast that the mentor settings PUT completed and
    // RTK cache has been invalidated. Any role="status" toast within the
    // dialog tree will satisfy this; we match on the visible text.
    await expect(
      this.page.getByText(/mentor updated successfully/i).first(),
    ).toBeVisible({ timeout: 10_000 });
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
