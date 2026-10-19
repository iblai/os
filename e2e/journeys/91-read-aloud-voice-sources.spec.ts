import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import type { Page } from '@playwright/test';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import type { VoiceProviderId } from '../page-objects/edit-mentor/voice.tab';

/**
 * Journey 91 — Read Aloud plays real audio for every voice source.
 *
 * Unlike journey 40 (which stubs speechSynthesis), nothing is mocked: the
 * agent's voice source is switched in Settings → Voice, a fresh reply is read
 * aloud, and the test waits for audio to actually start. Server voices
 * (Google, ibl.ai, OpenAI, …) stream from the chat-message `/tts/` endpoint
 * into an `Audio` element and must start within 7s; Browser uses
 * speechSynthesis. Runs on a fresh mentor, so the tenant must hold the voice
 * provider keys.
 *
 * The CI image (Playwright's Linux Docker image, headless) has no speech
 * engine, so Chromium reports no voices and an utterance never fires `start`.
 * There the Browser leg only checks that the reply was handed to
 * speechSynthesis.speak(); on a machine with voices it waits for speech.
 */

type PlaybackWindow = Window & {
  __readAloudAudio: HTMLMediaElement[];
  __speechStarts: number;
  __spokenTexts: string[];
};

const PLAYBACK_TIMEOUT = 30_000;
// Mirrors FIRST_AUDIO_BUDGET_MS in hooks/use-speech.ts: past it the app
// reports a TtsSlowFirstAudioError to Sentry, so a server voice slower than
// this is a failure here too.
const FIRST_AUDIO_BUDGET = 7_000;
const PROMPT = 'Reply with one short sentence about the ocean.';

const isTtsUrl = (url: string) =>
  /\/chat-messages\/[^/]+\/tts\/$/.test(new URL(url).pathname);

// The `Audio` element useSpeech creates is never attached to the DOM, so
// capture it at play() time to be able to inspect it afterwards.
async function trackPlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as PlaybackWindow;
    w.__readAloudAudio = [];
    w.__speechStarts = 0;
    w.__spokenTexts = [];

    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__readAloudAudio.push(this);
      return play.call(this);
    };

    if ('speechSynthesis' in window) {
      const synth = window.speechSynthesis;
      const speak = synth.speak.bind(synth);
      synth.speak = (utterance: SpeechSynthesisUtterance) => {
        w.__spokenTexts.push(utterance.text);
        utterance.addEventListener('start', () => {
          w.__speechStarts += 1;
        });
        speak(utterance);
      };
    }
  });
}

async function resetPlaybackTracking(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as PlaybackWindow;
    w.__readAloudAudio = [];
    w.__spokenTexts = [];
    return w.__speechStarts;
  });
}

async function isAudioElementPlaying(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    (window as unknown as PlaybackWindow).__readAloudAudio.some(
      (a) => !a.paused && !a.ended && a.currentTime > 0,
    ),
  );
}

async function speechStartsSince(page: Page, baseline: number) {
  return page.evaluate(
    (b) => (window as unknown as PlaybackWindow).__speechStarts - b,
    baseline,
  );
}

async function spokenTexts(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as PlaybackWindow).__spokenTexts,
  );
}

// Chromium fills the voice list asynchronously, so an empty first read is
// not final until `voiceschanged` fires or a short grace period passes.
async function hasSpeechVoices(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        if (!('speechSynthesis' in window)) return resolve(false);
        const synth = window.speechSynthesis;
        if (synth.getVoices().length > 0) return resolve(true);
        const timer = setTimeout(
          () => resolve(synth.getVoices().length > 0),
          3_000,
        );
        synth.addEventListener(
          'voiceschanged',
          () => {
            clearTimeout(timer);
            resolve(synth.getVoices().length > 0);
          },
          { once: true },
        );
      }),
  );
}

async function setVoiceSource(
  editMentorPage: EditMentorPage,
  provider: VoiceProviderId,
): Promise<void> {
  await editMentorPage.open('Voice');
  await editMentorPage.voice.switchToVoiceSubTab();
  await editMentorPage.voice.selectProvider(provider);
  await editMentorPage.voice.saveVoiceSettings();
  await editMentorPage.close();
}

// Up to five legs, each a chat reply plus up to 30s of playback (7s for server voices).
test.describe.configure({ timeout: 12 * 60_000 });

test.describe('Journey 91: Read Aloud across voice sources', () => {
  test.beforeEach(async ({ page, createMentorPage }) => {
    await trackPlayback(page);
    await navigateToMentorApp(page);
    // Loud: changing the voice source needs a tenant admin, and a silent
    // skip here would hide a mis-configured account.
    await waitForAdmin(page);
    await createMentorPage.openAndCreate();
  });

  test('admin hears Read Aloud on every voice source, then again on Browser', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    const softExpect = expect.configure({ soft: true });

    await editMentorPage.open('Voice');
    if (!(await editMentorPage.voice.isCapabilityEnabled())) {
      await editMentorPage.voice.setCapabilityEnabled(true);
    }
    await editMentorPage.voice.switchToVoiceSubTab();
    await editMentorPage.voice.expectProviderSelected('browser');
    const serverVoices = (
      await editMentorPage.voice.availableProviders()
    ).filter((p) => p !== 'browser');
    expect(serverVoices.length).toBeGreaterThan(0);
    await editMentorPage.close();

    for (const provider of [...serverVoices, 'browser' as const]) {
      const budget =
        provider === 'browser' ? PLAYBACK_TIMEOUT : FIRST_AUDIO_BUDGET;
      const budgetLabel = `${budget / 1000}s`;
      await test.step(`${provider}: Read Aloud starts playing within ${budgetLabel}`, async () => {
        await setVoiceSource(editMentorPage, provider);

        const repliesBefore = await chatPage.aiMessages.count();
        await chatPage.sendMessage(PROMPT);
        await expect(chatPage.aiMessages).toHaveCount(repliesBefore + 1, {
          timeout: 60_000,
        });
        await chatPage.waitForStreamingComplete();

        // The toolbar holding Read Aloud is the bubble's sibling, so anchor
        // on the newest bubble's parent frame.
        const speakButton = chatPage.aiMessages
          .last()
          .locator('..')
          .getByRole('button', {
            name: /^(Read Aloud|Loading audio|Stop Reading Aloud)$/,
          });
        await expect(speakButton).toHaveAttribute('aria-label', 'Read Aloud', {
          timeout: 30_000,
        });

        const speechBaseline = await resetPlaybackTracking(page);
        const ttsRequest =
          provider === 'browser'
            ? null
            : page
                .waitForRequest((r) => isTtsUrl(r.url()), { timeout: 10_000 })
                .catch(() => null);
        const ttsResponse =
          provider === 'browser'
            ? null
            : page
                .waitForResponse((r) => isTtsUrl(r.url()), {
                  timeout: budget,
                })
                .catch(() => null);

        const clickedAt = Date.now();
        await speakButton.click();

        if (provider === 'browser') {
          await softExpect
            .poll(async () => (await spokenTexts(page)).length, {
              message:
                'browser: Read Aloud handed the reply to speechSynthesis',
              timeout: 10_000,
            })
            .toBeGreaterThan(0);
          const [spoken = ''] = await spokenTexts(page);
          softExpect(
            spoken.trim(),
            'browser: the spoken text is the reply',
          ).not.toBe('');

          if (await hasSpeechVoices(page)) {
            await softExpect
              .poll(() => speechStartsSince(page, speechBaseline), {
                message: `browser: speech synthesis started speaking within ${budgetLabel}`,
                timeout: budget,
              })
              .toBeGreaterThan(0);
          } else {
            test.info().annotations.push({
              type: 'no-speech-voices',
              description:
                'This browser has no speech voices, so Browser playback was checked only up to speechSynthesis.speak()',
            });
          }
        } else {
          const request = await ttsRequest;
          softExpect(
            request,
            `${provider}: Read Aloud requested the TTS audio`,
          ).not.toBeNull();

          const response = await ttsResponse;
          const outcome = response
            ? `HTTP ${response.status()}`
            : (request?.failure()?.errorText ??
              `still pending after ${budgetLabel}`);
          softExpect(
            response,
            `${provider}: TTS audio arrived within ${budgetLabel} (${outcome})`,
          ).not.toBeNull();
          if (response) {
            softExpect(
              response.status(),
              `${provider}: TTS request succeeded`,
            ).toBeLessThan(400);
            softExpect(
              response.headers()['content-type'] ?? '',
              `${provider}: TTS response is audio`,
            ).toMatch(/^audio\//);
          }

          const remaining = budget - (Date.now() - clickedAt);
          await softExpect
            .poll(() => isAudioElementPlaying(page), {
              message: `${provider}: audio is playing within ${budgetLabel} of clicking Read Aloud`,
              timeout: Math.max(remaining, 1_000),
            })
            .toBe(true);
        }

        if (
          (await speakButton.getAttribute('aria-label')) ===
          'Stop Reading Aloud'
        ) {
          await speakButton.click();
          await expect(speakButton).toHaveAttribute(
            'aria-label',
            'Read Aloud',
            { timeout: 10_000 },
          );
        }
      });
    }
  });
});
