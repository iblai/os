import { Page, Locator, expect } from '@playwright/test';
import { MENTOR_NEXTJS_HOST } from '../../utils';
import { waitForPageReady } from '../utils';
import { getMentorIdFromUrl } from '../../helpers';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * Navigate to the mentor app and wait for page to load
 */
export async function navigateToMentorApp(
  page: Page,
  url?: string,
  locator?: Locator
): Promise<void> {
  const mentorAppUrl = url || MENTOR_NEXTJS_HOST;
  const startingUrl = url || MENTOR_NEXTJS_HOST + '/platform';
  const appLocator =
    locator || page.getByRole('heading', { name: 'Explore Mentors' });

  await page.goto(mentorAppUrl, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await waitForPageReady(page);
  await page.waitForURL((url) => url.href.startsWith(startingUrl), {
    timeout: 120_000,
  });

  if (locator) {
    await expect(locator).toBeVisible({ timeout: 60_000 });
    return;
  }
  const exploreMentorsHeading = page.getByRole('heading', {
    name: 'Explore Mentors',
  });
  try {
    const sessionIdJson = await page.evaluate(() =>
      localStorage.getItem('session_id')
    );
    if (!sessionIdJson) {
      throw new Error('session_id not found in localStorage');
    }
    const parsed = JSON.parse(sessionIdJson);
    if (!parsed) {
      throw new Error('session_id is not a valid JSON object');
    }
    const mentorId = getMentorIdFromUrl(page.url());
    if (!mentorId || typeof mentorId !== 'string') {
      throw new Error('Failed to get valid mentor id from URL');
    }
    const currentMentor = parsed[mentorId as keyof typeof parsed];

    if (!currentMentor) {
      throw new Error('Current mentor not found');
    } else {
      // Expect the explore mentors heading to not be visible
      await expect(exploreMentorsHeading).not.toBeVisible({ timeout: 5000 });
      // WE ARE IN A CHAT SESSION SCENARIO
      const userMessage = page.locator('.chat-user-message-query', {
        hasText: /.+/,
      });
      const mentorResponse = page.locator('.chat-ai-message-response', {
        hasText: /.+/,
      });
      // one of the two should be visible
      await expect(mentorResponse.or(userMessage).first()).toBeVisible({
        timeout: 60_000,
      });
    }
  } catch (error) {
    await expect(exploreMentorsHeading).toBeVisible({ timeout: 60_000 });
  }
}

/**
 * Open the mentor dropdown menu from the header
 */
export async function openMentorDropdown(page: Page): Promise<void> {
  const mentorDropdownButton = page.getByRole('button', {
    name: 'Selected mentor dropdown button',
  });
  await expect(mentorDropdownButton).toBeVisible({ timeout: 15000 });
  await mentorDropdownButton.click();

  // Wait for the menu to appear
  const newChatMenuItem = page.getByRole('menuitem', { name: 'New chat' });
  await expect(newChatMenuItem).toBeVisible({ timeout: 10000 });
}

/**
 * Open the Edit Mentor modal
 */
export async function openEditMentorModal(page: Page): Promise<Locator> {
  await openMentorDropdown(page);

  // Click on Settings menu item to open Edit Mentor modal
  const settingsMenuItem = page.getByRole('menuitem', { name: 'Settings' });
  await expect(settingsMenuItem).toBeVisible({ timeout: 5000 });
  await settingsMenuItem.click();

  await waitForPageReady(page);

  // Wait for the Edit Mentor modal to appear
  const editMentorDialog = page.getByRole('dialog').filter({ hasText: 'Edit' });
  await expect(editMentorDialog).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');

  return editMentorDialog;
}

/**
 * Open the Settings tab in the Edit Mentor modal
 */
export async function openSettingsTab(page: Page): Promise<Locator> {
  const editMentorDialog = await openEditMentorModal(page);

  await waitForPageReady(page);

  // Click on the Settings tab
  const settingsTab = editMentorDialog.getByRole('tab', { name: 'Settings' });
  await expect(settingsTab).toBeVisible({ timeout: 10000 });
  await settingsTab.click();

  // Wait for the settings content to load
  await waitForPageReady(page);

  // Verify we're on the Settings tab by checking for the heading
  const settingsHeading = editMentorDialog.getByRole('heading', {
    name: 'Settings',
  });
  await expect(settingsHeading).toBeVisible({ timeout: 10000 });

  logger.info('Settings tab opened successfully');

  return editMentorDialog;
}

/**
 * Close the Edit Mentor modal
 */
export async function closeEditMentorModal(page: Page): Promise<void> {
  const closeButton = page.getByRole('button', { name: 'Close' });
  if (await closeButton.isVisible()) {
    await closeButton.click();
    await page.waitForTimeout(500);
  } else {
    // Try pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  const editMentorDialog = page.getByRole('dialog').filter({ hasText: 'Edit' });
  await expect(editMentorDialog).not.toBeVisible({ timeout: 5000 });

  logger.info('Edit Mentor modal closed');
}

/**
 * Get the Unique ID input element
 */
export async function getUniqueIdInput(page: Page): Promise<Locator> {
  const uniqueIdInput = page.getByRole('textbox', { name: 'Unique ID' });

  await expect(uniqueIdInput).toBeVisible({ timeout: 10000 });
  return uniqueIdInput;
}

/**
 * Get the Copy button for the Unique ID
 */
export async function getUniqueIdCopyButton(page: Page): Promise<Locator> {
  const copyButton = page.getByRole('button', {
    name: 'Copy unique ID to clipboard',
  });
  await expect(copyButton).toBeVisible({ timeout: 10000 });
  return copyButton;
}

/**
 * Copy the Unique ID to clipboard and verify
 */
export async function copyUniqueId(page: Page): Promise<string> {
  const uniqueIdInput = await getUniqueIdInput(page);
  const uniqueIdValue = await uniqueIdInput.inputValue();

  const copyButton = await getUniqueIdCopyButton(page);
  await copyButton.click();

  // Wait for success state
  const copiedButton = page.getByRole('button', {
    name: 'Unique ID copied to clipboard',
  });
  await expect(copiedButton).toBeVisible({ timeout: 5000 });

  logger.info(`Copied Unique ID: ${uniqueIdValue}`);
  return uniqueIdValue;
}

/**
 * Verify Unique ID field is readonly and disabled
 */
export async function verifyUniqueIdReadOnly(page: Page): Promise<void> {
  const uniqueIdInput = await getUniqueIdInput(page);

  // Verify readonly attribute
  await expect(uniqueIdInput).toHaveAttribute('readonly', '');

  // Verify disabled state
  await expect(uniqueIdInput).toBeDisabled();

  // Verify it has the expected styling classes
  await expect(uniqueIdInput).toHaveClass(/bg-gray-50/);
  await expect(uniqueIdInput).toHaveClass(/cursor-not-allowed/);

  logger.info('Unique ID field is verified as readonly and disabled');
}
