import { Page, Locator, expect } from '@playwright/test';
import { waitForPageReady } from '../../utils/resilient';

export class CopyMentorPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly trainingDataToggle: Locator;
  readonly copyHereCheckbox: Locator;
  readonly continueButton: Locator;
  readonly copyButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /Copy Agent/i });
    this.nameInput = this.dialog.getByRole('textbox', {
      name: 'Agent Name',
    });
    this.trainingDataToggle = this.dialog.locator('button[role="switch"]');
    // Shown only to an admin of the organization being copied from: ticked,
    // the copy is made here; unticked, Continue hands it to the auth app.
    this.copyHereCheckbox = this.dialog.getByRole('checkbox');
    this.continueButton = this.dialog.getByRole('button', {
      name: 'Continue',
      exact: true,
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
    // Stacked Radix dialogs may swallow Escape; fall back to Cancel button
    const closed = await this.dialog
      .waitFor({ state: 'hidden', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!closed) {
      await this.cancelButton.click();
      await expect(this.dialog).not.toBeVisible({ timeout: 15_000 });
    }
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
      await expect(this.trainingDataToggle).toBeEnabled({ timeout: 10_000 });
      await this.trainingDataToggle.click();
    }
    await expect(this.trainingDataToggle).toHaveAttribute(
      'aria-checked',
      String(enabled),
    );
  }

  /**
   * Turn off "copy to this organization", which is what swaps Copy for
   * Continue. Only an admin of the current organization is offered the
   * choice; for anyone else Continue is already the only button.
   */
  async chooseAnotherOrganization(): Promise<void> {
    if (await this.copyHereCheckbox.isVisible().catch(() => false)) {
      await this.copyHereCheckbox.uncheck();
    }
    await expect(this.continueButton).toBeVisible({ timeout: 15_000 });
  }

  /** Whether this user may copy into the organization they are already in. */
  async canCopyHere(timeout = 120_000): Promise<boolean> {
    try {
      await this.copyHereCheckbox.waitFor({ state: 'visible', timeout });
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
    // Bounded + non-fatal: the app keeps long-lived connections open (chat
    // streaming / websockets / polling) so the network may never idle for
    // 500ms. Cap the wait so it can't hang the test, but still let it
    // settle when traffic does quiesce.
    await this.page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
  }
}
