/**
 * @file model-cache.ts
 * @input A resolved {@link KokoroConfig} and a voice id.
 * @output Whether the on-device model can start without a download, and a
 *   single-flight background download that makes that true.
 * @position Sits between `useSpeech`'s routing decision and the browser's Cache
 *   Storage. Knows nothing about React, workers, or playback.
 *
 * This file owns one thing: the exact keys transformers.js and `kokoro-js`
 * store their downloads under. That contract is not ours, it is not
 * documented, and both libraries build their keys from a hard-coded
 * `https://huggingface.co/.../resolve/main/` prefix that this app rewrites at
 * fetch time (see `pinModelRequestUrl`). So the URL that goes out on the wire
 * and the URL the response is filed under are *different strings*, and every
 * probe and every warm-up here has to name both.
 */

import {
  pinModelRequestUrl,
  resolveModelWeightUrl,
  type KokoroConfig,
} from './config';

/**
 * transformers.js's cache name -- `caches.open('transformers-cache')` in
 * `@huggingface/transformers/src/utils/hub.js`. Holds the ONNX graph, the
 * tokenizer and the configs.
 */
const WEIGHTS_CACHE = 'transformers-cache';

/**
 * `kokoro-js`'s own cache, separate from the one above and written by
 * different code. A cached model with an uncached voice is still a download,
 * which is why {@link isModelCached} insists on both.
 */
const VOICES_CACHE = 'kokoro-voices';

/** The host both libraries hard-code, and therefore key on. */
const HF_HOST = 'https://huggingface.co';

/**
 * Bytes of headroom {@link warmModelCache} wants before it starts.
 *
 * The fp32 graph is 325 MB; the rest is the voice tensor and slack for the
 * browser's own bookkeeping. Only the WebGPU/fp32 combination is ever warmed
 * (see the routing gate), so a single figure is enough.
 */
const REQUIRED_BYTES = 350 * 1024 * 1024;

/**
 * The voice tensor URL `kokoro-js` 1.2.1 builds, verbatim from its bundled
 * `dist/kokoro.js` -- it fetches this string and then `cache.put`s the response
 * under the same string, so it is both the download URL and the cache key.
 * The repo id is hard-coded there, so it does not follow `config.modelId`.
 */
function voiceUrl(voice: string): string {
  return `${HF_HOST}/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${voice}.bin`;
}

/**
 * The pinned URL rewritten back to the `resolve/main` form the libraries key
 * on, keeping the file path exactly as {@link resolveModelWeightUrl} produced
 * it -- the dtype-to-filename mapping is transformers.js's, so it is never
 * rebuilt here. The marker is always present: the same module builds both
 * halves of the URL this is handed.
 */
function libraryKey(pinned: string, config: KokoroConfig): string {
  const marker = `/resolve/${config.modelRevision}/`;
  const path = pinned.slice(pinned.indexOf(marker) + marker.length);
  return `${HF_HOST}/${config.modelId}/resolve/main/${path}`;
}

function dedupe(urls: string[]): string[] {
  return [...new Set(urls)];
}

/**
 * Both spellings of the weight URL: the one transformers.js files the response
 * under, and the pinned one this app actually fetches. Checking both means a
 * future change to either end of the rewrite cannot turn a warm cache into a
 * silent 325 MB re-download.
 */
function weightKeys(config: KokoroConfig): string[] {
  const pinned = resolveModelWeightUrl(config);
  return dedupe([libraryKey(pinned, config), pinned]);
}

function voiceKeys(config: KokoroConfig, voice: string): string[] {
  const unpinned = voiceUrl(voice);
  return dedupe([unpinned, pinModelRequestUrl(unpinned, config)]);
}

/**
 * Read-only, and deliberately so: it must never issue a request, never create
 * a cache, and never throw.
 *
 * `caches.open()` *creates* the cache as a side effect, so the existence check
 * goes through `caches.has()` first -- otherwise probing would leave an empty
 * `kokoro-voices` behind on every page view. The whole thing is wrapped
 * because `caches` is absent during SSR and on insecure origins, and throws
 * `SecurityError` inside a cross-origin iframe in some privacy modes. Any of
 * that just means "not cached", which routes to the cloud.
 */
async function hasAll(cacheName: string, urls: string[]): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    if (!(await caches.has(cacheName))) return false;
    const cache = await caches.open(cacheName);
    for (const url of urls) {
      if (await cache.match(url)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Whether the on-device voice can start with no network at all: the weights
 * *and* this voice's style tensor are both already in Cache Storage.
 */
export async function isModelCached(
  config: KokoroConfig,
  voice: string,
): Promise<boolean> {
  if (!(await hasAll(WEIGHTS_CACHE, weightKeys(config)))) return false;
  return hasAll(VOICES_CACHE, voiceKeys(config, voice));
}

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

type NavigatorWithStorage = Navigator & {
  storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> };
};

/** Data Saver is a user asking not to be charged for 325 MB of convenience. */
function saveDataEnabled(): boolean {
  return (navigator as NavigatorWithConnection).connection?.saveData === true;
}

/**
 * Whether the origin has room. An unknown quota is treated as room: the
 * estimate is advisory everywhere and absent in several browsers, and refusing
 * on ignorance would disable the on-device path for all of them. A genuinely
 * full disk fails at `cache.put`, which is caught.
 */
async function hasHeadroom(): Promise<boolean> {
  try {
    const storage = (navigator as NavigatorWithStorage).storage;
    if (typeof storage?.estimate !== 'function') return true;
    const { quota, usage } = await storage.estimate();
    if (typeof quota !== 'number') return true;
    return quota - (usage ?? 0) >= REQUIRED_BYTES;
  } catch {
    return true;
  }
}

/**
 * Fetches `url` and files it under `key`, which is the library's spelling of
 * the same file rather than the one that was requested.
 *
 * `cache.put` is handed the `Response` itself, so the body streams to disk
 * without ever being buffered as an ArrayBuffer on the heap -- the difference
 * between a background download and a 325 MB allocation on a phone.
 */
async function download(
  cacheName: string,
  url: string,
  key: string,
): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(cacheName);
    if (await cache.match(key)) return true;
    const response = await fetch(url);
    if (!response.ok) return false;
    await cache.put(key, response);
    return true;
  } catch {
    return false;
  }
}

let warmKey = '';
let warmUp: Promise<boolean> | null = null;

function warmUpKey(config: KokoroConfig, voice: string): string {
  return [
    config.modelHost,
    config.modelId,
    config.modelRevision,
    config.dtype,
    voice,
  ].join('|');
}

/**
 * Downloads what {@link isModelCached} looks for, in the background, once.
 *
 * Single-flight per configuration: the promise is memoised for the lifetime of
 * the tab, so every later Read Aloud joins the download in progress instead of
 * starting a second one. The memo is kept even when the download failed --
 * retrying 325 MB on every button press is a worse outcome than staying on the
 * cloud path for the rest of the session.
 */
export function warmModelCache(
  config: KokoroConfig,
  voice: string,
): Promise<boolean> {
  const key = warmUpKey(config, voice);
  if (warmUp && warmKey === key) return warmUp;
  warmKey = key;
  warmUp = runWarmUp(config, voice).catch(() => false);
  return warmUp;
}

async function runWarmUp(
  config: KokoroConfig,
  voice: string,
): Promise<boolean> {
  if (saveDataEnabled()) return false;
  if (!(await hasHeadroom())) return false;

  const [weightUrl] = weightKeys(config);
  const weightsOk = await download(
    WEIGHTS_CACHE,
    resolveModelWeightUrl(config),
    weightUrl,
  );
  if (!weightsOk) return false;

  const unpinnedVoice = voiceUrl(voice);
  return download(
    VOICES_CACHE,
    pinModelRequestUrl(unpinnedVoice, config),
    unpinnedVoice,
  );
}

/** Drops the single-flight memo. For tests, and for a hard reset. */
export function resetModelWarmUp(): void {
  warmKey = '';
  warmUp = null;
}
