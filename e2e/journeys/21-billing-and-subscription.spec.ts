import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import {
  closePlanPicker,
  expectChangePlanPicker,
  expectTrialPlanPicker,
  getPlanPickerMode,
  oneTimeCreditsBox,
  planPickerDialog,
} from '../utils/plan-picker';
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
// Billing is credits-only. An account is in one of two states, and every
// surface below follows it:
//
//   - Free trial (main tenant, no workspace of its own yet): the badge reads
//     "Trial" and the one action is "Upgrade", which opens the "Choose Your
//     Plan" picker (Free / Pro / Max / Ultra, "Choose <name>" each, Pro marked
//     "Most Popular"). Choosing a plan leaves for a Stripe checkout.
//   - On a plan: the badge names the plan ("Free", "Pro", "Max", …). "Add
//     Credits" is always offered (its dialog collects a card on Stripe first
//     when none is on file); "Manage Usage" and the inline Auto Recharge
//     section appear once a card is on file; and "Change Plan" sits beside the
//     badge once the backend says which plan the account is on. Change Plan
//     opens the same picker in change mode ("Change Your Plan": the current
//     plan marked, "Upgrade to" / "Downgrade to" the others, and an "Add
//     One-Time Credits" shortcut).
//
// Three surfaces are exercised:
//
//   A. CreditBalance dropdown — the credit-card icon in the nav-bar, gated by
//      `current_tenant.show_paywall` (and shown to admins and trial users).
//   B. Billing tab — the card stack in the User Profile dialog
//      (`?profileTab=billing`): Credits / Auto Recharge cards.
//   C. Non-admin — gated actions never land on the admin billing path.
//
// The admin account's state depends on the environment, so the tests read it
// from the UI and assert what that state must show; nothing here charges a
// card or changes a plan. Each test is independent and skips gracefully on
// tenants with `show_paywall=false`.

/** What the open credit dropdown says about the account. */
interface DropdownState {
  panel: Locator;
  /** `Trial` on the free trial, `Free` for any plan (the badge names it). */
  plan: 'Trial' | 'Free';
  /** The badge's text: "Trial", "Free" or the plan's name. */
  badge: string;
  /** "Change Plan" beside the badge: the backend named the plan. */
  canChangePlan: boolean;
  /** "Manage Usage" in the footer: a card is on file. */
  hasPaymentMethod: boolean;
}

async function readDropdownState(page: Page): Promise<DropdownState> {
  const panel = await openCreditBalanceDropdown(page);
  const plan = await getCreditBalancePlanLabel(page);
  if (!plan) {
    throw new Error(
      'Credit balance plan badge was not found in the dropdown panel',
    );
  }
  const badge = (await creditBalancePlanBadge(page).innerText()).trim();
  const canChangePlan =
    (await panel.getByRole('button', { name: /^Change Plan$/ }).count()) > 0;
  const hasPaymentMethod =
    (await panel.getByRole('button', { name: /^Manage Usage$/ }).count()) > 0;
  return { panel, plan, badge, canChangePlan, hasPaymentMethod };
}

/** The Add Credits dialog, by its title (opened from the dropdown or the tab). */
function addCreditsDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /^Add Credits$/ });
}

/** The Manage Usage (auto recharge) dialog, by its title. */
function manageUsageDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: /^Manage Usage$/ });
}

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
  test('opening the credit balance dropdown shows the plan badge (Trial, Free or the plan name)', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    await openCreditBalanceDropdown(page);
    await expect(creditBalancePlanBadge(page)).toBeVisible({ timeout: 10_000 });
    const { plan, badge } = await readDropdownState(page);
    expect(['Free', 'Trial']).toContain(plan);
    expect(badge.length).toBeGreaterThan(0);
    logger.info(`Plan badge reads "${badge}" (billing state: ${plan})`);
  });

  // bill-04
  test('credit balance dropdown UI matches the billing state (Trial / on a plan)', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    // Auto-detect dispatches into the matching state-specific assertions.
    const plan = await expectCreditBalanceForCurrentPlan(page);
    logger.info(`Verified credit balance dropdown for the ${plan} state`);
  });

  // bill-05
  test('on a plan with a card on file the dropdown shows Manage Usage, Add Credits and the inline Auto Recharge section', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const { panel, plan, hasPaymentMethod } = await readDropdownState(page);
    if (plan === 'Trial' || !hasPaymentMethod) {
      logger.info(
        `Skipping card-on-file assertions (state=${plan}, hasPaymentMethod=${hasPaymentMethod})`,
      );
      return;
    }

    await expect(
      panel.getByRole('button', { name: /^Manage Usage$/ }),
    ).toBeVisible();
    await expect(
      panel.getByRole('button', { name: /^Add Credits$/ }),
    ).toBeVisible();
    await expect(panel.getByText(/^Auto Recharge$/)).toBeVisible();
    await expect(panel.getByText(/^(Enabled|Disabled)$/)).toBeVisible();
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
  test('Manage Usage opens the Manage Usage dialog (card on file)', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const { panel, hasPaymentMethod } = await readDropdownState(page);
    if (!hasPaymentMethod) {
      logger.info('Manage Usage not present — no payment method on file');
      return;
    }
    await panel.getByRole('button', { name: /^Manage Usage$/ }).click();
    const dialog = manageUsageDialog(page);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('switch', { name: /enable auto recharge/i }),
    ).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  // bill-08
  test('Add Credits opens the Add Credits dialog (on a plan, with or without a card)', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const { panel, plan } = await readDropdownState(page);
    if (plan === 'Trial') {
      logger.info(
        'Free trial — Add Credits is not offered until a plan is chosen',
      );
      return;
    }
    await panel.getByRole('button', { name: /^Add Credits$/ }).click();
    const dialog = addCreditsDialog(page);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 10_000 });
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

  // bill-19
  test('the Billing row offers Change Plan beside the badge on a known plan, and Upgrade instead on the free trial', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const { panel, plan, badge, canChangePlan } = await readDropdownState(page);
    await expect(panel.getByText(/^Billing$/)).toBeVisible();
    const upgrade = panel.getByRole('button', { name: /^Upgrade$/ });
    const changePlan = panel.getByRole('button', { name: /^Change Plan$/ });

    if (plan === 'Trial') {
      await expect(upgrade).toBeVisible();
      await expect(changePlan).toHaveCount(0);
      await expect(
        panel.getByRole('button', { name: /^(Add Credits|Manage Usage)$/ }),
      ).toHaveCount(0);
      return;
    }

    await expect(upgrade).toHaveCount(0);
    if (canChangePlan) {
      await expect(changePlan).toBeVisible();
      logger.info(`On the ${badge} plan — Change Plan offered`);
    } else {
      // The default "Free" label (the backend did not name the plan) cannot
      // be changed from here.
      logger.info(
        `Badge "${badge}" without a plan key — Change Plan not offered`,
      );
    }
  });

  // bill-20
  test('Change Plan opens the Change Your Plan picker, and Upgrade the Choose Your Plan picker; Close closes it', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const { panel, plan, canChangePlan } = await readDropdownState(page);

    if (plan === 'Trial') {
      await panel.getByRole('button', { name: /^Upgrade$/ }).click();
      await expectTrialPlanPicker(page);
      await closePlanPicker(page);
      return;
    }
    if (!canChangePlan) {
      logger.info('Change Plan not offered on this account — nothing to open');
      return;
    }

    await panel.getByRole('button', { name: /^Change Plan$/ }).click();
    const keys = await expectChangePlanPicker(page);
    // Enterprise is sold by the team, not picked: a sentence above the cards.
    await expect(
      planPickerDialog(page).getByRole('link', { name: 'contact our team' }),
    ).toBeVisible();
    logger.info(`Change-plan picker offers: ${keys.join(', ')}`);
    await closePlanPicker(page);
    // Opening the picker closed the dropdown; it stays closed.
    await expect(creditBalancePanel(page)).toHaveCount(0);
  });

  // bill-21
  test('Add One-Time Credits in the change-plan picker closes it and opens the Add Credits dialog', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const { panel, plan, canChangePlan } = await readDropdownState(page);
    if (plan === 'Trial' || !canChangePlan) {
      logger.info(
        `No change-plan picker on this account (state=${plan}, canChangePlan=${canChangePlan})`,
      );
      return;
    }

    await panel.getByRole('button', { name: /^Change Plan$/ }).click();
    await expectChangePlanPicker(page);
    await oneTimeCreditsBox(page)
      .getByRole('button', { name: 'Add One-Time Credits' })
      .click();
    await expect(planPickerDialog(page)).toBeHidden({ timeout: 10_000 });
    const dialog = addCreditsDialog(page);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  // bill-22
  test('the Add Credits dialog offers $20 / $50 / $100, an Other amount field, a submit that matches the card state, and refuses an empty amount', async ({
    page,
  }) => {
    const { shouldBeVisible } =
      await expectCreditBalanceVisibilityForTenant(page);
    test.skip(!shouldBeVisible, 'show_paywall=false on this tenant');

    const { panel, plan, hasPaymentMethod } = await readDropdownState(page);
    if (plan === 'Trial') {
      logger.info(
        'Free trial — Add Credits is not offered until a plan is chosen',
      );
      return;
    }

    await panel.getByRole('button', { name: /^Add Credits$/ }).click();
    const dialog = addCreditsDialog(page);
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const quickAmounts = dialog.getByRole('group', { name: 'Quick amounts' });
    for (const amount of ['$20', '$50', '$100']) {
      await expect(
        quickAmounts.getByRole('button', { name: amount, exact: true }),
      ).toBeVisible();
    }
    // The custom field only appears once "Other amount" is picked.
    await expect(dialog.getByLabel(/^Amount \(USD\)$/)).toHaveCount(0);

    // With a card the dialog charges at once ("Add Credits"); without one it
    // first sends the person to Stripe to save a card ("Continue").
    const submit = dialog.getByRole('button', {
      name: /^(Add Credits|Continue)$/,
    });
    await expect(submit).toHaveText(
      hasPaymentMethod ? 'Add Credits' : 'Continue',
    );

    // No amount chosen: the form refuses and nothing is charged or opened.
    await submit.click();
    await expect(dialog.getByText('Please choose an amount')).toBeVisible({
      timeout: 5_000,
    });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /^Other amount$/ }).click();
    await expect(dialog.getByLabel(/^Amount \(USD\)$/)).toBeVisible();

    await dialog.getByRole('button', { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
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
  test('Billing tab opens via ?profileTab=billing and the Credits card mounts', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    await expect(billingPage.creditsSection).toBeVisible({
      timeout: 15_000,
    });
    const plan = await getBillingPlanLabel(page);
    expect(plan).not.toBeNull();
    expect(['Free', 'Trial']).toContain(plan);
  });

  // bill-11
  test('Billing tab Credits / Auto Recharge cards match the billing state', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    // Auto-detect dispatches into expectBillingTabFor{Standard,Trial}Plan. On
    // a plan the helper accepts hasPaymentMethod — leave it unspecified so it
    // only checks the always-on rows (Available / Add Credits / no Upgrade).
    const plan = await expectBillingTabForCurrentPlan(page);
    logger.info(`Verified Billing tab for the ${plan} state`);
  });

  // bill-12
  test('Billing tab Auto Recharge card is hidden on the free trial and shown on a plan with a card on file', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    await waitForBillingTabReady(page);
    const plan = await getBillingPlanLabel(page);

    if (plan === 'Trial') {
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
      logger.info('Auto Recharge card hidden — no payment method on file');
    }
  });

  // bill-13
  test('Billing tab Manage Usage opens the Manage Usage dialog with all expected controls', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    if (
      !(await billingPage.autoRechargeSection.isVisible().catch(() => false))
    ) {
      logger.info('Auto Recharge card absent — no payment method on file');
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
      logger.info('Auto Recharge card absent — no payment method on file');
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
      logger.info('Auto Recharge card absent — no payment method on file');
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
  test('Billing tab Add Credits button opens the Add Credits dialog (on a plan, with or without a card)', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    if ((await getBillingPlanLabel(page)) === 'Trial') {
      logger.info(
        'Free trial — Add Credits is not offered until a plan is chosen',
      );
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

  // bill-23
  test('Billing tab Credits card actions and sentence match the state (Upgrade on the trial; Change Plan + Add Credits on a plan)', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const plan = await getBillingPlanLabel(page);
    const description = await billingPage.getCreditsDescription();

    if (plan === 'Trial') {
      await expect(billingPage.upgradeButton).toBeVisible();
      await expect(billingPage.changePlanButton).toHaveCount(0);
      await expect(billingPage.addCreditsButton).toHaveCount(0);
      expect(description).toMatch(/^You're on a free trial/);
      return;
    }

    await expect(billingPage.upgradeButton).toHaveCount(0);
    await expect(billingPage.addCreditsButton).toBeVisible();
    expect(description).toMatch(
      /^You're on the .+ plan\. Add credits whenever you need more\./,
    );
    if ((await billingPage.changePlanButton.count()) > 0) {
      await expect(billingPage.changePlanButton).toBeVisible();
      logger.info(`Credits card: "${description}" — Change Plan offered`);
    } else {
      logger.info(
        `Credits card: "${description}" — plan not named, no Change Plan`,
      );
    }
  });

  // bill-24
  test('Billing tab Change Plan / Upgrade opens the plan picker in the matching mode; Close returns to the tab', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const plan = await getBillingPlanLabel(page);
    if (
      plan !== 'Trial' &&
      (await billingPage.changePlanButton.count()) === 0
    ) {
      logger.info('Change Plan not offered on this account — nothing to open');
      return;
    }

    await billingPage.openPlanPicker();
    const mode = await getPlanPickerMode(page);
    expect(mode).toBe(plan === 'Trial' ? 'choose' : 'change');
    if (mode === 'change') {
      await expectChangePlanPicker(page);
    } else {
      await expectTrialPlanPicker(page);
    }
    await billingPage.closePlanPicker();
    // The Billing tab stays open behind the picker.
    await expect(billingPage.creditsSection).toBeVisible();
  });
});

test.describe('Journey 21-C: Non-admin billing surfaces', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // bill-18
  test('a gated action for a non-admin never opens the admin billing path: New Agent runs, opens the plan picker (trial) or the contact-admin dialog', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const visible = await nonadminSidebarPage.newMentorButton
      .isVisible()
      .catch(() => false);
    if (!visible) {
      logger.info('New agent button hidden for non-admin — skipping');
      return;
    }
    await nonadminSidebarPage.newMentorButton.click();

    // What a non-admin may get: the "Choose Your Plan" picker (a free-trial
    // user on the main tenant), the contact-admin dialog (the organization
    // ran out of credits), or no gate at all.
    const picker = planPickerDialog(nonadminPage);
    const contactAdmin = nonadminPage.getByRole('dialog', {
      name: /Your organization has run out of credits/,
    });
    const gate = await Promise.race([
      picker
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => 'picker' as const),
      contactAdmin
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => 'contact-admin' as const),
    ]).catch(() => 'none' as const);

    if (gate === 'picker') {
      await expectTrialPlanPicker(nonadminPage);
      await closePlanPicker(nonadminPage);
    } else if (gate === 'contact-admin') {
      await expect(
        contactAdmin.getByRole('button', { name: /^Contact Now/ }),
      ).toBeVisible();
      await nonadminPage.keyboard.press('Escape');
      await expect(contactAdmin).toBeHidden({ timeout: 10_000 });
    } else {
      logger.info('New Agent was not gated for this non-admin');
      await nonadminPage.keyboard.press('Escape');
    }

    // Never the admin's next step.
    await expect(addCreditsDialog(nonadminPage)).toHaveCount(0);
    await expect(nonadminPage).not.toHaveURL(/profileTab=billing/);
  });

  // bill-25
  test('a non-admin who is not on the free trial has no credit balance trigger', async ({
    nonadminPage,
  }) => {
    const tenantKey = await nonadminPage.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('current_tenant');
        return raw ? (JSON.parse(raw).key as string | undefined) : undefined;
      } catch {
        return undefined;
      }
    });
    if (tenantKey === 'main') {
      // A main-tenant member without a workspace is on the free trial and
      // does get the credit icon (with Upgrade).
      await expect(creditBalanceTrigger(nonadminPage)).toBeVisible({
        timeout: 15_000,
      });
      logger.info('Non-admin is a free-trial user on the main tenant');
      return;
    }
    await expect(
      nonadminPage.getByRole('button', {
        name: 'Selected agent dropdown button',
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(creditBalanceTrigger(nonadminPage)).toHaveCount(0);
  });
});
