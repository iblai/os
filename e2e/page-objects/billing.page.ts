import { Page, Locator, expect } from '@playwright/test';
import {
  billingAutoRechargeSection,
  billingCreditsSection,
  getCurrentTenantShowPaywall,
  waitForBillingTabReady,
} from '@iblai/iblai-js/playwright';
import { planPickerDialog, waitForPlanPicker } from '../utils/plan-picker';

/**
 * Page object for the Billing tab inside the User Profile dialog and the
 * dialogs it opens: Manage Usage (auto recharge), Add Credits and the plan
 * picker. The Billing tab is only reachable on tenants where
 * `current_tenant.show_paywall` is true; the mentor app opens it via the
 * `?profileTab=billing` URL param (see `app/.../nav-bar/user-profile.tsx`).
 *
 * Billing is credits-only. The Credits card's actions follow the account's
 * state: a free-trial user gets "Upgrade" (opens the "Choose Your Plan"
 * picker); an account on a plan gets "Change Plan" (opens the "Change Your
 * Plan" picker, once the backend says which plan it is on) and "Add Credits"
 * (with or without a card on file; the dialog collects one on Stripe first).
 * The Auto Recharge card renders only with a card on file.
 */
export class BillingPage {
  readonly page: Page;

  readonly accountDialog: Locator;
  readonly creditsSection: Locator;
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
  /** Credits card → "Change Plan" (an account on a known plan). */
  readonly changePlanButton: Locator;
  /** Credits card → "Upgrade" (free trial only). */
  readonly upgradeButton: Locator;
  /** The plan picker opened by Change Plan / Upgrade, in either mode. */
  readonly planPicker: Locator;
  /** The Add Credits dialog's submit: "Add Credits" with a card, "Continue" without. */
  readonly addCreditsSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountDialog = page.getByRole('dialog');
    this.creditsSection = billingCreditsSection(page);
    this.autoRechargeSection = billingAutoRechargeSection(page);
    // By accessible name (the dialogs' titles): the User Profile dialog behind
    // them also contains the words "Auto Recharge" and "Add Credits", so a
    // hasText filter would match two dialogs.
    this.autoRechargeModal = page.getByRole('dialog', {
      name: /^manage usage$/i,
    });
    this.addCreditsModal = page.getByRole('dialog', { name: /^add credits$/i });
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
    this.changePlanButton = this.creditsSection.getByRole('button', {
      name: /^change plan$/i,
    });
    this.upgradeButton = this.creditsSection.getByRole('button', {
      name: /^upgrade$/i,
    });
    this.planPicker = planPickerDialog(page);
    this.addCreditsSubmitButton = this.addCreditsModal.getByRole('button', {
      name: /^(add credits|continue)$/i,
    });
  }

  /** True iff the current tenant has `show_paywall=true` in localStorage. */
  async isPaywallEnabled(): Promise<boolean> {
    return getCurrentTenantShowPaywall(this.page);
  }

  /**
   * Reads the "<n> Credits" value out of the open Billing tab's Credits
   * section (`data-testid="billing-credits-section"`). Mirrors the regex
   * used internally by the SDK's `getCreditBalanceRemaining` helper for the
   * nav-bar dropdown. Returns null when the section isn't rendered yet or
   * the text is unparseable.
   */
  async getCreditsRemaining(): Promise<number | null> {
    const text = await this.creditsSection.innerText().catch(() => '');
    const match = text.match(/([0-9][0-9,]*)\s*Credits/i);
    if (!match) return null;
    return parseInt(match[1].replace(/,/g, ''), 10);
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

  /**
   * The Credits card's one-line state sentence ("You're on the Free plan. Add
   * credits whenever you need more." / "You're on a free trial…"), or null
   * while the card is not rendered.
   */
  async getCreditsDescription(): Promise<string | null> {
    const line = this.creditsSection.getByText(/^You're on /);
    if ((await line.count()) === 0) return null;
    return (await line.first().innerText()).trim();
  }

  /**
   * Opens the plan picker from the Credits card: "Change Plan" for an account
   * on a plan, "Upgrade" on the free trial. Waits for the plan cards to show.
   */
  async openPlanPicker(): Promise<Locator> {
    const button =
      (await this.changePlanButton.count()) > 0
        ? this.changePlanButton
        : this.upgradeButton;
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
    return waitForPlanPicker(this.page);
  }

  async closePlanPicker(): Promise<void> {
    await this.planPicker.getByRole('button', { name: 'Close' }).click();
    await expect(this.planPicker).toBeHidden({ timeout: 10_000 });
  }

  async closeAccountDialog(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.creditsSection).not.toBeVisible({ timeout: 10_000 });
  }
}
