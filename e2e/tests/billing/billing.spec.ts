import test, { expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import {
  navigateToBillingSettings,
  closeAccountDialog,
  openAutoRechargeModal,
  closeAutoRechargeModal,
  openAddCreditsModal,
  closeAddCreditsModal,
  verifyBillingMainCard,
  verifyBillingWithPaymentMethod,
  verifyBillingWithoutPaymentMethod,
  verifyAutoRechargeModalElements,
  hasPaymentMethod,
  hasSubscriptionRenewalInfo,
  verifySubscriptionRenewalInfo,
  hasUsageCard,
  verifyUsageCard,
  hasPlanInfo,
  hasUpgradeButton,
} from './helpers';
import { navigateToMentorApp } from '../profile/helpers';

test.describe('Billing Settings', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('should display Billing tab in account settings', async ({ page }) => {
    const dialog = await navigateToBillingSettings(page);

    // Verify billing tab is active
    const billingTab = dialog.getByRole('button', { name: 'Billing' });
    await expect(billingTab).toBeVisible({ timeout: 5000 });

    logger.info('Billing tab is visible in account settings');
    await closeAccountDialog(page, dialog);
  });

  test('should display billing main card with credits info', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    await verifyBillingMainCard(dialog);

    logger.info('Billing main card is displayed correctly');
    await closeAccountDialog(page, dialog);
  });

  test('should display correct buttons based on payment method status', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);

    if (userHasPaymentMethod) {
      // User has payment method - should see Manage Usage and Add Credits buttons
      await verifyBillingWithPaymentMethod(dialog);
      logger.info(
        'User has payment method - Manage Usage and Add Credits buttons are visible'
      );
    } else {
      // User has no payment method - should see Add Payment Method button
      await verifyBillingWithoutPaymentMethod(dialog);
      logger.info(
        'User has no payment method - Add Payment Method button is visible'
      );
    }

    await closeAccountDialog(page, dialog);
  });

  test('should display subscription renewal info when applicable', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const hasRenewalInfo = await hasSubscriptionRenewalInfo(dialog);

    if (hasRenewalInfo) {
      // User has active subscription with renewal date - verify dual-card layout
      await verifySubscriptionRenewalInfo(dialog);
      logger.info(
        'Subscription renewal info (Renews On) is displayed with Available Credits'
      );
    } else {
      // User doesn't have renewal info - single Available Credits card
      await expect(dialog.getByText('Available Credits')).toBeVisible({
        timeout: 5000,
      });
      logger.info(
        'Single Available Credits card is displayed (no renewal info)'
      );
    }

    await closeAccountDialog(page, dialog);
  });

  test('should display Usage card when topUpURL is configured', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const hasUsage = await hasUsageCard(dialog);

    if (hasUsage) {
      await verifyUsageCard(dialog);
      logger.info('Usage card is displayed (topUpURL is configured)');
    } else {
      logger.info('Usage card is not displayed (topUpURL not configured)');
    }

    await closeAccountDialog(page, dialog);
  });

  test('should display plan info and upgrade button when applicable', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const hasPlan = await hasPlanInfo(dialog);
    const hasUpgrade = await hasUpgradeButton(dialog);

    if (hasPlan) {
      await expect(dialog.getByText(/Plan$/i).first()).toBeVisible({
        timeout: 5000,
      });
      logger.info('Plan info is displayed');
    }

    if (hasUpgrade) {
      await expect(dialog.getByRole('button', { name: 'Upgrade' })).toBeVisible(
        { timeout: 5000 }
      );
      logger.info('Upgrade button is visible');
    }

    logger.info(`Plan info: ${hasPlan}, Upgrade button: ${hasUpgrade}`);
    await closeAccountDialog(page, dialog);
  });

  test('should open Auto Recharge modal when clicking Manage Usage button', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);
    if (!userHasPaymentMethod) {
      logger.info('Skipping test - user has no payment method');
      await closeAccountDialog(page, dialog);
      test.skip();
      return;
    }

    const autoRechargeModal = await openAutoRechargeModal(page, dialog);
    await expect(autoRechargeModal).toBeVisible({ timeout: 5000 });

    logger.info('Auto Recharge modal opens correctly');
    await closeAutoRechargeModal(page, autoRechargeModal);
    await closeAccountDialog(page, dialog);
  });

  test('should open Add Credits modal when clicking Add Credits button', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);
    if (!userHasPaymentMethod) {
      logger.info('Skipping test - user has no payment method');
      await closeAccountDialog(page, dialog);
      test.skip();
      return;
    }

    const addCreditsModal = await openAddCreditsModal(page, dialog);
    await expect(addCreditsModal).toBeVisible({ timeout: 5000 });

    logger.info('Add Credits modal opens correctly');
    await closeAddCreditsModal(page, addCreditsModal);
    await closeAccountDialog(page, dialog);
  });

  test('should display all Auto Recharge modal elements', async ({ page }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);
    if (!userHasPaymentMethod) {
      logger.info('Skipping test - user has no payment method');
      await closeAccountDialog(page, dialog);
      test.skip();
      return;
    }

    const autoRechargeModal = await openAutoRechargeModal(page, dialog);

    await verifyAutoRechargeModalElements(autoRechargeModal);

    logger.info('All Auto Recharge modal elements are displayed');
    await closeAutoRechargeModal(page, autoRechargeModal);
    await closeAccountDialog(page, dialog);
  });

  test('should close Auto Recharge modal when clicking Cancel', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);
    if (!userHasPaymentMethod) {
      logger.info('Skipping test - user has no payment method');
      await closeAccountDialog(page, dialog);
      test.skip();
      return;
    }

    const autoRechargeModal = await openAutoRechargeModal(page, dialog);

    // Click cancel button
    const cancelButton = autoRechargeModal.getByRole('button', {
      name: 'Cancel',
    });
    await cancelButton.click();

    // Verify modal is closed
    await expect(autoRechargeModal).not.toBeVisible({ timeout: 5000 });

    logger.info('Auto Recharge modal closes when clicking Cancel');
    await closeAccountDialog(page, dialog);
  });

  test('should toggle Auto Recharge enabled switch', async ({ page }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);
    if (!userHasPaymentMethod) {
      logger.info('Skipping test - user has no payment method');
      await closeAccountDialog(page, dialog);
      test.skip();
      return;
    }

    const autoRechargeModal = await openAutoRechargeModal(page, dialog);

    const enableSwitch = autoRechargeModal.getByRole('switch', {
      name: 'Enable Auto Recharge',
    });
    await expect(enableSwitch).toBeVisible({ timeout: 5000 });

    // Get initial state
    const initialState = await enableSwitch.isChecked();

    // Toggle the switch
    await enableSwitch.click();

    // Verify the state changed
    const newState = await enableSwitch.isChecked();
    expect(newState).toBe(!initialState);

    // Toggle back to original state
    await enableSwitch.click();
    const restoredState = await enableSwitch.isChecked();
    expect(restoredState).toBe(initialState);

    logger.info('Auto Recharge toggle switch works correctly');

    await closeAutoRechargeModal(page, autoRechargeModal);
    await closeAccountDialog(page, dialog);
  });

  test('should allow entering threshold and amount values', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);
    if (!userHasPaymentMethod) {
      logger.info('Skipping test - user has no payment method');
      await closeAccountDialog(page, dialog);
      test.skip();
      return;
    }

    const autoRechargeModal = await openAutoRechargeModal(page, dialog);

    // Get initial values
    const thresholdInput = autoRechargeModal.locator('input#threshold');
    const amountInput = autoRechargeModal.locator('input#amount');

    await expect(thresholdInput).toBeVisible({ timeout: 5000 });
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    const initialThreshold = await thresholdInput.inputValue();
    const initialAmount = await amountInput.inputValue();

    // Enter new values
    await thresholdInput.clear();
    await thresholdInput.fill('25');
    await amountInput.clear();
    await amountInput.fill('100');

    // Verify new values
    await expect(thresholdInput).toHaveValue('25');
    await expect(amountInput).toHaveValue('100');

    // Restore initial values
    await thresholdInput.clear();
    await thresholdInput.fill(initialThreshold);
    await amountInput.clear();
    await amountInput.fill(initialAmount);

    logger.info('Threshold and amount inputs accept values correctly');
    await closeAutoRechargeModal(page, autoRechargeModal);
    await closeAccountDialog(page, dialog);
  });

  test('should have proper accessibility attributes in Auto Recharge modal', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    const userHasPaymentMethod = await hasPaymentMethod(dialog);
    if (!userHasPaymentMethod) {
      logger.info('Skipping test - user has no payment method');
      await closeAccountDialog(page, dialog);
      test.skip();
      return;
    }

    const autoRechargeModal = await openAutoRechargeModal(page, dialog);

    // Verify dialog has proper role
    await expect(autoRechargeModal).toHaveRole('dialog');

    // Verify switch has proper label
    const enableSwitch = autoRechargeModal.getByRole('switch', {
      name: 'Enable Auto Recharge',
    });
    await expect(enableSwitch).toBeVisible({ timeout: 5000 });

    // Verify inputs have labels
    const thresholdLabel = autoRechargeModal.getByText('Recharge Threshold');
    await expect(thresholdLabel).toBeVisible({ timeout: 5000 });

    const amountLabel = autoRechargeModal.getByText('Recharge Amount');
    await expect(amountLabel).toBeVisible({ timeout: 5000 });

    // Verify buttons have proper names
    await expect(
      autoRechargeModal.getByRole('button', { name: 'Cancel' })
    ).toBeVisible();
    await expect(
      autoRechargeModal.getByRole('button', { name: 'Save Settings' })
    ).toBeVisible();

    logger.info('Auto Recharge modal has proper accessibility attributes');
    await closeAutoRechargeModal(page, autoRechargeModal);
    await closeAccountDialog(page, dialog);
  });

  test('should display all billing layout elements correctly', async ({
    page,
  }) => {
    const dialog = await navigateToBillingSettings(page);

    // Check for all possible layout states and log what's visible
    const renewsOnText = dialog.getByText('Renews On');
    const availableCreditsText = dialog.getByText('Available Credits');
    const planText = dialog.getByText(/Plan$/);
    const usageTitle = dialog.getByRole('heading', { name: 'Usage' });
    const manageUsageBtn = dialog.getByRole('button', { name: 'Manage Usage' });
    const addCreditsBtn = dialog.getByRole('button', { name: 'Add Credits' });
    const addPaymentMethodBtn = dialog.getByRole('button', {
      name: 'Add Payment Method',
    });
    const upgradeBtn = dialog.getByRole('button', { name: 'Upgrade' });

    const hasRenewsOn = await renewsOnText.isVisible().catch(() => false);
    const hasCredits = await availableCreditsText
      .isVisible()
      .catch(() => false);
    const hasPlan = await planText
      .first()
      .isVisible()
      .catch(() => false);
    const hasUsage = await usageTitle.isVisible().catch(() => false);
    const hasManageUsage = await manageUsageBtn.isVisible().catch(() => false);
    const hasAddCredits = await addCreditsBtn
      .first()
      .isVisible()
      .catch(() => false);
    const hasAddPaymentMethod = await addPaymentMethodBtn
      .isVisible()
      .catch(() => false);
    const hasUpgrade = await upgradeBtn.isVisible().catch(() => false);

    logger.info(`Billing layout state:
      - Renews On: ${hasRenewsOn}
      - Available Credits: ${hasCredits}
      - Plan info: ${hasPlan}
      - Usage card: ${hasUsage}
      - Manage Usage button: ${hasManageUsage}
      - Add Credits button: ${hasAddCredits}
      - Add Payment Method button: ${hasAddPaymentMethod}
      - Upgrade button: ${hasUpgrade}
    `);

    // Available Credits should always be visible
    expect(hasCredits).toBe(true);

    // Either Manage Usage + Add Credits OR Add Payment Method should be visible (mutually exclusive)
    if (hasManageUsage) {
      expect(hasAddCredits).toBe(true);
      expect(hasAddPaymentMethod).toBe(false);
    } else if (hasAddPaymentMethod) {
      expect(hasManageUsage).toBe(false);
    }

    await closeAccountDialog(page, dialog);
  });
});
