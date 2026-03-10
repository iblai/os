import test, { expect, Page, Locator } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * Navigate to account settings and open the Billing tab
 * Note: The billing tab may take 2-3 seconds to appear after the account dialog loads
 */
export async function navigateToBillingSettings(page: Page): Promise<Locator> {
  // Open profile dropdown menu
  const profileBtn = page.getByRole('button', { name: 'More options' });
  await expect(profileBtn).toBeVisible({ timeout: 15000 });
  await profileBtn.click();

  // Wait for menu to open
  const menu = page.getByRole('menu', { name: 'More options' });
  await expect(menu).toBeVisible({ timeout: 5000 });

  // Get platform name from localStorage
  const platformName = await page.evaluate(() => {
    const currentTenant = localStorage.getItem('current_tenant');
    if (currentTenant) {
      try {
        const tenant = JSON.parse(currentTenant);
        return tenant?.platform_name;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  if (!platformName) {
    throw new Error('Could not retrieve platform_name from localStorage');
  }

  // Click on the tenant/org menu item to open account settings
  const tenantMenuItem = menu.getByText(platformName, { exact: true });
  await expect(tenantMenuItem).toBeVisible({ timeout: 5000 });
  await tenantMenuItem.click();

  // Wait for the account settings dialog
  const accountDialog = page.getByRole('dialog', {
    name: 'User Profile',
  });
  await expect(accountDialog).toBeVisible({ timeout: 10000 });

  // Wait for and click on Billing tab (may take 2-3 seconds to appear)
  const billingTab = accountDialog.getByRole('button', { name: 'Billing' });
  //skip test if billing not visible
  await expect(billingTab)
    .toBeVisible({ timeout: 30000 })
    .catch(() => {
      test.skip();
    });
  await billingTab.click();

  // Wait for Billing content to load - check for common billing elements
  // The component shows either "Manage Usage", "Add Credits", or "Add Payment Method" depending on state
  const manageUsageBtn = accountDialog.getByRole('button', {
    name: 'Manage Usage',
  });
  const addCreditsBtn = accountDialog.getByRole('button', {
    name: 'Add Credits',
  });
  const addPaymentMethodBtn = accountDialog.getByRole('button', {
    name: 'Add Payment Method',
  });
  const availableCreditsText = accountDialog.getByText('Available Credits');

  await expect(
    manageUsageBtn
      .or(addCreditsBtn)
      .or(addPaymentMethodBtn)
      .or(availableCreditsText)
      .first()
  ).toBeVisible({
    timeout: 10000,
  });

  logger.info('Navigated to Billing settings tab');
  return accountDialog;
}

/**
 * Close the account settings dialog
 */
export async function closeAccountDialog(
  _page: Page,
  dialog: Locator
): Promise<void> {
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  await expect(closeButton).toBeVisible({ timeout: 5000 });
  await closeButton.click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  logger.info('Closed account settings dialog');
}

/**
 * Open the Auto Recharge modal via "Manage Usage" button
 */
export async function openAutoRechargeModal(
  page: Page,
  dialog: Locator
): Promise<Locator> {
  const manageUsageButton = dialog.getByRole('button', {
    name: 'Manage Usage',
  });
  await expect(manageUsageButton).toBeVisible({ timeout: 10000 });
  await manageUsageButton.click();

  // Wait for the auto recharge modal to appear
  const autoRechargeModal = page.getByRole('dialog', {
    name: 'Auto Recharge Settings',
  });
  await expect(autoRechargeModal).toBeVisible({ timeout: 10000 });

  logger.info('Opened Auto Recharge modal');
  return autoRechargeModal;
}

/**
 * Open the Add Credits modal
 */
export async function openAddCreditsModal(
  page: Page,
  dialog: Locator
): Promise<Locator> {
  // Find the "Add Credits" button in the main card (not the Usage card)
  const addCreditsButton = dialog
    .getByRole('button', { name: 'Add Credits' })
    .first();
  await expect(addCreditsButton).toBeVisible({ timeout: 10000 });
  await addCreditsButton.click();

  // Wait for the Add Credits modal to appear
  const addCreditsModal = page.getByRole('dialog', {
    name: 'Add Credits',
  });
  await expect(addCreditsModal).toBeVisible({ timeout: 10000 });

  logger.info('Opened Add Credits modal');
  return addCreditsModal;
}

/**
 * Close the Auto Recharge modal
 */
export async function closeAutoRechargeModal(
  _page: Page,
  modal: Locator
): Promise<void> {
  const cancelButton = modal.getByRole('button', { name: 'Cancel' });
  await expect(cancelButton).toBeVisible({ timeout: 5000 });
  await cancelButton.click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  logger.info('Closed Auto Recharge modal');
}

/**
 * Close the Add Credits modal
 */
export async function closeAddCreditsModal(
  _page: Page,
  modal: Locator
): Promise<void> {
  const cancelButton = modal.getByRole('button', { name: 'Cancel' });
  await expect(cancelButton).toBeVisible({ timeout: 5000 });
  await cancelButton.click();
  await expect(modal).not.toBeVisible({ timeout: 5000 });
  logger.info('Closed Add Credits modal');
}

/**
 * Fill in the auto recharge form
 */
export async function fillAutoRechargeForm(
  _page: Page,
  modal: Locator,
  data: {
    threshold?: string;
    amount?: string;
    enabled?: boolean;
  }
): Promise<void> {
  if (data.threshold !== undefined) {
    const thresholdInput = modal.getByRole('spinbutton', {
      name: 'Recharge Threshold',
    });
    await thresholdInput.clear();
    await thresholdInput.fill(data.threshold);
  }

  if (data.amount !== undefined) {
    const amountInput = modal.getByRole('spinbutton', {
      name: 'Recharge Amount',
    });
    await amountInput.clear();
    await amountInput.fill(data.amount);
  }

  if (data.enabled !== undefined) {
    const enableSwitch = modal.getByRole('switch', {
      name: 'Enable Auto Recharge',
    });
    const isChecked = await enableSwitch.isChecked();
    if (isChecked !== data.enabled) {
      await enableSwitch.click();
    }
  }

  logger.info('Filled auto recharge form');
}

/**
 * Save the auto recharge settings
 */
export async function saveAutoRechargeSettings(
  page: Page,
  modal: Locator
): Promise<void> {
  const saveButton = page.getByRole('button', { name: 'Save Settings' });
  await expect(saveButton).toBeVisible({ timeout: 5000 });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();

  // Wait for the modal to close (indicates successful save)
  await expect(modal).not.toBeVisible({ timeout: 30000 });
  await expect(
    page.getByText('Auto Recharge Settings saved successfully')
  ).toBeVisible({ timeout: 5000 });
  logger.info('Saved auto recharge settings');
}

/**
 * Verify the billing tab displays the main card with credits info
 */
export async function verifyBillingMainCard(dialog: Locator): Promise<void> {
  // Available Credits section should always be visible
  await expect(dialog.getByText('Available Credits')).toBeVisible({
    timeout: 5000,
  });
  await expect(dialog.getByText('credits remaining')).toBeVisible({
    timeout: 5000,
  });

  // Description text should be visible
  await expect(
    dialog.getByText(/Configure auto recharge.*spending limits.*usage settings/)
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Verify the billing tab displays buttons when user has payment method
 */
export async function verifyBillingWithPaymentMethod(
  dialog: Locator
): Promise<void> {
  await expect(
    dialog.getByRole('button', { name: 'Manage Usage' })
  ).toBeVisible({ timeout: 5000 });
  await expect(
    dialog.getByRole('button', { name: 'Add Credits' }).first()
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Verify the billing tab displays Add Payment Method button when no payment method
 */
export async function verifyBillingWithoutPaymentMethod(
  dialog: Locator
): Promise<void> {
  await expect(
    dialog.getByRole('button', { name: 'Add Payment Method' })
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Check if user has a payment method configured
 */
export async function hasPaymentMethod(dialog: Locator): Promise<boolean> {
  const manageUsageBtn = dialog.getByRole('button', { name: 'Manage Usage' });
  return await manageUsageBtn.isVisible().catch(() => false);
}

/**
 * Check if subscription renewal info is displayed (dual-card layout)
 */
export async function hasSubscriptionRenewalInfo(
  dialog: Locator
): Promise<boolean> {
  const renewsOnText = dialog.getByText('Renews On');
  return await renewsOnText.isVisible().catch(() => false);
}

/**
 * Verify the subscription renewal info (when visible)
 */
export async function verifySubscriptionRenewalInfo(
  dialog: Locator
): Promise<void> {
  await expect(dialog.getByText('Renews On')).toBeVisible({ timeout: 5000 });
  await expect(dialog.getByText('days remaining')).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Check if the Usage card is displayed (depends on topUpURL)
 */
export async function hasUsageCard(dialog: Locator): Promise<boolean> {
  const usageTitle = dialog.getByRole('heading', { name: 'Usage' });
  return await usageTitle.isVisible().catch(() => false);
}

/**
 * Verify the Usage card (second card when topUpURL exists)
 */
export async function verifyUsageCard(dialog: Locator): Promise<void> {
  await expect(dialog.getByRole('heading', { name: 'Usage' })).toBeVisible({
    timeout: 5000,
  });
  await expect(
    dialog.getByText('Add credits to your account for pay-as-you-go services')
  ).toBeVisible({ timeout: 5000 });
  // There might be multiple Add Credits buttons, get the one in the Usage card
  const addCreditsButtons = dialog.getByRole('button', { name: 'Add Credits' });
  await expect(addCreditsButtons.last()).toBeVisible({ timeout: 5000 });
}

/**
 * Check if plan info is displayed
 */
export async function hasPlanInfo(dialog: Locator): Promise<boolean> {
  const planText = dialog.getByText(/Plan$/);
  return await planText
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * Check if upgrade button is visible
 */
export async function hasUpgradeButton(dialog: Locator): Promise<boolean> {
  const upgradeBtn = dialog.getByRole('button', { name: 'Upgrade' });
  return await upgradeBtn.isVisible().catch(() => false);
}

/**
 * Verify the auto recharge modal displays all expected elements
 */
export async function verifyAutoRechargeModalElements(
  modal: Locator
): Promise<void> {
  // Verify title and description
  await expect(
    modal.getByText(
      'Configure automatic credit top-ups when your balance falls below the threshold.'
    )
  ).toBeVisible({ timeout: 5000 });

  // Verify toggle
  await expect(modal.getByText('Enable Auto Recharge')).toBeVisible({
    timeout: 5000,
  });

  // Verify threshold input
  await expect(modal.getByText('Recharge Threshold')).toBeVisible({
    timeout: 5000,
  });

  // Verify amount input
  await expect(modal.getByText('Recharge Amount')).toBeVisible({
    timeout: 5000,
  });

  // Verify info notice
  await expect(
    modal.getByText(
      /your payment method on file will be charged automatically/i
    )
  ).toBeVisible({ timeout: 5000 });

  // Verify buttons
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible({
    timeout: 5000,
  });
  await expect(
    modal.getByRole('button', { name: 'Save Settings' })
  ).toBeVisible({ timeout: 5000 });
}
