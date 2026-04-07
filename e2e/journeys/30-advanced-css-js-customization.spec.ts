import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { logger } from '@iblai/iblai-js/playwright';
import AxeBuilder from '@axe-core/playwright';
import type { Page, Locator } from '@playwright/test';

const TEST_CSS =
  'form.chat-textarea button.chat-submit-message-button{background:red!important}';

/**
 * Navigate to Account Settings → Advanced tab → returns the account dialog locator.
 * This is NOT the Edit Mentor dialog — it's the User Profile / Account dialog
 * accessed via More Options → platform name.
 */
async function navigateToAdvancedSettings(page: Page): Promise<Locator> {
  const profileBtn = page.getByRole('button', { name: 'More options' });
  await expect(profileBtn).toBeVisible({ timeout: 15_000 });
  await profileBtn.click();

  const menu = page.getByRole('menu', { name: 'More options' });
  await expect(menu).toBeVisible({ timeout: 5_000 });

  // Read the platform name from localStorage to find the correct menu item
  const platformName = await page.evaluate(() => {
    const raw = localStorage.getItem('current_tenant');
    if (!raw) return null;
    try {
      return JSON.parse(raw)?.platform_name ?? null;
    } catch {
      return null;
    }
  });

  if (!platformName) {
    throw new Error(
      'Could not retrieve platform_name from localStorage — cannot navigate to account settings',
    );
  }

  const tenantMenuItem = menu.getByText(platformName, { exact: true });
  await expect(tenantMenuItem).toBeVisible({ timeout: 5_000 });
  await tenantMenuItem.click();

  const accountDialog = page.getByRole('dialog', { name: 'User Profile' });
  await expect(accountDialog).toBeVisible({ timeout: 10_000 });

  const advancedTab = accountDialog.getByRole('button', { name: 'Advanced' });
  await expect(advancedTab).toBeVisible({ timeout: 5_000 });
  await advancedTab.click();

  await expect(accountDialog.getByText('Advanced CSS')).toBeVisible({
    timeout: 5_000,
  });

  return accountDialog;
}

/**
 * Expand the Advanced CSS section and return the CSS textarea locator.
 */
async function expandAdvancedCssSection(
  page: Page,
  dialog: Locator,
): Promise<Locator> {
  const collapseButton = dialog.getByRole('button', {
    name: 'Collapse Advanced CSS',
  });
  const isExpanded = await collapseButton.isVisible().catch(() => false);

  if (!isExpanded) {
    const expandButton = dialog.getByRole('button', {
      name: 'Expand Advanced CSS',
    });
    await expect(expandButton).toBeVisible({ timeout: 5_000 });
    await expandButton.click();
    await expect(collapseButton).toBeVisible({ timeout: 5_000 });
  }

  const cssTextarea = dialog.getByRole('textbox', {
    name: 'Custom CSS input',
  });
  await expect(cssTextarea).toBeVisible({ timeout: 5_000 });
  return cssTextarea;
}

/**
 * Save CSS and wait for save to complete (button becomes disabled).
 */
async function saveCssAndWait(page: Page, dialog: Locator): Promise<void> {
  const saveButton = dialog.getByRole('button', {
    name: 'Save advanced CSS',
  });
  await expect(saveButton).toBeVisible();
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();
  await expect(saveButton).toBeDisabled({ timeout: 15_000 });
}

/**
 * Close the account settings dialog.
 */
async function closeAccountDialog(page: Page, dialog: Locator): Promise<void> {
  const closeButton = dialog.getByRole('button', { name: 'Close' });
  await expect(closeButton).toBeVisible({ timeout: 5_000 });
  await closeButton.click();
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });
}

test.describe('Journey 30: Advanced CSS / JS Customization', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Advanced CSS/JS requires admin access');
      return;
    }
  });

  test('admin goes to advanced settings tab and sees the Advanced CSS section', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);

    const advancedCssRegion = dialog
      .getByRole('region', { name: 'Advanced CSS' })
      .first();
    await expect(advancedCssRegion).toBeVisible({ timeout: 5_000 });

    const expandButton = dialog.getByRole('button', {
      name: /Expand Advanced CSS|Collapse Advanced CSS/,
    });
    await expect(expandButton).toBeVisible({ timeout: 5_000 });

    logger.info('Advanced CSS section is visible in Advanced settings');
    await closeAccountDialog(page, dialog);
  });

  test('admin goes to advanced settings and can expand and collapse the Advanced CSS section', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);

    const expandButton = dialog.getByRole('button', {
      name: 'Expand Advanced CSS',
    });
    const isCollapsed = await expandButton.isVisible().catch(() => false);

    if (isCollapsed) {
      await expandButton.click();

      const collapseButton = dialog.getByRole('button', {
        name: 'Collapse Advanced CSS',
      });
      await expect(collapseButton).toBeVisible({ timeout: 5_000 });
      await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

      const cssTextarea = dialog.getByRole('textbox', {
        name: 'Custom CSS input',
      });
      await expect(cssTextarea).toBeVisible({ timeout: 5_000 });

      await collapseButton.click();
      await expect(expandButton).toBeVisible({ timeout: 5_000 });

      logger.info('Advanced CSS section expand/collapse works correctly');
    }

    await closeAccountDialog(page, dialog);
  });

  test('admin goes to Advanced CSS editor and the Save button is disabled when no changes are made', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);
    await expandAdvancedCssSection(page, dialog);

    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });

    logger.info('Save button is correctly disabled when no changes');
    await closeAccountDialog(page, dialog);
  });

  test('admin goes to Advanced CSS editor and modifies CSS which enables the Save and Discard buttons', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    const originalValue = await cssTextarea.inputValue();

    if (originalValue === TEST_CSS) {
      await cssTextarea.fill('');
      await saveCssAndWait(page, dialog);
    }

    await cssTextarea.fill(TEST_CSS);

    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });

    const discardButton = dialog.getByRole('button', {
      name: 'Discard changes',
    });
    await expect(discardButton).toBeVisible({ timeout: 5_000 });

    logger.info('Save and Discard buttons appear when CSS is modified');

    // Restore original value
    await cssTextarea.fill(originalValue);
    await closeAccountDialog(page, dialog);
  });

  test('admin goes to Advanced CSS editor and discards changes to restore the previous value', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    const originalValue = await cssTextarea.inputValue();

    if (originalValue === TEST_CSS) {
      await cssTextarea.fill('');
      await saveCssAndWait(page, dialog);
    }

    await cssTextarea.fill(TEST_CSS);

    const discardButton = dialog.getByRole('button', {
      name: 'Discard changes',
    });
    await expect(discardButton).toBeVisible({ timeout: 5_000 });
    await discardButton.click();

    const revertedValue = await cssTextarea.inputValue();
    expect(revertedValue).toBe(originalValue);

    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });

    logger.info('CSS changes discarded successfully');
    await closeAccountDialog(page, dialog);
  });

  test('admin goes to Advanced CSS editor and valid CSS shows a success validation status', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    const originalValue = await cssTextarea.inputValue();

    if (originalValue === TEST_CSS) {
      await cssTextarea.fill('');
      await saveCssAndWait(page, dialog);
    }

    await cssTextarea.fill(TEST_CSS);

    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });

    // No CSS validation errors should be visible
    const errorMessage = dialog.getByText('CSS validation errors');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(false);

    logger.info('Valid CSS passes validation');

    await cssTextarea.fill(originalValue);
    await closeAccountDialog(page, dialog);
  });

  test('admin goes to Advanced CSS editor and invalid CSS shows a validation error', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    const originalValue = await cssTextarea.inputValue();

    const invalidCss = `body {
  background-color: red !important;`;

    await cssTextarea.fill(invalidCss);

    const errorMessage = dialog
      .getByText(/CSS validation errors|Missing.*closing brace/i)
      .first();
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });

    logger.info('Invalid CSS shows validation error');

    await cssTextarea.fill(originalValue);
    await closeAccountDialog(page, dialog);
  });

  test('admin goes to Advanced CSS section and verifies it has proper accessibility attributes', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);

    const advancedCssRegion = dialog
      .getByRole('region', { name: 'Advanced CSS' })
      .first();
    await expect(advancedCssRegion).toBeVisible({ timeout: 5_000 });

    await expandAdvancedCssSection(page, dialog);

    const cssTextarea = dialog.getByRole('textbox', {
      name: 'Custom CSS input',
    });
    await expect(cssTextarea).toBeVisible({ timeout: 5_000 });

    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeVisible({ timeout: 5_000 });

    const infoButton = dialog.getByRole('button', {
      name: 'More info about Advanced CSS',
    });
    await expect(infoButton).toBeVisible({ timeout: 5_000 });

    logger.info('Advanced CSS section has proper accessibility attributes');
    await closeAccountDialog(page, dialog);
  });
});
