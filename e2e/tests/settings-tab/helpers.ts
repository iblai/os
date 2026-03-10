import { expect, Page, Locator } from '@playwright/test';
import { selectDropdownWorksCorrectly } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * Navigate to the Settings tab inside the Edit Mentor dialog.
 * Assumes the user is already on the mentor app with an active mentor.
 *
 * @returns The Edit Mentor dialog locator
 */
export async function navigateToSettingsTab(page: Page): Promise<Locator> {
  await selectDropdownWorksCorrectly(page);

  const settings = page.getByRole('menuitem', { name: 'Settings' });
  await expect(settings).toBeVisible({ timeout: 10_000 });
  await settings.click();

  const settingsDialog = page
    .locator('div[role="dialog"]')
    .filter({ hasText: 'Edit Mentor' });
  await expect(settingsDialog).toBeVisible({ timeout: 15_000 });

  // Wait for the form to be fully loaded
  const saveButton = settingsDialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeVisible({ timeout: 10_000 });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });

  logger.info('Navigated to Settings tab');
  return settingsDialog;
}

/**
 * Close the Edit Mentor dialog.
 */
export async function closeSettingsDialog(
  page: Page,
  dialog: Locator
): Promise<void> {
  const closeButton = dialog.getByRole('button', {
    name: 'Close',
    exact: true,
  });
  await expect(closeButton).toBeVisible({ timeout: 5_000 });
  await closeButton.click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  logger.info('Closed Edit Mentor dialog');
}

/**
 * All tooltip info-icon buttons in the Settings tab.
 *
 * "More info about chat access" appears twice (Who Can View + Who Can Chat),
 * the rest appear once each.
 */
export const SETTINGS_TOOLTIP_TRIGGERS = [
  {
    label: 'More info about chat access',
    description: 'Who Can View / Who Can Chat',
  },
  {
    label: 'More info about lti accessibility',
    description: 'LTI Accessible',
  },
  {
    label: 'More info about show attachment',
    description: 'Show Attachment',
  },
  {
    label: 'More info about show voice call',
    description: 'Show Voice Call',
  },
  {
    label: 'More info about show voice record',
    description: 'Show Voice Record',
  },
];

/**
 * Spy on network requests and return a checker that tells you whether
 * any PUT / PATCH request to the mentor API was fired.
 *
 * Call `cleanup()` when done to remove the listener.
 */
export function createMentorUpdateSpy(page: Page) {
  let updateRequestFired = false;

  const handler = (request: { url: () => string; method: () => string }) => {
    if (
      request.url().includes('/mentor/') &&
      (request.method() === 'PUT' || request.method() === 'PATCH')
    ) {
      updateRequestFired = true;
    }
  };

  page.on('request', handler);

  return {
    get fired() {
      return updateRequestFired;
    },
    reset() {
      updateRequestFired = false;
    },
    cleanup() {
      page.removeListener('request', handler);
    },
  };
}
