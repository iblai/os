import { test, expect } from '@playwright/test';
import { checkAdminStatus } from '../utils';
import { navigateToMentorApp } from '../profile/helpers';
import {
  navigateToSettingsTab,
  closeSettingsDialog,
  SETTINGS_TOOLTIP_TRIGGERS,
  createMentorUpdateSpy,
} from './helpers';

/**
 * Regression test for: Clicking tooltip info icons in the Settings tab
 * should NOT trigger form submission (the editMentor API call).
 *
 * Root cause: Radix UI's TooltipTrigger renders a <button>. Inside a
 * <form>, a button without an explicit `type` attribute defaults to
 * type="submit", which triggers form submission on click.
 *
 * Fix: Every TooltipTrigger now has type="button".
 */
test.describe('Settings Tab - Tooltips', () => {
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('tooltip info icons have type="button" and do not submit the form', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip();
      return;
    }

    // Open the Edit Mentor dialog on the Settings tab
    const dialog = await navigateToSettingsTab(page);

    // Record the mentor name so we can verify nothing changed
    const nameInput = dialog.getByPlaceholder('Mentor Name');
    const originalName = await nameInput.inputValue();

    // Install a network spy to detect accidental form submissions
    const spy = createMentorUpdateSpy(page);

    for (const { label, description } of SETTINGS_TOOLTIP_TRIGGERS) {
      const buttons = dialog.getByRole('button', { name: label });
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        await expect(button).toBeVisible();

        // Assert the fix: every tooltip trigger must have type="button"
        await expect(button).toHaveAttribute('type', 'button', {
          timeout: 5_000,
        });

        // Click the tooltip
        spy.reset();
        await button.click();
        // wait for half a second after clicking
        await page.waitForTimeout(500);

        // No mentor update API call should have been made
        expect(
          spy.fired,
          `Clicking "${description}" tooltip (index ${i}) must not trigger a mentor update`
        ).toBe(false);
      }
    }

    spy.cleanup();

    // Save button should still say "Save" (not "Saving…")
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await expect(saveButton).toHaveText('Save');

    // Form values should be untouched
    await expect(nameInput).toHaveValue(originalName);

    await closeSettingsDialog(page, dialog);
  });
});
