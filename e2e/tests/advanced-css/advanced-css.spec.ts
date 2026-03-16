import test, { expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import {
  navigateToAdvancedSettings,
  closeAccountDialog,
  expandAdvancedCssSection,
  saveCssAndWait,
  discardCssChanges,
  TEST_CSS,
} from './helpers';
import { navigateToMentorApp } from '../profile/helpers';

test.describe('Advanced CSS Settings', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('should display Advanced CSS section in Advanced settings tab', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);

    // Verify Advanced CSS region exists
    const advancedCssRegion = dialog
      .getByRole('region', { name: 'Advanced CSS' })
      .first();
    await expect(advancedCssRegion).toBeVisible({ timeout: 5000 });

    // Verify expand button exists
    const expandButton = dialog.getByRole('button', {
      name: /Expand Advanced CSS|Collapse Advanced CSS/,
    });
    await expect(expandButton).toBeVisible({ timeout: 5000 });

    logger.info('Advanced CSS section is visible in Advanced settings');
    await closeAccountDialog(page, dialog);
  });

  test('should expand and collapse Advanced CSS section', async ({ page }) => {
    const dialog = await navigateToAdvancedSettings(page);

    // Expand the section
    const expandButton = dialog.getByRole('button', {
      name: 'Expand Advanced CSS',
    });
    const isCollapsed = await expandButton.isVisible().catch(() => false);

    if (isCollapsed) {
      await expandButton.click();

      // Verify it's expanded
      const collapseButton = dialog.getByRole('button', {
        name: 'Collapse Advanced CSS',
      });
      await expect(collapseButton).toBeVisible({ timeout: 5000 });
      await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

      // Verify textarea is visible
      const cssTextarea = dialog.getByRole('textbox', {
        name: 'Custom CSS input',
      });
      await expect(cssTextarea).toBeVisible({ timeout: 5000 });

      // Collapse the section
      await collapseButton.click();
      await expect(expandButton).toBeVisible({ timeout: 5000 });

      logger.info('Advanced CSS section expand/collapse works correctly');
    }

    await closeAccountDialog(page, dialog);
  });

  test('should show Save button disabled when no changes', async ({ page }) => {
    const dialog = await navigateToAdvancedSettings(page);
    await expandAdvancedCssSection(page, dialog);

    // Save button should be disabled if no changes
    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // Without making changes, save button should be disabled
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    logger.info('Save button is correctly disabled when no changes');
    await closeAccountDialog(page, dialog);
  });

  test('should enable Save and Discard buttons when CSS is modified', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    // Get current CSS value
    const originalValue = await cssTextarea.inputValue();

    if (originalValue === TEST_CSS) {
      //First, clear the CSS
      await cssTextarea.fill('');
      await saveCssAndWait(page, dialog);
    }
    // Make a change
    await cssTextarea.fill(TEST_CSS);

    // Save button should be enabled now
    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // Discard button should also appear
    const discardButton = dialog.getByRole('button', {
      name: 'Discard changes',
    });
    await expect(discardButton).toBeVisible({ timeout: 5000 });

    logger.info('Save and Discard buttons appear when CSS is modified');

    // Restore original value
    await cssTextarea.fill(originalValue);
    await closeAccountDialog(page, dialog);
  });

  test('should discard CSS changes when clicking Discard button', async ({
    page,
  }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    // Get original CSS value
    const originalValue = await cssTextarea.inputValue();

    if (originalValue === TEST_CSS) {
      //First, clear the CSS
      await cssTextarea.fill('');
      await saveCssAndWait(page, dialog);
    }
    // Enter test CSS
    await cssTextarea.fill(TEST_CSS);

    // Click discard button
    await discardCssChanges(page, dialog);

    // Verify the CSS was reverted to original
    const revertedValue = await cssTextarea.inputValue();
    expect(revertedValue).toBe(originalValue);

    // Save button should be disabled again
    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    logger.info('CSS changes discarded successfully');
    await closeAccountDialog(page, dialog);
  });

  test('should show CSS validation status for valid CSS', async ({ page }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    // Get original value
    const originalValue = await cssTextarea.inputValue();

    if (originalValue === TEST_CSS) {
      //First, clear the CSS
      await cssTextarea.fill('');
      await saveCssAndWait(page, dialog);
    }
    // Enter valid CSS
    await cssTextarea.fill(TEST_CSS);

    // Verify Save button is enabled (indicates valid CSS) instead of arbitrary wait
    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // The CSS validation status should show as valid
    // Check that there's no error message visible
    const errorMessage = dialog.getByText('CSS validation errors');
    const hasError = await errorMessage.isVisible().catch(() => false);
    expect(hasError).toBe(false);

    logger.info('Valid CSS passes validation');

    // Cleanup
    await cssTextarea.fill(originalValue);
    await closeAccountDialog(page, dialog);
  });

  test('should show validation error for invalid CSS', async ({ page }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    // Get original value
    const originalValue = await cssTextarea.inputValue();

    // Enter invalid CSS (missing closing brace)
    const invalidCss = `body {
  background-color: red !important;`;

    await cssTextarea.fill(invalidCss);

    // The CSS validation status should show an error (state-based wait)
    const errorMessage = dialog
      .getByText(/CSS validation errors|Missing.*closing brace/i)
      .first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Save button should be disabled for invalid CSS
    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeDisabled({ timeout: 5000 });

    logger.info('Invalid CSS shows validation error');

    // Cleanup
    await cssTextarea.fill(originalValue);
    await closeAccountDialog(page, dialog);
  });

  // advanced css isnt visible in the advanced settings dialog for mentor nextjs
  //Thats why this test was skipped

  test.skip('should clear CSS and return to default UI', async ({ page }) => {
    const dialog = await navigateToAdvancedSettings(page);
    const cssTextarea = await expandAdvancedCssSection(page, dialog);

    // Get original value for later restoration if needed
    const originalValue = await cssTextarea.inputValue();

    if (originalValue === TEST_CSS) {
      //First, clear the CSS
      await cssTextarea.fill('');
      await saveCssAndWait(page, dialog);
    }

    // First, add some CSS
    await cssTextarea.fill(TEST_CSS);
    await saveCssAndWait(page, dialog);
    await closeAccountDialog(page, dialog);

    // Wait for CSS to apply
    await page.waitForTimeout(1000);

    // Reopen settings and clear the CSS
    const dialogForClear = await navigateToAdvancedSettings(page);
    const cssTextareaForClear = await expandAdvancedCssSection(
      page,
      dialogForClear
    );

    // Clear the CSS
    await cssTextareaForClear.fill('');
    await saveCssAndWait(page, dialogForClear);

    logger.info('CSS cleared successfully');
    await closeAccountDialog(page, dialogForClear);
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    const dialog = await navigateToAdvancedSettings(page);

    // Verify the Advanced CSS region has proper accessibility
    const advancedCssRegion = dialog
      .getByRole('region', { name: 'Advanced CSS' })
      .first();
    await expect(advancedCssRegion).toBeVisible({ timeout: 5000 });

    // Expand the section
    await expandAdvancedCssSection(page, dialog);

    // Verify textarea has proper accessibility label
    const cssTextarea = dialog.getByRole('textbox', {
      name: 'Custom CSS input',
    });
    await expect(cssTextarea).toBeVisible({ timeout: 5000 });

    // Verify save button has proper accessibility label
    const saveButton = dialog.getByRole('button', {
      name: 'Save advanced CSS',
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // Verify info tooltip button exists
    const infoButton = dialog.getByRole('button', {
      name: 'More info about Advanced CSS',
    });
    await expect(infoButton).toBeVisible({ timeout: 5000 });

    logger.info('Advanced CSS section has proper accessibility attributes');
    await closeAccountDialog(page, dialog);
  });
});
