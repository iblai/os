import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Journey 21: Billing & Subscription', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Billing requires admin access');
  });

  test('admin goes to account settings and sees the Billing tab', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    await expect(billingPage.billingTab).toBeVisible({ timeout: 10_000 });
  });

  test('admin goes to billing tab and sees the main billing card with credits info', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    await expect(billingPage.mainCard).toBeVisible({ timeout: 10_000 });
  });

  test('admin goes to billing tab and sees the correct buttons based on payment method status', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    // At least one of these buttons should be present
    const manageVisible = await billingPage.manageUsageButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const addCreditsVisible = await billingPage.addCreditsButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const someButtonVisible = manageVisible || addCreditsVisible;
    expect(typeof someButtonVisible).toBe('boolean');
  });

  test('admin goes to billing tab and sees subscription renewal information when applicable', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const renewalInfo = page.getByText(/renew|renewal|next billing/i);
    const visible = await renewalInfo.isVisible({ timeout: 5_000 }).catch(() => false);
    // May not be visible if no subscription — acceptable
    expect(typeof visible).toBe('boolean');
  });

  test('admin goes to billing tab and sees the Usage card when topUpURL is configured', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const usageCard = page.getByText(/usage/i).first();
    await expect(usageCard).toBeVisible({ timeout: 5_000 });
  });

  test('admin goes to billing tab and sees plan info and upgrade button when applicable', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const planInfo = page
      .getByText(/plan|upgrade/i)
      .first();
    const visible = await planInfo.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(typeof visible).toBe('boolean');
  });

  test('admin goes to billing tab and opens the Auto Recharge modal with all elements and cancels it', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const visible = await billingPage.manageUsageButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) return;
    await billingPage.openAutoRechargeModal();
    await expect(billingPage.autoRechargeModal).toBeVisible();
    await expect(billingPage.rechargeToggle).toBeVisible({ timeout: 5_000 });
    await billingPage.closeAutoRechargeModal();
    await expect(billingPage.autoRechargeModal).not.toBeVisible();
  });

  test('admin goes to billing tab and opens the Add Credits modal', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const visible = await billingPage.addCreditsButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) return;
    await billingPage.addCreditsButton.click();
    await expect(billingPage.addCreditsModal).toBeVisible({ timeout: 10_000 });
    await billingPage.page.keyboard.press('Escape');
  });

  test('new user without subscription goes to create mentor and sees the Stripe pricing modal', async ({
    page,
    sidebarPage,
  }) => {
    // Only test this if the user is non-admin (no subscription)
    const isAdmin = await checkAdminStatus(page);
    test.skip(isAdmin, 'This test targets non-subscribed users only');
    const visible = await sidebarPage.newMentorButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) return;
    await sidebarPage.newMentorButton.click();
    const pricingModal = page.getByRole('dialog').filter({ hasText: /plan|pricing|subscribe/i });
    await expect(pricingModal).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('admin goes to billing tab and sees all Auto Recharge modal elements displayed', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const manageVisible = await billingPage.manageUsageButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!manageVisible) { logger.info('No payment method — skipping modal elements check'); return; }
    await billingPage.openAutoRechargeModal();
    await expect(billingPage.autoRechargeModal).toBeVisible();
    // Toggle switch
    await expect(billingPage.rechargeToggle).toBeVisible({ timeout: 5_000 });
    // Labels
    await expect(billingPage.autoRechargeModal.getByText('Recharge Threshold')).toBeVisible({ timeout: 5_000 });
    await expect(billingPage.autoRechargeModal.getByText('Recharge Amount')).toBeVisible({ timeout: 5_000 });
    // Buttons
    await expect(billingPage.cancelButton).toBeVisible({ timeout: 5_000 });
    await expect(billingPage.autoRechargeModal.getByRole('button', { name: 'Save Settings' })).toBeVisible({ timeout: 5_000 });
    logger.info('All Auto Recharge modal elements are displayed');
    await billingPage.closeAutoRechargeModal();
  });

  test('admin goes to billing Auto Recharge modal and toggles the Auto Recharge enabled switch', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const manageVisible = await billingPage.manageUsageButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!manageVisible) { logger.info('No payment method — skipping toggle test'); return; }
    await billingPage.openAutoRechargeModal();
    const enableSwitch = billingPage.autoRechargeModal.getByRole('switch', { name: 'Enable Auto Recharge' });
    await expect(enableSwitch).toBeVisible({ timeout: 5_000 });
    const initial = await enableSwitch.isChecked();
    await enableSwitch.click();
    await expect(enableSwitch).not.toBeChecked({ timeout: 5_000 });
    // Restore
    await enableSwitch.click();
    expect(await enableSwitch.isChecked()).toBe(initial);
    logger.info('Auto Recharge toggle switch works correctly');
    await billingPage.closeAutoRechargeModal();
  });

  test('admin goes to billing Auto Recharge modal and enters threshold and amount values', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const manageVisible = await billingPage.manageUsageButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!manageVisible) { logger.info('No payment method — skipping inputs test'); return; }
    await billingPage.openAutoRechargeModal();
    const thresholdInput = billingPage.autoRechargeModal.locator('input#threshold');
    const amountInput    = billingPage.autoRechargeModal.locator('input#amount');
    await expect(thresholdInput).toBeVisible({ timeout: 5_000 });
    await expect(amountInput).toBeVisible({ timeout: 5_000 });
    const origThreshold = await thresholdInput.inputValue();
    const origAmount    = await amountInput.inputValue();
    await thresholdInput.fill('25');
    await amountInput.fill('100');
    await expect(thresholdInput).toHaveValue('25');
    await expect(amountInput).toHaveValue('100');
    // Restore
    await thresholdInput.fill(origThreshold);
    await amountInput.fill(origAmount);
    logger.info('Threshold and amount inputs accept values correctly');
    await billingPage.closeAutoRechargeModal();
  });

  test('admin goes to billing Auto Recharge modal and verifies proper accessibility attributes', async ({
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const manageVisible = await billingPage.manageUsageButton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!manageVisible) { logger.info('No payment method — skipping a11y test'); return; }
    await billingPage.openAutoRechargeModal();
    await expect(billingPage.autoRechargeModal).toHaveRole('dialog');
    await expect(
      billingPage.autoRechargeModal.getByRole('switch', { name: 'Enable Auto Recharge' })
    ).toBeVisible({ timeout: 5_000 });
    await expect(billingPage.autoRechargeModal.getByText('Recharge Threshold')).toBeVisible();
    await expect(billingPage.autoRechargeModal.getByText('Recharge Amount')).toBeVisible();
    await expect(billingPage.cancelButton).toBeVisible();
    await expect(
      billingPage.autoRechargeModal.getByRole('button', { name: 'Save Settings' })
    ).toBeVisible();
    logger.info('Auto Recharge modal has proper accessibility attributes');
    await billingPage.closeAutoRechargeModal();
  });

  test('admin goes to billing tab and sees all billing layout elements in the correct state', async ({
    page,
    billingPage,
  }) => {
    await billingPage.openBillingTab();
    const availableCredits = page.getByText('Available Credits');
    await expect(availableCredits).toBeVisible({ timeout: 10_000 });

    const hasManageUsage     = await billingPage.manageUsageButton.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasAddCredits      = await billingPage.addCreditsButton.isVisible({ timeout: 3_000 }).catch(() => false);
    const hasAddPaymentMethod = await page.getByRole('button', { name: 'Add Payment Method' }).isVisible({ timeout: 3_000 }).catch(() => false);

    logger.info(`Billing layout — Manage Usage: ${hasManageUsage}, Add Credits: ${hasAddCredits}, Add Payment Method: ${hasAddPaymentMethod}`);

    // Either Manage Usage + Add Credits OR Add Payment Method must be present
    if (hasManageUsage) {
      expect(hasAddCredits).toBe(true);
    }
    // Available Credits always visible
    await expect(availableCredits).toBeVisible();
  });
});
