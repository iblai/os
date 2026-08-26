import { devices, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MENTOR_NEXTJS_HOST } from '../fixtures/test-data';

/**
 * Journey 71: On-device TTS provider routing (issue #2341)
 *
 * Covers `lib/tts/iblai-routing.ts`'s `decide()` arbiter for the `iblai`
 * voice provider (Kokoro), which picks per-utterance between the cloud
 * `/tts/` endpoint and the on-device WebGPU model, and the Cache Storage
 * contract `lib/tts/model-cache.ts` uses to know when the device is ready.
 *
 * The `iblai` provider is NOT selectable through the Edit Mentor -> Voice
 * tab UI in the installed `@iblai/iblai-js` SDK (`voice-tab-helpers.d.ts`
 * only exposes `browser | openai | google` provider cards), so these tests
 * target a pre-provisioned mentor instead of creating one:
 *   tenant `conradtesttenant`, mentor "Kokoro Voice Test"
 *   (710a0110-75b7-4f3a-8f89-b70b712438a2), already saved with
 *   `voice_provider: iblai`. No mentor is created here, so there is nothing
 *   for `MentorTracker` to clean up.
 *
 * Hard constraint: the real Kokoro weights are ~310 MB. Every request to the
 * model host (`NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST`, default
 * huggingface.co, plus its `us.aws.cdn.hf.co` redirect target) is
 * intercepted below and either aborted or fulfilled with a few fake bytes —
 * never allowed to hit the real CDN.
 *
 * Checkpoint 3/4's "warm cache -> device" flow additionally stubs
 * `navigator.gpu` (so the arbiter's WebGPU probe succeeds regardless of
 * whether this runner has real GPU/software-rendering support) and
 * `window.Worker` (this app has exactly one call site, in
 * `lib/tts/kokoro-session.ts`, so replacing it globally is safe). The fake
 * worker answers a `generate` message with a tiny silent PCM chunk and an
 * empty "complete" blob, so the on-device path finishes cleanly through
 * `StreamPlayer` without ever needing the real ONNX runtime or model —
 * loading the real model with fake bytes would just throw deep inside
 * onnxruntime-web and demote back to the cloud, which would make the
 * "device chosen, zero cloud calls" assertion depend on a race against that
 * failure instead of testing the routing decision itself.
 */

const TENANT_KEY = 'conradtesttenant';
const KOKORO_MENTOR_ID = '710a0110-75b7-4f3a-8f89-b70b712438a2';
const KOKORO_MENTOR_URL = `${MENTOR_NEXTJS_HOST}/platform/${TENANT_KEY}/${KOKORO_MENTOR_ID}`;

/** `lib/tts/config.ts` DEFAULT_MODEL_REVISION — verified pinned sha. */
const MODEL_REVISION = '1939ad2a8e416c0acfeecc08a694d14ef25f2231';

const MODEL_HOST_PATTERNS = [
  'https://huggingface.co/**',
  'https://us.aws.cdn.hf.co/**',
];

const TTS_ENDPOINT_PATTERN = /\/chat-messages\/[^/]+\/tts\//;

type ModelHostMode = 'abort' | 'fulfill';

/**
 * Intercepts every request to the Kokoro model host and either aborts it
 * (nothing must ever be fetched) or fulfils it with a handful of fake bytes
 * (lets `lib/tts/model-cache.ts`'s real `download()` succeed and file the
 * response under its real cache keys, without a real 310 MB transfer).
 * Returns the array of request URLs observed, for assertions.
 */
async function interceptModelHost(
  page: Page,
  mode: ModelHostMode,
): Promise<string[]> {
  const requested: string[] = [];
  for (const pattern of MODEL_HOST_PATTERNS) {
    await page.route(pattern, async (route) => {
      requested.push(route.request().url());
      if (mode === 'abort') {
        await route.abort();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from('e2e-fake-kokoro-bytes'),
      });
    });
  }
  return requested;
}

/** Tracks every `/tts/` request fired for the current chat message. */
function trackTtsRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (req) => {
    if (TTS_ENDPOINT_PATTERN.test(req.url())) requests.push(req.url());
  });
  return requests;
}

/**
 * Forces the arbiter's WebGPU probe (`lib/tts/config.ts` `probeWebGpu`) to
 * succeed regardless of whether this runner has a real/software GPU adapter
 * — otherwise the "warm cache -> device" branch could never be reached on a
 * headless runner with no adapter, and the test would just be re-testing
 * "no WebGPU -> cloud" instead of the cache-driven decision it targets.
 */
async function stubWebGpuAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'gpu', {
      configurable: true,
      value: { requestAdapter: async () => ({}) },
    });
  });
}

/**
 * Replaces `window.Worker` with a fake that answers a Kokoro `generate`
 * message with one silent chunk and a completion, so `speakViaIblai`
 * (`hooks/use-speech.ts`) runs to completion without ever touching real
 * model weights. `lib/tts/kokoro-session.ts` is this app's only `new
 * Worker(...)` call site, so replacing the global constructor entirely is
 * safe — there is nothing else on this page that would need the real one.
 */
async function stubKokoroWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class FakeKokoroWorker {
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: ErrorEvent) => void) | null = null;
      postMessage(msg: { type?: string; requestId?: number }) {
        if (msg?.type !== 'generate') return;
        const requestId = msg.requestId;
        setTimeout(() => {
          this.onmessage?.({
            data: {
              type: 'chunk',
              requestId,
              index: 0,
              pcm: new Float32Array(2_400),
              samplingRate: 24_000,
            },
          } as MessageEvent);
          setTimeout(() => {
            this.onmessage?.({
              data: {
                type: 'complete',
                requestId,
                blob: new Blob([new Uint8Array(4)], { type: 'audio/wav' }),
              },
            } as MessageEvent);
          }, 10);
        }, 10);
      }
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    }
    // @ts-expect-error test shim — replaces the global constructor
    window.Worker = FakeKokoroWorker;
  });
}

/** Whether both Cache Storage entries `lib/tts/model-cache.ts` checks are populated. */
async function isKokoroCacheWarm(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const hasEntries = async (name: string) => {
      if (!(await caches.has(name))) return false;
      const cache = await caches.open(name);
      const keys = await cache.keys();
      return keys.length > 0;
    };
    return (
      (await hasEntries('transformers-cache')) &&
      (await hasEntries('kokoro-voices'))
    );
  });
}

// Every test in this file drives chat + Read Aloud against the SAME
// pre-provisioned mentor/conversation (there is no per-test mentor to
// create — see the file header). Reproduced live: running this file with
// `--workers=1` passed 9/9 across repeats, but the default parallel workers
// intermittently left the "Read Aloud" button never toggling to "Stop
// Reading Aloud" after a real click — concurrent workers racing the same
// account's chat/TTS activity, not a bug in the routing logic under test.
// `describe.serial` avoids that shared-resource race.
test.describe.serial('Journey 71: On-device TTS Provider Routing', () => {
  test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');

  test('ttsr-01: nothing is fetched from the Kokoro model host before any Read Aloud interaction', async ({
    page,
  }) => {
    const modelHostRequests = await interceptModelHost(page, 'abort');

    await navigateToMentorApp(page, KOKORO_MENTOR_URL);
    await waitForPageReady(page);
    // The mount-time `primeIblaiRoute` effect (WebGPU probe + a read-only
    // Cache Storage lookup, no network) has had time to run by now.
    await page.waitForTimeout(2_000);

    expect(modelHostRequests).toEqual([]);
  });

  test('ttsr-02: a cold on-device cache reads the message aloud through the cloud endpoint', async ({
    page,
    chatPage,
  }) => {
    const modelHostRequests = await interceptModelHost(page, 'abort');
    const ttsRequests = trackTtsRequests(page);

    await navigateToMentorApp(page, KOKORO_MENTOR_URL);
    await chatPage.startNewChat();

    await chatPage.sendMessage('Describe a quiet morning in one sentence.');
    await chatPage.waitForAIResponse();

    const speakButton = page
      .getByRole('button', { name: 'Read Aloud' })
      .first();
    await expect(speakButton).toBeVisible({ timeout: 15_000 });
    await speakButton.click();

    const stopButton = page
      .getByRole('button', { name: 'Stop Reading Aloud' })
      .first();
    await expect(stopButton).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);

    expect(ttsRequests.length).toBeGreaterThan(0);
    // No real transfer from the model host, whatever the background warm-up
    // decision was (this runner's real WebGPU support is not asserted here).
    expect(modelHostRequests).toEqual([]);
  });

  test('ttsr-03/04: a cold-cache warm-up is pinned to the exact model revision, and once both caches are warm the on-device route serves the same message with no further cloud calls', async ({
    page,
    chatPage,
  }) => {
    await stubWebGpuAdapter(page);
    await stubKokoroWorker(page);
    const modelHostRequests = await interceptModelHost(page, 'fulfill');
    const ttsRequests = trackTtsRequests(page);

    await navigateToMentorApp(page, KOKORO_MENTOR_URL);
    await chatPage.startNewChat();

    await chatPage.sendMessage('Give me one calm sentence about the rain.');
    await chatPage.waitForAIResponse();

    const speakButton = page
      .getByRole('button', { name: 'Read Aloud' })
      .first();
    await expect(speakButton).toBeVisible({ timeout: 15_000 });

    // First click: cache is cold, so this must go to the cloud and kick off
    // a background warm-up (`startIblaiWarmUp`) alongside it.
    await speakButton.click();
    const stopButton = page
      .getByRole('button', { name: 'Stop Reading Aloud' })
      .first();
    await expect(stopButton).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    const firstReadCallCount = ttsRequests.length;
    expect(firstReadCallCount).toBeGreaterThan(0);

    // ttsr-03: the warm-up's weight + voice fetches are pinned to the exact
    // revision, never the library's default `resolve/main`.
    await expect(async () => {
      expect(modelHostRequests.length).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 20_000 });
    for (const url of modelHostRequests) {
      expect(url).toContain(`/resolve/${MODEL_REVISION}/`);
      expect(url).not.toContain('/resolve/main/');
    }

    // Wait for the app's own `warmModelCache` to finish filing both cache
    // entries — this flips the in-tab routing memo to `device` (see
    // `startIblaiWarmUp` in `lib/tts/iblai-routing.ts`), no reload needed.
    await expect(async () => {
      expect(await isKokoroCacheWarm(page)).toBe(true);
    }).toPass({ timeout: 20_000 });

    // Reset playback, then read the SAME message aloud again.
    await stopButton.click();
    await expect(speakButton).toBeVisible({ timeout: 10_000 });
    await speakButton.click();

    // ttsr-04: the stubbed on-device worker answers immediately, so the
    // button still toggles through its normal speaking state...
    await expect(stopButton).toBeVisible({ timeout: 10_000 });
    // ...but this second read never touches the cloud endpoint.
    expect(ttsRequests.length).toBe(firstReadCallCount);
  });

  test.describe('mobile emulation', () => {
    // Only `userAgent` is overridden (not the full `devices['Pixel 7']`
    // descriptor) because `isMobile`/`hasTouch` are Chromium/WebKit-only
    // context options that Firefox rejects. `navigator.userAgentData.mobile`
    // is stubbed directly below instead, which works identically on every
    // engine and is what `lib/tts/config.ts` `isMobileDevice()` reads first.
    test.use({ userAgent: devices['Pixel 7'].userAgent });

    test('ttsr-05: a mobile device always reads aloud through the cloud endpoint and never contacts the model host', async ({
      page,
      chatPage,
    }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window.navigator, 'userAgentData', {
          configurable: true,
          value: { mobile: true, platform: 'Android', brands: [] },
        });
      });
      const modelHostRequests = await interceptModelHost(page, 'abort');
      const ttsRequests = trackTtsRequests(page);

      await navigateToMentorApp(page, KOKORO_MENTOR_URL);
      await chatPage.startNewChat();

      await chatPage.sendMessage('One short sentence about the ocean.');
      await chatPage.waitForAIResponse();

      const speakButton = page
        .getByRole('button', { name: 'Read Aloud' })
        .first();
      await expect(speakButton).toBeVisible({ timeout: 15_000 });
      await speakButton.click();

      const stopButton = page
        .getByRole('button', { name: 'Stop Reading Aloud' })
        .first();
      await expect(stopButton).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(500);

      expect(ttsRequests.length).toBeGreaterThan(0);
      expect(modelHostRequests).toEqual([]);
    });
  });
});
