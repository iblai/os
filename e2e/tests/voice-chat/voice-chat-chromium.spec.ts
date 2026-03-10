import { test, expect } from '@playwright/test';
import { navigateToMentorApp } from '../profile/helpers';
import { checkAdminStatus } from '../utils';
import {
  createMentorAndVerify,
  openSettingsDialog,
  toggleSwitchSaveAndClose,
} from './voice-chat-helpers';

// Chromium-only flags — provides fake audio input for voice chat
test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});

test.describe('Voice Chat (Chromium)', () => {
  test.setTimeout(300000);

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Fake media stream flags are Chromium-only'
  );

  test.beforeEach(async ({ page }) => {
    await page.context().grantPermissions(['microphone']);
    await navigateToMentorApp(page);
  });

  test('user can initiate voice call on a newly created mentor', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Only admins can create mentors');

    await createMentorAndVerify(page);

    // Assert voice call button is visible on the new mentor
    const voiceCallButton = page.getByRole('button', { name: 'Voice call' });
    await expect(voiceCallButton).toBeVisible({ timeout: 10_000 });

    // Click the voice call button
    await voiceCallButton.click();

    // Assert the voice chat modal opens
    const voiceChatDialog = page.getByRole('dialog', { name: 'Voice Chat' });
    await expect(voiceChatDialog).toBeVisible({ timeout: 15_000 });

    // Assert key elements of the voice chat modal are present
    await expect(
      voiceChatDialog.getByRole('heading', { name: 'Voice Chat' })
    ).toBeVisible();

    // Assert the mute/unmute button is present (microphone control)
    await expect(
      voiceChatDialog.getByRole('button', { name: /mute microphone/i })
    ).toBeVisible({ timeout: 10_000 });

    // Assert the end call button is present and close the modal
    const endCallButton = voiceChatDialog.getByRole('button', {
      name: /close voice chat/i,
    });
    await expect(endCallButton).toBeVisible();
    await endCallButton.click();
    await expect(voiceChatDialog).not.toBeVisible({ timeout: 10_000 });
  });

  test('voice call button is hidden when toggled off in settings', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Only admins can create and configure mentors');

    await createMentorAndVerify(page);

    // Assert voice call button is initially visible
    const voiceCallButton = page.getByRole('button', { name: 'Voice call' });
    await expect(voiceCallButton).toBeVisible({ timeout: 10_000 });

    // Open settings and verify voice call is initially enabled
    const settingsDialog = await openSettingsDialog(page);
    const voiceCallSwitch = settingsDialog.getByRole('switch', {
      name: /show voice call/i,
    });
    await expect(voiceCallSwitch).toHaveAttribute('aria-checked', 'true', {
      timeout: 10_000,
    });

    // Toggle voice call OFF, save, and close
    await toggleSwitchSaveAndClose(
      page,
      settingsDialog,
      /show voice call/i,
      'false'
    );

    // Assert the voice call button is no longer visible
    await expect(voiceCallButton).not.toBeVisible({ timeout: 15_000 });

    // Re-open settings and toggle voice call back ON to clean up
    const settingsDialog2 = await openSettingsDialog(page);
    await toggleSwitchSaveAndClose(
      page,
      settingsDialog2,
      /show voice call/i,
      'true'
    );

    // Assert the voice call button is visible again
    await expect(voiceCallButton).toBeVisible({ timeout: 15_000 });
  });
});
