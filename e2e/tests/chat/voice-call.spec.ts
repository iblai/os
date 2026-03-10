import { test, expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { navigateToMentorApp } from '../profile/helpers';
import { fillCreateMentorForm } from '../utils/create-mentor';
import {
  launchVoiceBrowser,
  verifyMentorIsOperational,
  trackMediaStreams,
  startVoiceCall,
  waitForAIAudioResponse,
  logAudioState,
  getAudioState,
  endVoiceCall,
  assertAllMediaStreamsStopped,
} from './helpers';

test.describe.skip('voice call functionality', () => {
  test.setTimeout(300_000);

  test('user can start a voice call and receive an AI audio response', async ({
    browser,
  }) => {
    // Only Chromium supports --use-fake-device-for-media-stream
    const browserName = browser.browserType().name();
    test.skip(
      browserName !== 'chromium',
      'Voice call test requires Chromium fake media device support'
    );

    const { voiceBrowser, context, page } = await launchVoiceBrowser();

    try {
      // Step 1: Navigate to the mentor app
      logger.info('Navigating to mentor app');
      await navigateToMentorApp(page);

      // Step 2: Create a new mentor to isolate from other tests' settings
      logger.info('Creating a new mentor');
      const { mentorName } = await fillCreateMentorForm({ page });
      logger.info(`Mentor created: ${mentorName}`);

      // Step 3: Verify the mentor is fully provisioned
      await verifyMentorIsOperational(page);

      // Step 4: Start tracking all getUserMedia streams before the voice call
      await trackMediaStreams(page);

      // Step 5: Start the voice call
      const { voiceChatDialog, muteButton } = await startVoiceCall(page);

      // Step 6: Wait for the AI agent to respond with audio
      await waitForAIAudioResponse(page);

      // Step 7: Verify the audio is actively playing
      await logAudioState(page, 'BEFORE');
      const audioState = await getAudioState(page);
      expect(audioState).not.toBeNull();
      expect(audioState!.readyState).toBe(4);
      logger.info('AI audio is streaming');
      await logAudioState(page, 'AFTER');

      // Step 8: Verify mute/unmute toggle works
      await muteButton.click();
      const unmuteButton = voiceChatDialog.getByRole('button', {
        name: 'Unmute microphone',
      });
      await expect(unmuteButton).toBeVisible({ timeout: 5_000 });
      logger.info('Mute toggle works');

      // Unmute again
      await unmuteButton.click();
      await expect(muteButton).toBeVisible({ timeout: 5_000 });

      // Step 9: End the call
      await endVoiceCall(page, voiceChatDialog);

      // Step 10: Verify all microphone streams were released
      await assertAllMediaStreamsStopped(page);

      // Step 11: Verify the chat interface is still functional
      const chatTextbox = page.getByRole('textbox', { name: 'Ask anything' });
      await expect(chatTextbox).toBeVisible({ timeout: 10_000 });
      logger.info('Chat interface is intact after voice call');
    } finally {
      await context.close();
      await voiceBrowser.close();
    }
  });
});
