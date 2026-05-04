import { Page, Locator, expect } from '@playwright/test';
import {
  billingAutoRechargeSection,
  billingPlanSection,
  getCurrentTenantShowPaywall,
  waitForBillingTabReady,
} from '@iblai/iblai-js/playwright';

/**
 * Page object for the Billing tab inside the User Profile dialog and the
 * inline Auto Recharge / Add Credits modals it opens. The Billing tab is only
 * reachable on tenants where `current_tenant.show_paywall` is true; the mentor
 * app opens it via the `?profileTab=billing` URL param (see
 * `app/.../nav-bar/user-profile.tsx`).
 */
export class BillingPage {
  readonly page: Page;

  readonly accountDialog: Locator;
  readonly billingPlanSection: Locator;
  readonly autoRechargeSection: Locator;
  readonly autoRechargeModal: Locator;
  readonly addCreditsModal: Locator;
  readonly rechargeToggle: Locator;
  readonly thresholdInput: Locator;
  readonly amountInput: Locator;
  readonly cancelButton: Locator;
  readonly saveSettingsButton: Locator;
  readonly manageUsageButton: Locator;
  readonly addCreditsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountDialog = page.getByRole('dialog');
    this.billingPlanSection = billingPlanSection(page);
    this.autoRechargeSection = billingAutoRechargeSection(page);
    this.autoRechargeModal = page
      .getByRole('dialog')
      .filter({ hasText: /auto recharge/i });
    this.addCreditsModal = page
      .getByRole('dialog')
      .filter({ hasText: /add credits/i });
    this.rechargeToggle = this.autoRechargeModal.getByRole('switch', {
      name: /enable auto recharge/i,
    });
    this.thresholdInput = this.autoRechargeModal.locator('input#threshold');
    this.amountInput = this.autoRechargeModal.locator('input#amount');
    this.cancelButton = this.autoRechargeModal.getByRole('button', {
      name: /cancel/i,
    });
    this.saveSettingsButton = this.autoRechargeModal.getByRole('button', {
      name: /save settings/i,
    });
    this.manageUsageButton = this.autoRechargeSection.getByRole('button', {
      name: /^manage usage$/i,
    });
    this.addCreditsButton = page
      .getByTestId('billing-credits-section')
      .getByRole('button', { name: /^add credits$/i });
  }

  /** True iff the current tenant has `show_paywall=true` in localStorage. */
  async isPaywallEnabled(): Promise<boolean> {
    return getCurrentTenantShowPaywall(this.page);
  }

  /**
   * Opens the Billing tab inside the User Profile dialog by appending
   * `?profileTab=billing` to the current URL. Waits for the Plan section card
   * to mount before returning. Throws if the tenant has paywall disabled
   * (callers should guard with `isPaywallEnabled()` first).
   */
  async openBillingTab(): Promise<void> {
    const url = new URL(this.page.url());
    url.searchParams.set('profileTab', 'billing');
    await this.page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await waitForBillingTabReady(this.page);
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

  async openAddCreditsModal(): Promise<void> {
    await expect(this.addCreditsButton).toBeVisible({ timeout: 10_000 });
    await this.addCreditsButton.click();
    await expect(this.addCreditsModal).toBeVisible({ timeout: 10_000 });
  }

  async closeAddCreditsModal(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.addCreditsModal).not.toBeVisible({ timeout: 10_000 });
  }

  async closeAccountDialog(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.billingPlanSection).not.toBeVisible({ timeout: 10_000 });
  }
}
