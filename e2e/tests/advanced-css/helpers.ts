import { expect, Page, Locator } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * Navigate to account settings and open the Advanced tab
 */
export async function navigateToAdvancedSettings(page: Page): Promise<Locator> {
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

  // Click on Advanced tab
  const advancedTab = accountDialog.getByRole('button', { name: 'Advanced' });
  await expect(advancedTab).toBeVisible({ timeout: 5000 });
  await advancedTab.click();

  // Wait for Advanced settings content to load
  await expect(accountDialog.getByText('Advanced CSS')).toBeVisible({
    timeout: 5000,
  });

  logger.info('Navigated to Advanced settings tab');
  return accountDialog;
}

/**
 * Close the account settings dialog
 */
export async function closeAccountDialog(
  page: Page,
  dialog: Locator
): Promise<void> {
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  await expect(closeButton).toBeVisible({ timeout: 5000 });
  await closeButton.click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  logger.info('Closed account settings dialog');
}

/**
 * Expand the Advanced CSS section
 */
export async function expandAdvancedCssSection(
  page: Page,
  dialog: Locator
): Promise<Locator> {
  // Check if the section is already expanded
  const collapseButton = dialog.getByRole('button', {
    name: 'Collapse Advanced CSS',
  });
  const isExpanded = await collapseButton.isVisible().catch(() => false);

  if (!isExpanded) {
    const expandButton = dialog.getByRole('button', {
      name: 'Expand Advanced CSS',
    });
    await expect(expandButton).toBeVisible({ timeout: 5000 });
    await expandButton.click();

    // Wait for the section to expand
    await expect(collapseButton).toBeVisible({ timeout: 5000 });
  }

  // Return the CSS textarea
  const cssTextarea = dialog.getByRole('textbox', { name: 'Custom CSS input' });
  await expect(cssTextarea).toBeVisible({ timeout: 5000 });

  logger.info('Expanded Advanced CSS section');
  return cssTextarea;
}

/**
 * Save the CSS and wait for the save operation to complete
 */
export async function saveCssAndWait(
  page: Page,
  dialog: Locator
): Promise<void> {
  const saveButton = dialog.getByRole('button', { name: 'Save advanced CSS' });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();

  // Wait for the save to complete (button becomes disabled)
  await expect(saveButton).toBeDisabled({ timeout: 15000 });
  logger.info('CSS saved successfully');
}

/**
 * Discard CSS changes
 */
export async function discardCssChanges(
  page: Page,
  dialog: Locator
): Promise<void> {
  const discardButton = dialog.getByRole('button', { name: 'Discard changes' });
  await expect(discardButton).toBeVisible({ timeout: 5000 });
  await discardButton.click();
  logger.info('CSS changes discarded');
}

/**
 * Test CSS value
 */
export const TEST_CSS = `form.chat-textarea button.chat-submit-message-button{background:red!important}`;
