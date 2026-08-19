/**
 * @file iblai-routing.ts
 * @input A resolved {@link KokoroConfig}, plus whatever the device and Cache
 *   Storage will admit to.
 * @output Which half of the `iblai` voice serves the next utterance, and the
 *   background download that eventually flips the answer.
 * @position The arbiter between `useSpeech`'s two `iblai` paths. Module-scoped
 *   because the answer is a property of the tab, not of a message bubble --
 *   `useSpeech` is mounted once per rendered assistant message and they must
 *   not each re-probe.
 *
 * The shape of the problem: deciding needs `await` (a WebGPU adapter request,
 * a Cache Storage lookup), but the decision is consumed inside a click handler
 * that has to dispatch synchronously -- both to keep the user gesture alive
 * for the autoplay policy, and so a second click sees the state the first one
 * wrote. So the answer is resolved *ahead of* the click, memoised here, and
 * read synchronously by {@link peekIblaiRoute}. An unresolved memo is not a
 * reason to wait; it is a reason to take the cloud for this utterance.
 */

import {
  isIosWebKit,
  isMobileDevice,
  probeWebGpu,
  type KokoroConfig,
} from './config';
import { isModelCached, warmModelCache } from './model-cache';

export type IblaiRoute = 'device' | 'cloud';

type Decision = {
  route: IblaiRoute;
  /**
   * Cloud only because nothing is downloaded yet -- the device is otherwise
   * capable, so this is the case worth warming up. Distinguishes it from an
   * iPhone or a machine with no WebGPU adapter, which will never be device
   * whatever is downloaded.
   */
  warm: boolean;
};

const CLOUD: Decision = { route: 'cloud', warm: false };
const DEVICE: Decision = { route: 'device', warm: false };

const decided = new Map<string, Decision>();
const pending = new Map<string, Promise<Decision>>();

/**
 * Everything that changes the answer. The voice is in here because the style
 * tensors live in their own cache and are downloaded one at a time: the model
 * being cached says nothing about whether *this* voice is.
 */
function routeKey(config: KokoroConfig): string {
  return [
    config.modelHost,
    config.modelId,
    config.modelRevision,
    config.dtype,
    config.device,
    config.voice,
  ].join('|');
}

async function decide(config: KokoroConfig): Promise<Decision> {
  // Every iOS browser is WebKit, which kills the tab when the model crosses
  // its per-process memory ceiling. No download changes that.
  if (isIosWebKit()) return CLOUD;
  // A phone pays 325 MB of often-metered data into a storage quota that evicts
  // aggressively, to run the model on a GPU slower than the backend answers.
  // Synchronous, so it lands before the adapter request it would have wasted.
  if (isMobileDevice()) return CLOUD;
  // Without a WebGPU adapter the only on-device backend left is single-
  // threaded WASM, measured at ~0.5x realtime -- audible gaps mid-sentence.
  // The cloud is the better automatic answer; WASM stays reachable through an
  // explicit `NEXT_PUBLIC_TTS_IBLAI_MODE=device`.
  if (config.device !== 'webgpu') return CLOUD;
  if (!(await probeWebGpu())) return CLOUD;
  if (await isModelCached(config, config.voice)) return DEVICE;
  return { route: 'cloud', warm: true };
}

/**
 * Resolves the decision for this configuration, at most once per tab.
 *
 * Safe to call on mount: it reads Cache Storage and asks for a WebGPU adapter,
 * neither of which downloads anything. The 325 MB is {@link startIblaiWarmUp}.
 */
export function primeIblaiRoute(config: KokoroConfig): Promise<Decision> {
  const key = routeKey(config);
  const settled = decided.get(key);
  if (settled) return Promise.resolve(settled);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const run = decide(config)
    .catch(() => CLOUD)
    .then((decision) => {
      decided.set(key, decision);
      pending.delete(key);
      return decision;
    });
  pending.set(key, run);
  return run;
}

/**
 * The already-resolved answer, or null while it is still being worked out.
 *
 * Synchronous on purpose -- see the file header. Null means "cloud, for now".
 */
export function peekIblaiRoute(config: KokoroConfig): IblaiRoute | null {
  return decided.get(routeKey(config))?.route ?? null;
}

/**
 * Starts the background download, if this device is one that would benefit.
 *
 * Called from the first Read Aloud rather than from page load: the download is
 * 325 MB, and a user who never presses the button must never pay for it. The
 * cloud serves the utterance that triggered this, and every one after it until
 * the download lands -- at which point the memo flips and the device takes
 * over for good.
 */
export async function startIblaiWarmUp(config: KokoroConfig): Promise<void> {
  const decision = await primeIblaiRoute(config);
  if (!decision.warm) return;
  const warmed = await warmModelCache(config, config.voice);
  if (warmed) decided.set(routeKey(config), DEVICE);
}

/**
 * Records that the on-device path just failed, so the rest of the session goes
 * straight to the cloud instead of re-failing once per message.
 */
export function demoteIblaiRoute(config: KokoroConfig): void {
  const key = routeKey(config);
  pending.delete(key);
  decided.set(key, CLOUD);
}

/** Clears the per-tab memo. For tests, and for a hard reset. */
export function resetIblaiRouting(): void {
  decided.clear();
  pending.clear();
}
