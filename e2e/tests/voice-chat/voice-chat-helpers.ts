import { expect, Page, Locator } from '@playwright/test';
import { fillCreateMentorForm } from '../utils/create-mentor';
import { selectDropdownWorksCorrectly } from '../utils';

/**
 * Create a mentor, verify it loaded, and return the name.
 */
export async function createMentorAndVerify(page: Page) {
  const { mentorName } = await fillCreateMentorForm({ page });
  await expect(
    page.locator('h1').filter({ hasText: new RegExp(`^${mentorName}$`) })
  ).toBeVisible({ timeout: 30_000 });
  return mentorName;
}

/**
 * Open the Settings dialog for the current mentor.
 */
export async function openSettingsDialog(page: Page) {
  await selectDropdownWorksCorrectly(page);
  const settingsMenuItem = page.getByRole('menuitem', { name: 'Settings' });
  await expect(settingsMenuItem).toBeVisible({ timeout: 10_000 });
  await settingsMenuItem.click();

  const settingsDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Edit Mentor' });
  await expect(settingsDialog).toBeVisible({ timeout: 15_000 });
  return settingsDialog;
}

/**
 * Toggle a switch in the settings dialog, save, and close.
 */
export async function toggleSwitchSaveAndClose(
  page: Page,
  settingsDialog: Locator,
  switchName: RegExp,
  targetState: 'true' | 'false'
) {
  const toggle = settingsDialog.getByRole('switch', { name: switchName });
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', targetState, {
    timeout: 10_000,
  });

  const saveButton = settingsDialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();
  await page.waitForTimeout(3000);

  const closeButton = settingsDialog.getByRole('button', {
    name: 'Close',
    exact: true,
  });
  await closeButton.click();
  await expect(settingsDialog).not.toBeVisible({ timeout: 10_000 });
}
