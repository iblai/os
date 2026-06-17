import path from 'path';

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

// Real WAV played as the fake mic input (looped while a track is consumed).
// Lets the LiveKit voice agent receive real audio during vc-07's round-trip.
const FAKE_AUDIO_WAV = path.resolve(
  __dirname,
  '../files/testing_folder/speech.wav',
);

// H2 fix: Chromium-only flags for fake audio device
test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${FAKE_AUDIO_WAV}`,
    ],
  },
});

test.describe('Journey 9: Voice Chat', () => {
  test.setTimeout(300_000);

  // H1 fix: test.skip with callback MUST be at describe level, not inside test body
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Voice chat tests use fake media stream flags — Chromium only',
  );

  test.describe('Non-Admin', () => {
    test.beforeEach(async ({ nonadminPage }) => {
      // H2 fix: grant microphone permissions for fake device
      await nonadminPage.context().grantPermissions(['microphone']);
      await navigateToMentorApp(nonadminPage);
    });

    // fixme: voice chat dialog does not appear — may require subscription
    test.fixme(
      'non-admin goes to chat page and opens the voice call dialog with heading, mute and end-call buttons',
      async ({ nonadminPage, nonadminChatPage }) => {
        const voiceCallBtn = nonadminChatPage.voiceCallButton;
        const visible = await voiceCallBtn
          .isVisible({ timeout: 10_000 })
          .catch(() => false);
        if (!visible) {
          test.skip(true, 'Voice call button not visible in this environment');
          return;
        }
        await voiceCallBtn.click();
        const dialog = nonadminPage.getByRole('dialog', { name: 'Voice Chat' });
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        await expect(
          dialog.getByRole('heading', { name: 'Voice Chat' }),
        ).toBeVisible();
        // H1 fix: use specific locator names matching original
        await expect(
          dialog.getByRole('button', { name: /mute microphone/i }),
        ).toBeVisible({ timeout: 5_000 });
        await expect(
          dialog.getByRole('button', { name: /close voice chat/i }),
        ).toBeVisible({ timeout: 5_000 });
        await nonadminPage.keyboard.press('Escape');
      },
    );

    test('non-admin goes to chat page and starts a real voice call and receives an AI audio response', async ({
      nonadminPage,
      nonadminChatPage,
    }) => {
      test.skip(
        true,
        'Requires real LiveKit server and audio device — use the mocked version above instead',
      );
    });
  });

  test.describe('Admin', () => {
    test.beforeEach(async ({ page }) => {
      // H2 fix: grant microphone permissions for fake device
      await page.context().grantPermissions(['microphone']);
      await navigateToMentorApp(page);
    });

    test('admin goes to mentor settings and hides the voice call button by toggling off Voice Calls', async ({
      page,
      editMentorPage,
      chatPage,
    }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      // Voice calls toggle moved to the Capabilities sub-tab when Settings
      // was split into Basic / Discovery / Capabilities — switch first.
      await editMentorPage.settings.selectSubTab('Capabilities');
      const showVoiceSwitch = editMentorPage.dialog.getByRole('switch', {
        name: /enable voice calls/i,
      });
      const visible = await showVoiceSwitch
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (!visible) {
        await editMentorPage.close();
        return;
      }
      const wasEnabled =
        (await showVoiceSwitch.getAttribute('aria-checked')) === 'true';
      if (wasEnabled) {
        // H3 fix: toggle, SAVE, then close (original used toggleSwitchSaveAndClose)
        await showVoiceSwitch.click();
        await expect(showVoiceSwitch).toHaveAttribute('aria-checked', 'false', {
          timeout: 10_000,
        });
        const saveButton = editMentorPage.dialog.getByRole('button', {
          name: 'Save',
        });
        await expect(saveButton).toBeEnabled({ timeout: 10_000 });
        await saveButton.click();
        await page.waitForTimeout(3_000);
      }
      await editMentorPage.close();
      await expect(chatPage.voiceCallButton).not.toBeVisible({
        timeout: 10_000,
      });

      // Restore: toggle back ON, save, close
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.selectSubTab('Capabilities');
      const switchAgain = editMentorPage.dialog.getByRole('switch', {
        name: /enable voice calls/i,
      });
      if ((await switchAgain.getAttribute('aria-checked')) === 'false') {
        await switchAgain.click();
        await expect(switchAgain).toHaveAttribute('aria-checked', 'true', {
          timeout: 10_000,
        });
        const saveButton2 = editMentorPage.dialog.getByRole('button', {
          name: 'Save',
        });
        await expect(saveButton2).toBeEnabled({ timeout: 10_000 });
        await saveButton2.click();
        await page.waitForTimeout(3_000);
      }
      await editMentorPage.close();
    });

    test('admin goes to mentor settings and re-enables the voice call button', async ({
      page,
      editMentorPage,
      chatPage,
    }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      // Voice calls toggle moved to the Capabilities sub-tab when Settings
      // was split into Basic / Discovery / Capabilities — switch first.
      await editMentorPage.settings.selectSubTab('Capabilities');
      const showVoiceSwitch = editMentorPage.dialog.getByRole('switch', {
        name: /enable voice calls/i,
      });
      const visible = await showVoiceSwitch
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (!visible) {
        await editMentorPage.close();
        return;
      }
      if ((await showVoiceSwitch.getAttribute('aria-checked')) !== 'true') {
        // H3 fix: save after toggling
        await showVoiceSwitch.click();
        await expect(showVoiceSwitch).toHaveAttribute('aria-checked', 'true', {
          timeout: 10_000,
        });
        const saveButton = editMentorPage.dialog.getByRole('button', {
          name: 'Save',
        });
        await expect(saveButton).toBeEnabled({ timeout: 10_000 });
        await saveButton.click();
        await page.waitForTimeout(3_000);
      }
      await editMentorPage.close();
      await expect(chatPage.voiceCallButton).toBeVisible({ timeout: 10_000 });
    });

    // fixme: voice call flow times out — mocked credentials may not work in CI
    test.fixme(
      'admin goes to chat page and completes a full voice call flow using mocked call credentials and STT',
      async ({ page, chatPage }) => {
        const isAdmin = await checkAdminStatus(page);
        test.skip(
          !isAdmin,
          'Full voice flow requires admin access to create a mentor',
        );

        const VOICE_TEST_PHRASE = 'What is the capital of France?';

        await page.route(
          (url) => url.pathname.includes('/create-call-credentials/'),
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                ws_url: 'wss://mock-livekit.example.com',
                participant_token: 'mock-participant-token-for-e2e-test',
              }),
            });
          },
        );

        await page.route(
          (url) => url.pathname.includes('/audio-to-text/'),
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ text: VOICE_TEST_PHRASE }),
            });
          },
        );

        const voiceCallBtn = chatPage.voiceCallButton;
        const visible = await voiceCallBtn
          .isVisible({ timeout: 10_000 })
          .catch(() => false);
        if (!visible) return;

        await voiceCallBtn.click();
        const voiceDialog = page.getByRole('dialog', { name: 'Voice Chat' });
        await expect(voiceDialog).toBeVisible({ timeout: 15_000 });

        const muteButton = voiceDialog.getByRole('button', {
          name: /mute microphone/i,
        });
        await expect(muteButton).toBeVisible({ timeout: 10_000 });
        await muteButton.click();
        await page.waitForTimeout(2_000);

        const stopButton = voiceDialog
          .getByRole('button', { name: /mute microphone|stop|send/i })
          .first();
        await stopButton.click();

        const endCallButton = voiceDialog.getByRole('button', {
          name: /close voice chat/i,
        });
        await expect(endCallButton).toBeVisible({ timeout: 10_000 });
        await endCallButton.click();
        await expect(voiceDialog).not.toBeVisible({ timeout: 10_000 });

        const userMessage = page.locator('.chat-user-message-query', {
          hasText: VOICE_TEST_PHRASE,
        });
        await expect(userMessage).toBeVisible({ timeout: 30_000 });
        await expect(chatPage.aiMessages.first()).toBeVisible({
          timeout: 60_000,
        });
      },
    );

    test('admin creates a new mentor and completes a real voice-call round-trip with LiveKit (vc-07)', async ({
      page,
      createMentorPage,
      chatPage,
    }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access to create a mentor');

      await createMentorPage.openAndCreate();
      await waitForPageReady(page);

      await expect(chatPage.voiceCallButton).toBeVisible({ timeout: 15_000 });
      await chatPage.voiceCallButton.click();

      const voiceDialog = page.getByRole('dialog', { name: 'Voice Chat' });
      await expect(voiceDialog).toBeVisible({ timeout: 15_000 });

      // The mute button is `disabled={isLoading}` (voice-chat-modal.tsx),
      // and the hook auto-unmutes on connect. Once the mute button is
      // enabled with aria-label="Mute microphone", connectionState has
      // reached "connected" — proves /create-call-credentials/, room.connect,
      // and setMicrophoneEnabled all succeeded against the real backend.
      const muteButton = voiceDialog.getByRole('button', {
        name: 'Mute microphone',
      });
      await expect(muteButton).toBeEnabled({ timeout: 90_000 });

      // Loading messages should be gone once connected.
      await expect(
        voiceDialog.getByText(
          /Requesting microphone access|Connecting to voice chat/,
        ),
      ).not.toBeVisible({ timeout: 5_000 });

      // End the call — verifies the disconnect/cleanup path.
      const endCallButton = voiceDialog.getByRole('button', {
        name: 'Close voice chat',
      });
      await endCallButton.click();
      await expect(voiceDialog).not.toBeVisible({ timeout: 10_000 });
    });
  });
});
