import { Page, Locator, expect } from '@playwright/test';

export class DisclaimersTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly userAgreementSwitch: Locator;
  readonly activeStatus: Locator;
  readonly editAgreementButton: Locator;
  readonly advisoryTextarea: Locator;
  readonly saveButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.userAgreementSwitch = dialog.getByRole('switch', {
      name: /user agreement/i,
    });
    this.activeStatus = dialog.getByText('Active').first();
    this.editAgreementButton = dialog.getByRole('button', {
      name: /edit.*agreement|edit.*content/i,
    });
    this.advisoryTextarea = dialog.getByRole('textbox', { name: /advisory/i })
      .or(dialog.locator('textarea[name*="advisory"]'));
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();
  }

  async enableUserAgreement(): Promise<void> {
    await expect(this.userAgreementSwitch).toBeVisible({ timeout: 10_000 });
    const isEnabled =
      (await this.userAgreementSwitch.getAttribute('aria-checked')) === 'true';
    if (!isEnabled) {
      await this.userAgreementSwitch.click();
      await expect(this.userAgreementSwitch).toHaveAttribute('aria-checked', 'true', {
        timeout: 10_000,
      });
    }
  }

  async disableUserAgreement(): Promise<void> {
    await expect(this.userAgreementSwitch).toBeVisible({ timeout: 10_000 });
    const isEnabled =
      (await this.userAgreementSwitch.getAttribute('aria-checked')) === 'true';
    if (isEnabled) {
      await this.userAgreementSwitch.click();
      await expect(this.userAgreementSwitch).toHaveAttribute('aria-checked', 'false', {
        timeout: 10_000,
      });
    }
  }

  async isUserAgreementEnabled(): Promise<boolean> {
    return (
      (await this.userAgreementSwitch.getAttribute('aria-checked').catch(() => 'false')) === 'true'
    );
  }
}
