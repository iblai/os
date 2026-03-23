import { Page, Locator, expect } from "@playwright/test";

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

  private accountDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountDialog = page.getByRole("dialog", { name: "User Profile" });
    this.billingTab = this.accountDialog.getByRole("button", {
      name: /billing/i,
    });
    this.mainCard = this.accountDialog.locator(
      '[data-testid="billing-card"], [class*="billing-card"]',
    );
    this.autoRechargeModal = page
      .getByRole("dialog")
      .filter({ hasText: /auto recharge/i });
    this.addCreditsModal = page
      .getByRole("dialog")
      .filter({ hasText: /add credits/i });
    this.rechargeToggle = page.getByRole("switch", {
      name: /auto recharge/i,
    });
    this.thresholdInput = page.locator("input#threshold");
    this.amountInput = page.locator("input#amount");
    this.cancelButton = this.autoRechargeModal.getByRole("button", {
      name: /cancel/i,
    });
    this.manageUsageButton = page.getByRole("button", {
      name: /manage usage/i,
    });
    this.addCreditsButton = page.getByRole("button", { name: /add credits/i });
  }

  // Navigate via More options dropdown → profile/account dialog → Billing tab
  async openBillingTab(): Promise<void> {
    const profileDropdown = this.page.getByRole("button", {
      name: "More options",
    });
    await expect(profileDropdown).toBeVisible({ timeout: 15_000 });
    await profileDropdown.click();

    // Try Profile menuitem first
    const profileItem = this.page.getByRole("menuitem", { name: /profile/i });
    const profileVisible = await profileItem
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (profileVisible) {
      await profileItem.click();
    } else {
      // Fallback: try clicking first available menuitem to open the dialog
      const menu = this.page.getByRole("menu", { name: "More options" });
      await expect(menu).toBeVisible({ timeout: 5_000 });
      const menuItems = menu.getByRole("menuitem");
      await menuItems.first().click();
    }

    await expect(this.accountDialog).toBeVisible({ timeout: 10_000 });

    // Look for Billing button/tab inside the dialog
    const billingButton = this.accountDialog
      .getByRole("button", { name: "Billing" })
      .or(this.accountDialog.getByRole("tab", { name: /billing/i }));
    await expect(billingButton).toBeVisible({ timeout: 10_000 });
    await billingButton.click();
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

  async closeAccountDialog(): Promise<void> {
    const closeButton = this.accountDialog.getByRole("button", {
      name: "Close",
    });
    await expect(closeButton).toBeVisible({ timeout: 5_000 });
    await closeButton.click();
    await expect(this.accountDialog).not.toBeVisible({ timeout: 5_000 });
  }
}
