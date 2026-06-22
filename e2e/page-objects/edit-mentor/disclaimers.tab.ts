import { Page, Locator, expect } from '@playwright/test';

export class DisclaimersTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly userAgreementSwitch: Locator;
  readonly activeStatus: Locator;
  // H20 fix: the Edit button is just labeled "Edit", not "Edit Agreement"
  readonly editButtons: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.userAgreementSwitch = dialog.getByRole('switch', {
      name: /user agreement/i,
    });
    this.activeStatus = dialog.getByText('Active').first();
    // H20 fix: buttons are just "Edit" — first is User Agreement, second is Advisory
    this.editButtons = dialog.getByRole('button', { name: 'Edit' });
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();
  }

  async enableUserAgreement(): Promise<void> {
    await expect(this.userAgreementSwitch).toBeVisible({ timeout: 10_000 });
    const isEnabled =
      (await this.userAgreementSwitch.getAttribute('aria-checked')) === 'true';
    if (!isEnabled) {
      await this.userAgreementSwitch.click();
      await expect(this.userAgreementSwitch).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );
    }
  }

  async disableUserAgreement(): Promise<void> {
    await expect(this.userAgreementSwitch).toBeVisible({ timeout: 10_000 });
    const isEnabled =
      (await this.userAgreementSwitch.getAttribute('aria-checked')) === 'true';
    if (isEnabled) {
      await this.userAgreementSwitch.click();
      await expect(this.userAgreementSwitch).toHaveAttribute(
        'aria-checked',
        'false',
        { timeout: 10_000 },
      );
    }
  }

  async isUserAgreementEnabled(): Promise<boolean> {
    return (
      (await this.userAgreementSwitch
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true'
    );
  }

  // H20 fix: open the Edit User Agreement modal (first Edit button)
  async openEditUserAgreementModal(): Promise<Locator> {
    await expect(this.editButtons.first()).toBeVisible({ timeout: 10_000 });
    await this.editButtons.first().click();
    const editModal = this.page
      .getByRole('dialog')
      .filter({ hasText: /edit|user agreement/i })
      .last();
    await expect(editModal).toBeVisible({ timeout: 10_000 });
    return editModal;
  }

  // H21 fix: open the Edit Advisory modal (second Edit button)
  // The advisory text is inside a separate modal, NOT inline in the tab
  async openEditAdvisoryModal(): Promise<Locator> {
    await expect(this.editButtons.nth(1)).toBeVisible({ timeout: 10_000 });
    await this.editButtons.nth(1).click();
    const editModal = this.page
      .getByRole('dialog')
      .filter({ hasText: /edit.*advisory|advisory/i })
      .last();
    await expect(editModal).toBeVisible({ timeout: 10_000 });
    return editModal;
  }
}
