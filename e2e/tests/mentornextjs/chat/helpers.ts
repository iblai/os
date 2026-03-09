import {
  expect,
  chromium,
  Page,
  BrowserContext,
  Browser,
} from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
import { MENTOR_NEXTJS_HOST } from '../../utils';
import path from 'path';

const SPEECH_WAV_PATH = path.resolve(
  __dirname,
  '../../../files/testing_folder/speech.wav'
);

/**
 * Launch a dedicated Chromium browser with fake media device flags.
 * These are Chrome-only flags and cannot be set in the global config
 * because they would break Safari/Firefox projects.
 *
 * Returns the browser, context, and page — caller must close them.
 */
export async function launchVoiceBrowser(): Promise<{
  voiceBrowser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const voiceBrowser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${SPEECH_WAV_PATH}`,
    ],
  });

  const origin = MENTOR_NEXTJS_HOST;
  const context = await voiceBrowser.newContext({
    storageState: 'playwright/.auth/user-chrome.json',
    permissions: ['microphone'],
    baseURL: origin,
  });
  const page = await context.newPage();

  return { voiceBrowser, context, page };
}

/**
 * Send a text message and wait for the AI to respond.
 * Newly created mentors need a backend round-trip before the voice agent
 * can join the LiveKit room; a text exchange confirms readiness.
 */
export async function verifyMentorIsOperational(page: Page): Promise<void> {
  const chatTextbox = page.getByRole('textbox', { name: 'Ask anything' });
  await expect(chatTextbox).toBeVisible({ timeout: 10_000 });
  await chatTextbox.fill('hello');
  const sendButton = page.getByRole('button', { name: /send/i });
  await expect(sendButton).toBeEnabled({ timeout: 5_000 });
  await sendButton.click();
  logger.info('Sent text message to verify mentor is operational');

  const replyLocator = page.locator('.chat-ai-message-response').last();
  await expect(replyLocator).toBeVisible({ timeout: 60_000 });
  await expect(replyLocator).not.toBeEmpty();
  logger.info('Mentor responded to text — backend is ready');
}

/**
 * Get the current audio element state from the page.
 */
export async function getAudioState(page: Page) {
  return page.evaluate(() => {
    const audio = document.querySelector('audio');
    return audio
      ? {
          paused: audio.paused,
          readyState: audio.readyState,
          duration: audio.duration,
          currentTime: audio.currentTime,
        }
      : null;
  });
}

/**
 * Log the audio track state with a label prefix for debugging.
 */
export async function logAudioState(page: Page, label: string): Promise<void> {
  const state = await getAudioState(page);
  logger.info(
    `[AI voice chat response] ${label} — duration: ${state?.duration}, currentTime: ${state?.currentTime}, paused: ${state?.paused}, readyState: ${state?.readyState}`
  );
}

/**
 * Inject a script that wraps navigator.mediaDevices.getUserMedia to track
 * all acquired MediaStreams. Call `assertAllMediaStreamsStopped` after the
 * call ends to verify every track reached the "ended" state.
 */
export async function trackMediaStreams(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__trackedMediaStreams = [] as MediaStream[];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as any).__trackedMediaStreams.push(stream);
      return stream;
    };
  });
}

/**
 * Assert that all MediaStream tracks acquired during the session have been
 * stopped (readyState === "ended"). This verifies the microphone is fully
 * released after a voice call ends.
 */
export async function assertAllMediaStreamsStopped(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const streams: MediaStream[] = (window as any).__trackedMediaStreams || [];
    return streams.map((stream, i) => ({
      streamIndex: i,
      tracks: stream.getTracks().map((t) => ({
        kind: t.kind,
        label: t.label,
        readyState: t.readyState,
      })),
    }));
  });

  logger.info(`Tracked ${result.length} media stream(s) after call ended`);
  for (const stream of result) {
    for (const track of stream.tracks) {
      logger.info(
        `Stream ${stream.streamIndex} track: kind=${track.kind}, readyState=${track.readyState}`
      );
      expect(
        track.readyState,
        `Stream ${stream.streamIndex} ${track.kind} track should be ended`
      ).toBe('ended');
    }
  }
  logger.info('All media stream tracks are stopped — microphone released');
}

/**
 * Start a voice call and wait for the connection to establish.
 * Returns the voice chat dialog locator and the mute button locator.
 */
export async function startVoiceCall(page: Page) {
  const voiceCallButton = page.getByRole('button', { name: 'Voice call' });
  await expect(voiceCallButton).toBeVisible({ timeout: 10_000 });
  await voiceCallButton.click();

  const voiceChatDialog = page.getByRole('dialog', { name: 'Voice Chat' });
  await expect(voiceChatDialog).toBeVisible({ timeout: 10_000 });
  logger.info('Voice Chat dialog opened');

  const muteButton = voiceChatDialog.getByRole('button', {
    name: 'Mute microphone',
  });
  await expect(muteButton).toBeVisible({ timeout: 60_000 });
  await expect(muteButton).toBeEnabled();
  logger.info('Voice call connected — microphone is active and unmuted');

  await expect(
    voiceChatDialog.getByText('Requesting microphone access...')
  ).not.toBeVisible();
  await expect(
    voiceChatDialog.getByText('Connecting to voice chat...')
  ).not.toBeVisible();

  return { voiceChatDialog, muteButton };
}

/**
 * Wait for the AI agent to publish an audio track via LiveKit.
 * RoomAudioRenderer creates <audio> elements for remote audio tracks.
 */
export async function waitForAIAudioResponse(page: Page): Promise<void> {
  await expect(async () => {
    const audioCount = await page.evaluate(
      () => document.querySelectorAll('audio').length
    );
    expect(audioCount).toBeGreaterThan(0);
  }).toPass({ timeout: 120_000, intervals: [2_000] });
  logger.info('AI agent audio track detected');
}

/**
 * End the voice call and verify the dialog closes.
 */
export async function endVoiceCall(
  page: Page,
  voiceChatDialog: ReturnType<Page['getByRole']>
): Promise<void> {
  const endCallButton = voiceChatDialog.getByRole('button', {
    name: 'Close voice chat',
  });
  await endCallButton.click();
  await expect(voiceChatDialog).not.toBeVisible({ timeout: 10_000 });
  logger.info('Voice call ended — dialog closed');
}
