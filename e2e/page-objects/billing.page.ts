import { Page, Locator, expect } from "@playwright/test";

export class BillingPage {
  readonly page: Page;

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

  // H19 fix: navigate via More options → platform name → User Profile dialog → Billing button
  // (matching the original billing/helpers.ts navigateToBillingSettings)
  async openBillingTab(): Promise<void> {
    const profileDropdown = this.page.getByRole("button", {
      name: "More options",
    });
    await expect(profileDropdown).toBeVisible({ timeout: 15_000 });
    await profileDropdown.click();

    const menu = this.page.getByRole("menu", { name: "More options" });
    await expect(menu).toBeVisible({ timeout: 5_000 });

    // Read platform name from localStorage to find the right menu item
    const platformName = await this.page.evaluate(() => {
      const raw = localStorage.getItem("current_tenant");
      if (!raw) return null;
      try {
        return JSON.parse(raw)?.platform_name ?? null;
      } catch {
        return null;
      }
    });

    if (platformName) {
      const tenantMenuItem = menu.getByText(platformName, { exact: true });
      await expect(tenantMenuItem).toBeVisible({ timeout: 5_000 });
      await tenantMenuItem.click();
    } else {
      // Fallback: click first menu item that isn't Profile/Help/Logout
      const menuItems = menu.getByRole("menuitem");
      await menuItems.first().click();
    }

    await expect(this.accountDialog).toBeVisible({ timeout: 10_000 });

    // Click the Billing button (it's a button role, not a tab role)
    const billingButton = this.accountDialog.getByRole("button", {
      name: "Billing",
    });
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
