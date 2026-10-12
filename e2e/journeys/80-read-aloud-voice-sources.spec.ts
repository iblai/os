import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, waitForAdmin } from '../utils/auth';
import type { Page } from '@playwright/test';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import type { VoiceProviderId } from '../page-objects/edit-mentor/voice.tab';

/**
 * Journey 80 — Read Aloud plays real audio for every voice source.
 *
 * Unlike journey 40 (which stubs speechSynthesis), nothing is mocked: the
 * agent's voice source is switched in Settings → Voice, a fresh reply is read
 * aloud, and the test waits for audio to actually start. Server voices
 * (Google, ibl.ai, OpenAI, …) stream from the chat-message `/tts/` endpoint
 * into an `Audio` element; Browser uses speechSynthesis. Runs on a fresh
 * mentor, so the tenant must hold the voice provider keys.
 */

type PlaybackWindow = Window & {
  __readAloudAudio: HTMLMediaElement[];
  __speechStarts: number;
};

const PLAYBACK_TIMEOUT = 30_000;
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

    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__readAloudAudio.push(this);
      return play.call(this);
    };

    if ('speechSynthesis' in window) {
      const synth = window.speechSynthesis;
      const speak = synth.speak.bind(synth);
      synth.speak = (utterance: SpeechSynthesisUtterance) => {
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

// Up to five legs, each a chat reply plus up to 30s of playback.
test.describe.configure({ timeout: 12 * 60_000 });

test.describe('Journey 80: Read Aloud across voice sources', () => {
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
      await test.step(`${provider}: Read Aloud starts playing within 30s`, async () => {
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
                  timeout: PLAYBACK_TIMEOUT,
                })
                .catch(() => null);

        const clickedAt = Date.now();
        await speakButton.click();

        if (provider === 'browser') {
          await softExpect
            .poll(() => speechStartsSince(page, speechBaseline), {
              message: 'browser: speech synthesis started speaking',
              timeout: PLAYBACK_TIMEOUT,
            })
            .toBeGreaterThan(0);
        } else {
          const request = await ttsRequest;
          softExpect(
            request,
            `${provider}: Read Aloud requested the TTS audio`,
          ).not.toBeNull();

          const response = await ttsResponse;
          const outcome = response
            ? `HTTP ${response.status()}`
            : (request?.failure()?.errorText ?? 'still pending after 30s');
          softExpect(
            response,
            `${provider}: TTS audio arrived within 30s (${outcome})`,
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

          const remaining = PLAYBACK_TIMEOUT - (Date.now() - clickedAt);
          await softExpect
            .poll(() => isAudioElementPlaying(page), {
              message: `${provider}: audio is playing within 30s of clicking Read Aloud`,
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
