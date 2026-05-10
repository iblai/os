import path from 'path';

import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

// Real WAV played as the fake mic input (looped while recording is active).
// Chromium-only: --use-fake-device-for-media-stream / --use-file-for-fake-audio-capture
// are not supported on Firefox/WebKit.
const FAKE_AUDIO_WAV = path.resolve(
  __dirname,
  '../files/testing_folder/speech.wav',
);

test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${FAKE_AUDIO_WAV}`,
    ],
  },
});

test.describe('Journey 9b: Voice-to-Text Dictation', () => {
  // Real STT round-trip can take 30s+; give the test ample headroom on top of
  // mentor creation and navigation.
  test.setTimeout(240_000);

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Voice-to-text uses fake media stream flags — Chromium only',
  );

  test('admin creates a new mentor, records using injected fake audio, and the transcript appears in the textarea', async ({
    page,
    context,
    createMentorPage,
    chatPage,
  }) => {
    await context.grantPermissions(['microphone']);
    await navigateToMentorApp(page);

    // checkAdminStatus reads window.localStorage, which throws SecurityError
    // on about:blank — must be called after navigateToMentorApp.
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access to create a mentor');

    await createMentorPage.openAndCreate();
    await waitForPageReady(page);

    await expect(chatPage.voiceInputButton).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.voiceInputButton).toHaveAttribute(
      'aria-label',
      'Voice input',
      { timeout: 5_000 },
    );

    // The textarea's accessible name changes from "Ask anything" to
    // "Listening... mm:ss" while recording, so the role-based locator stops
    // matching. Use a stable element-level locator for placeholder reads.
    const textarea = page.locator('textarea').first();

    await chatPage.voiceInputButton.click();
    await expect(chatPage.voiceInputButton).toHaveAttribute(
      'aria-label',
      'Stop voice input',
      { timeout: 5_000 },
    );

    const parseSeconds = (placeholder: string | null): number => {
      const match = placeholder?.match(/^Listening\.\.\. (\d{2}):(\d{2})$/);
      if (!match) {
        throw new Error(
          `Expected placeholder to match "Listening... mm:ss", got: ${placeholder}`,
        );
      }
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    };

    // Verify the timer counts up while recording.
    await page.waitForTimeout(1100);
    const s1 = parseSeconds(await textarea.getAttribute('placeholder'));
    await page.waitForTimeout(1100);
    const s2 = parseSeconds(await textarea.getAttribute('placeholder'));
    expect(s2).toBeGreaterThan(s1);

    // Keep recording so the full WAV (~3s, looped) is captured before stop.
    await page.waitForTimeout(2000);

    await chatPage.voiceInputButton.click();

    // Real STT round-trip: hook POSTs to /audio-to-text/, backend transcribes,
    // response.text is piped into the textarea via setTextareaInput. Wait for
    // the button to leave the "Processing voice input" state.
    await expect(chatPage.voiceInputButton).toHaveAttribute(
      'aria-label',
      'Voice input',
      { timeout: 60_000 },
    );

    // After processing, the accessible name reverts to "Ask anything", so
    // chatPage.chatInput matches again. Assert the transcript landed in the
    // textarea — non-empty is sufficient (STT output is non-deterministic).
    await expect(chatPage.chatInput).toBeVisible({ timeout: 10_000 });
    const transcript = await chatPage.chatInput.inputValue();
    expect(transcript.trim().length).toBeGreaterThan(0);
  });
});
