import { Page, Locator, expect } from '@playwright/test';

export class BillingPage {
  readonly page: Page;

  readonly billingTab: Locator;
  readonly mainCard: Locator;
  readonly autoRechargeModal: Locator;
  readonly addCreditsModal: Locator;
  readonly rechargeToggle: Locator;
  readonly thresholdInput: Locator;
  readonly amountInput: Locator;
  readonly cancelButton: Locator;
  readonly manageUsageButton: Locator;
  readonly addCreditsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.billingTab = page.getByRole('tab', { name: /billing/i })
      .or(page.getByRole('button', { name: /billing/i }));
    this.mainCard = page
      .locator('[data-testid="billing-main-card"]')
      .or(page.locator('[class*="billing-card"]').first());
    this.autoRechargeModal = page
      .getByRole('dialog')
      .filter({ hasText: /auto recharge/i });
    this.addCreditsModal = page
      .getByRole('dialog')
      .filter({ hasText: /add credits/i });
    this.rechargeToggle = page.getByRole('switch', {
      name: /auto recharge/i,
    });
    this.thresholdInput = page.getByLabel(/threshold/i)
      .or(page.getByPlaceholder(/threshold/i));
    this.amountInput = page.getByLabel(/amount/i)
      .or(page.getByPlaceholder(/amount/i));
    this.cancelButton = this.autoRechargeModal.getByRole('button', {
      name: /cancel/i,
    });
    this.manageUsageButton = page.getByRole('button', {
      name: /manage usage/i,
    });
    this.addCreditsButton = page.getByRole('button', { name: /add credits/i });
  }

  async openBillingTab(): Promise<void> {
    // Open account settings modal first
    const profileDropdown = this.page.getByRole('button', {
      name: 'More options',
    });
    await expect(profileDropdown).toBeVisible({ timeout: 10_000 });
    await profileDropdown.click();

    const settingsItem = this.page
      .getByRole('menuitem', { name: /account|settings/i })
      .first();
    await expect(settingsItem).toBeVisible({ timeout: 5_000 });
    await settingsItem.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await expect(this.billingTab).toBeVisible({ timeout: 10_000 });
    await this.billingTab.click();
  }

  async openAutoRechargeModal(): Promise<void> {
    await expect(this.manageUsageButton).toBeVisible({ timeout: 10_000 });
    await this.manageUsageButton.click();
    await expect(this.autoRechargeModal).toBeVisible({ timeout: 10_000 });
  }

  async closeAutoRechargeModal(): Promise<void> {
    await expect(this.cancelButton).toBeVisible({ timeout: 5_000 });
    await this.cancelButton.click();
    await expect(this.autoRechargeModal).not.toBeVisible({ timeout: 10_000 });
  }
}
