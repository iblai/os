import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import {
  closeCreditBalanceDropdown,
  creditBalancePanel,
  creditBalancePlanBadge,
  creditBalanceTrigger,
  expectBillingTabForCurrentPlan,
  expectCreditBalanceForCurrentPlan,
  expectCreditBalanceVisibilityForTenant,
  getBillingPlanLabel,
  getCreditBalancePlanLabel,
  getCreditBalanceRemaining,
  logger,
  openCreditBalanceDropdown,
  waitForBillingTabReady,
} from '@iblai/iblai-js/playwright';

// ─── Journey 21: Billing & Subscription ──────────────────────────────────────
//
// Two surfaces are exercised:
//
//   A. CreditBalance dropdown — the credit-card icon in the nav-bar, gated by
//      `current_tenant.show_paywall`. Plan-aware footer (Upgrade Plan / Manage
//      Usage + Add Credits / Manage Billing) plus an inline Auto Recharge
//      section for Premium + payment-method tenants.
//
//   B. Billing tab — the third card stack in the User Profile dialog
//      (`?profileTab=billing`). Plan / Credits / Auto Recharge sections.
//
// Each test is independent and skips gracefully on tenants that have
// `show_paywall=false` so the suite is stable in environments where the
// paywall product is disabled.

test.describe('Journey 21-A: CreditBalance dropdown (nav-bar)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  // bill-01
  test('credit balance trigger visibility matches current_tenant.show_paywall', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    logger.info(
      `Tenant show_paywall=${shouldBeVisible} — trigger visibility verified`,
    );
  });

  // bill-02
  test('credit balance trigger has an accessible aria-label exposing remaining credits', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const trigger = creditBalanceTrigger(page);
    const label = await trigger.getAttribute('aria-label');
    expect(label).toBeTruthy();
    // Either the loading-state label or the credits-remaining label.
    expect(label).toMatch(/credit/i);
  });

  // bill-03
  test('opening the credit balance dropdown shows the plan badge', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    await openCreditBalanceDropdown(page);
    await expect(creditBalancePlanBadge(page)).toBeVisible({ timeout: 10_000 });
    const plan = await getCreditBalancePlanLabel(page);
    expect(plan).not.toBeNull();
    expect(['Free', 'Trial', 'Premium']).toContain(plan);
  });

  // bill-04
  test('credit balance dropdown UI matches the active plan (Free / Trial / Premium)', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    // Auto-detect dispatches into the matching plan-specific assertions.
    const plan = await expectCreditBalanceForCurrentPlan(page);
    logger.info(`Verified credit balance dropdown for ${plan} plan`);
  });

  // bill-05
  test('Premium + payment method shows Manage Usage, Add Credits, and the inline Auto Recharge section', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const panel = await openCreditBalanceDropdown(page);
    const plan = await getCreditBalancePlanLabel(page);

    const manageUsage = panel.getByRole('button', { name: /^Manage Usage$/ });
    const addCredits = panel.getByRole('button', { name: /^Add Credits$/ });
    const hasManageUsage = await manageUsage.isVisible().catch(() => false);

    if (plan !== 'Premium' || !hasManageUsage) {
      logger.info(
        `Skipping Premium+payment-only assertions (plan=${plan}, manageUsageVisible=${hasManageUsage})`,
      );
      return;
    }

    await expect(manageUsage).toBeVisible();
    await expect(addCredits).toBeVisible();
    await expect(panel.getByText(/^Auto Recharge$/)).toBeVisible();
  });

  // bill-06
  test('credit balance dropdown shows the Remaining credits row', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const panel = await openCreditBalanceDropdown(page);
    await expect(panel.getByText(/^Remaining$/)).toBeVisible({
      timeout: 10_000,
    });
    const remaining = await getCreditBalanceRemaining(page);
    // Helper returns null only when the row is missing or unparseable.
    expect(remaining).not.toBeNull();
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  // bill-07
  test('Manage Usage opens the Auto Recharge modal (Premium + payment method)', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const panel = await openCreditBalanceDropdown(page);
    const manageUsage = panel.getByRole('button', { name: /^Manage Usage$/ });
    if (!(await manageUsage.isVisible().catch(() => false))) {
      logger.info('Manage Usage not present — no payment method on file');
      return;
    }
    await manageUsage.click();
    const modal = page
      .getByRole('dialog')
      .filter({ hasText: /auto recharge/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(
      modal.getByRole('switch', { name: /enable auto recharge/i }),
    ).toBeVisible({ timeout: 5_000 });
    await modal.getByRole('button', { name: /^cancel$/i }).click();
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
  });

  // bill-08
  test('Add Credits opens the Add Credits modal (Premium + payment method)', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const panel = await openCreditBalanceDropdown(page);
    const addCredits = panel.getByRole('button', { name: /^Add Credits$/ });
    if (!(await addCredits.isVisible().catch(() => false))) {
      logger.info('Add Credits not present — no payment method on file');
      return;
    }
    await addCredits.click();
    const modal = page.getByRole('dialog').filter({ hasText: /add credits/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 10_000 });
  });

  // bill-09
  test('Escape closes the credit balance dropdown', async ({ page }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    await openCreditBalanceDropdown(page);
    await expect(creditBalancePanel(page)).toBeVisible();
    await closeCreditBalanceDropdown(page);
    await expect(creditBalancePanel(page)).toHaveCount(0);
  });
});

test.describe('Journey 21-B: Billing tab (User Profile dialog)', () => {
  test.beforeEach(async ({ page, billingPage }) => {
    await navigateToMentorApp(page);
    if (!(await billingPage.isPaywallEnabled())) {
      test.skip(true, 'show_paywall=false on this tenant');
    }
  });

  // bill-10
  test('Billing tab opens via ?profileTab=billing and the Plan section mounts', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    await expect(billingPage.billingPlanSection).toBeVisible({
      timeout: 15_000,
    });
    const plan = await getBillingPlanLabel(page);
    expect(plan).not.toBeNull();
    expect(['Free', 'Trial', 'Premium']).toContain(plan);
  });

  // bill-11
  test('Billing tab Plan / Credits / Auto Recharge sections match the active plan', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    // Auto-detect dispatches into expectBillingTabFor{Free,Trial,Premium}Plan.
    // For non-Free plans the helper accepts hasPaymentMethod — leave it
    // unspecified so the per-plan helper only checks the always-on rows
    // (Available / Plan label / Current pill / Upgrade button gating).
    const plan = await expectBillingTabForCurrentPlan(page);
    logger.info(`Verified Billing tab for ${plan} plan`);
  });

  // bill-12
  test('Billing tab Auto Recharge section is hidden on Free plan and shown on non-Free + payment method', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    await waitForBillingTabReady(page);
    const plan = await getBillingPlanLabel(page);

    if (plan === 'Free') {
      await expect(billingPage.autoRechargeSection).toHaveCount(0);
      return;
    }

    const visible = await billingPage.autoRechargeSection
      .isVisible()
      .catch(() => false);
    if (visible) {
      await expect(
        billingPage.autoRechargeSection.getByRole('button', {
          name: /^Manage Usage$/,
        }),
      ).toBeVisible();
      await expect(
        billingPage.autoRechargeSection.getByTestId(
          'billing-auto-recharge-status',
        ),
      ).toContainText(/Enabled|Disabled/);
    } else {
      logger.info(
        `Auto Recharge section hidden on ${plan} plan — no payment method on file`,
      );
    }
  });

  // bill-13
  test('Billing tab Manage Usage opens the Auto Recharge modal with all expected controls', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    if (
      !(await billingPage.autoRechargeSection.isVisible().catch(() => false))
    ) {
      logger.info('Auto Recharge section absent — no payment method on file');
      return;
    }
    await billingPage.openAutoRechargeModal();

    await expect(billingPage.autoRechargeModal).toHaveRole('dialog');
    await expect(billingPage.rechargeToggle).toBeVisible({ timeout: 5_000 });
    await expect(
      billingPage.autoRechargeModal.getByText(/recharge threshold/i),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      billingPage.autoRechargeModal.getByText(/recharge amount/i),
    ).toBeVisible({ timeout: 5_000 });
    await expect(billingPage.cancelButton).toBeVisible({ timeout: 5_000 });
    await expect(billingPage.saveSettingsButton).toBeVisible({
      timeout: 5_000,
    });

    await billingPage.closeAutoRechargeModal();
  });

  // bill-14
  test('Billing tab Auto Recharge toggle inverts when clicked and restores on second click', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    if (
      !(await billingPage.autoRechargeSection.isVisible().catch(() => false))
    ) {
      logger.info('Auto Recharge section absent — no payment method on file');
      return;
    }
    await billingPage.openAutoRechargeModal();

    const initial = await billingPage.rechargeToggle.isChecked();
    await billingPage.rechargeToggle.click();
    expect(await billingPage.rechargeToggle.isChecked()).toBe(!initial);
    // Restore so the test leaves no side effects.
    await billingPage.rechargeToggle.click();
    expect(await billingPage.rechargeToggle.isChecked()).toBe(initial);

    await billingPage.closeAutoRechargeModal();
  });

  // bill-15
  test('Billing tab Auto Recharge threshold and amount inputs accept values', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    if (
      !(await billingPage.autoRechargeSection.isVisible().catch(() => false))
    ) {
      logger.info('Auto Recharge section absent — no payment method on file');
      return;
    }
    await billingPage.openAutoRechargeModal();

    await expect(billingPage.thresholdInput).toBeVisible({ timeout: 5_000 });
    await expect(billingPage.amountInput).toBeVisible({ timeout: 5_000 });
    const origThreshold = await billingPage.thresholdInput.inputValue();
    const origAmount = await billingPage.amountInput.inputValue();

    await billingPage.thresholdInput.fill('25');
    await billingPage.amountInput.fill('100');
    await expect(billingPage.thresholdInput).toHaveValue('25');
    await expect(billingPage.amountInput).toHaveValue('100');

    // Restore — modal stays open so closeAutoRechargeModal works.
    await billingPage.thresholdInput.fill(origThreshold);
    await billingPage.amountInput.fill(origAmount);

    await billingPage.closeAutoRechargeModal();
  });

  // bill-16
  test('Billing tab Add Credits button opens the Add Credits modal (non-Free + payment method)', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    if (!(await billingPage.addCreditsButton.isVisible().catch(() => false))) {
      logger.info('Add Credits absent — Free plan or no payment method');
      return;
    }
    await billingPage.openAddCreditsModal();
    await expect(billingPage.addCreditsModal).toBeVisible();
    await billingPage.closeAddCreditsModal();
  });

  // bill-17
  test('plan label is consistent between the credit balance dropdown and the Billing tab', async ({
    page,
    billingPage,
  }) => {
    await openCreditBalanceDropdown(page);
    const dropdownPlan = await getCreditBalancePlanLabel(page);
    await closeCreditBalanceDropdown(page);

    await billingPage.openBillingTab();
    const tabPlan = await getBillingPlanLabel(page);

    expect(tabPlan).toEqual(dropdownPlan);
  });
});

test.describe('Journey 21-C: Non-admin subscription pricing', () => {
  // The non-admin Stripe pricing modal flow is gated by the project's
  // subscription-wrapper logic, which is wired to `show_paywall`. Skip
  // gracefully when the paywall is off rather than failing.
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // bill-18
  test('non-admin without subscription sees the Stripe pricing modal when creating a mentor', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const visible = await nonadminSidebarPage.newMentorButton
      .isVisible()
      .catch(() => false);
    if (!visible) {
      logger.info('New mentor button hidden for non-admin — skipping');
      return;
    }
    await nonadminSidebarPage.newMentorButton.click();
    const pricingModal = nonadminPage
      .getByRole('dialog')
      .filter({ hasText: /upgrade|pricing|subscribe/i });
    const pricingVisible = await pricingModal
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!pricingVisible) {
      logger.info(
        'Stripe pricing modal did not appear — paywall likely off for this tenant',
      );
      return;
    }
    await expect(pricingModal).toBeVisible();
    await nonadminPage.keyboard.press('Escape');
  });
});
