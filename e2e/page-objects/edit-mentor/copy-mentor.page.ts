import { Page, Locator, expect } from '@playwright/test';
import { waitForPageReady } from '../../utils/resilient';

export class CopyMentorPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly trainingDataToggle: Locator;
  readonly destinationCombobox: Locator;
  readonly copyButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /Copy Mentor/i });
    this.nameInput = this.dialog.getByRole('textbox', {
      name: 'Mentor Name',
    });
    this.trainingDataToggle = this.dialog.locator('button[role="switch"]');
    this.destinationCombobox = this.dialog.getByRole('combobox', {
      name: 'Select destination tenant',
    });
    this.copyButton = this.dialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    this.cancelButton = this.dialog.getByRole('button', { name: 'Cancel' });
  }

  async waitForOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
  }

  async close(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.dialog).not.toBeVisible({ timeout: 15_000 });
  }

  async closeViaEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).not.toBeVisible({ timeout: 15_000 });
  }

  async setName(name: string): Promise<void> {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
  }

  async getName(): Promise<string> {
    return this.nameInput.inputValue();
  }

  async setIncludeTrainingData(enabled: boolean): Promise<void> {
    await expect(this.trainingDataToggle).toBeVisible({ timeout: 5_000 });
    const isChecked =
      (await this.trainingDataToggle.getAttribute('aria-checked')) === 'true';
    if (isChecked !== enabled) {
      await this.trainingDataToggle.click();
    }
    await expect(this.trainingDataToggle).toHaveAttribute(
      'aria-checked',
      String(enabled),
    );
  }

  /**
   * Select a different tenant from the destination dropdown.
   * Returns the selected tenant name, or null if no other tenant is available.
   */
  async selectDifferentTenant(
    currentTenantKey: string,
  ): Promise<string | null> {
    await this.destinationCombobox.click();
    await this.page.waitForTimeout(1_000);

    const options = this.page.locator('[role="option"]');
    const optionCount = await options.count();

    for (let i = 0; i < optionCount; i++) {
      const optionText = await options.nth(i).textContent();
      if (optionText && !optionText.includes(currentTenantKey)) {
        const tenantName = optionText.trim();
        await options.nth(i).click();
        return tenantName;
      }
    }
    return null;
  }

  /**
   * Check if the destination tenant selector is available (user has multiple admin tenants).
   * Waits up to the specified timeout.
   */
  async hasDestinationSelector(timeout = 120_000): Promise<boolean> {
    try {
      await this.destinationCombobox.waitFor({
        state: 'visible',
        timeout,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Click Copy and wait for the dialog to close and navigation to complete.
   */
  async submitCopy(): Promise<void> {
    await this.copyButton.click();
    await expect(this.dialog).not.toBeVisible({ timeout: 60_000 });
    await waitForPageReady(this.page);
    await this.page.waitForLoadState('networkidle');
  }
}
