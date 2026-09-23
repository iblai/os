import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { KokoroConfig } from '../config';
import {
  isModelCached,
  resetModelWarmUp,
  warmModelCache,
} from '../model-cache';

// ---------------------------------------------------------------------------
// The Cache Storage probe and the background download that fills it.
//
// Every URL asserted here is a contract with a third party: transformers.js
// files the ONNX graph under its own `resolve/main` spelling, `kokoro-js` does
// the same for the voice tensors from a hard-coded repo id, and this app's
// worker rewrites both onto a pinned revision on the way out. Getting any of
// those strings wrong turns a warm cache into a silent 325 MB re-download, so
// they are spelled out in full rather than derived.
// ---------------------------------------------------------------------------

const BASE: KokoroConfig = {
  modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  modelHost: 'https://huggingface.co',
  modelRevision: '1939ad2a8e416c0acfeecc08a694d14ef25f2231',
  dtype: 'fp32',
  device: 'webgpu',
  voice: 'af_heart',
  speed: 1,
  wasmPaths: '/ort/',
};

const WEIGHT_KEY =
  'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx';
const WEIGHT_URL =
  'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/onnx/model.onnx';
const VOICE_KEY =
  'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/af_heart.bin';
const VOICE_URL =
  'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/voices/af_heart.bin';

class FakeCache {
  put = vi.fn(async (key: string, response: unknown) => {
    this.entries.set(key, response);
  });
  match = vi.fn(async (key: string) => this.entries.get(key));
  constructor(readonly entries = new Map<string, unknown>()) {}
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  has = vi.fn(async (name: string) => this.caches.has(name));
  open = vi.fn(async (name: string) => {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache;
  });

  seed(name: string, keys: string[]) {
    const cache = new FakeCache(new Map(keys.map((key) => [key, {}])));
    this.caches.set(name, cache);
    return cache;
  }
}

let storage: FakeCacheStorage;

function installCaches(value: unknown) {
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    writable: true,
    value,
  });
}

function setNavigatorProp(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

function okResponse() {
  return { ok: true } as unknown as Response;
}

beforeEach(() => {
  resetModelWarmUp();
  storage = new FakeCacheStorage();
  installCaches(storage);
  setNavigatorProp('connection', undefined);
  setNavigatorProp('storage', undefined);
  globalThis.fetch = vi.fn(async () => okResponse()) as unknown as typeof fetch;
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'caches');
  Reflect.deleteProperty(navigator, 'connection');
  Reflect.deleteProperty(navigator, 'storage');
  resetModelWarmUp();
  vi.restoreAllMocks();
});

describe('isModelCached', () => {
  it('is true only when the weights and this voice are both present', async () => {
    storage.seed('transformers-cache', [WEIGHT_KEY]);
    storage.seed('kokoro-voices', [VOICE_KEY]);

    expect(await isModelCached(BASE, 'af_heart')).toBe(true);
  });

  // The two caches are written by different libraries and filled at different
  // times: `from_pretrained` never touches the voices, which are fetched one
  // at a time on first use.
  it('is false when the model is cached but the voice is not', async () => {
    storage.seed('transformers-cache', [WEIGHT_KEY]);
    storage.seed('kokoro-voices', []);

    expect(await isModelCached(BASE, 'af_heart')).toBe(false);
  });

  it('is false for a voice other than the one that was downloaded', async () => {
    storage.seed('transformers-cache', [WEIGHT_KEY]);
    storage.seed('kokoro-voices', [VOICE_KEY]);

    expect(await isModelCached(BASE, 'bm_george')).toBe(false);
  });

  it('is false when the weights are missing, without looking at the voices', async () => {
    storage.seed('kokoro-voices', [VOICE_KEY]);

    expect(await isModelCached(BASE, 'af_heart')).toBe(false);
    expect(storage.open).not.toHaveBeenCalled();
  });

  // `caches.open()` creates the cache as a side effect, so probing with it
  // would leave an empty `kokoro-voices` behind on every page view.
  it('checks existence with has() before opening anything', async () => {
    expect(await isModelCached(BASE, 'af_heart')).toBe(false);
    expect(storage.has).toHaveBeenCalledWith('transformers-cache');
    expect(storage.open).not.toHaveBeenCalled();
  });

  it('also accepts the pinned spelling of each URL', async () => {
    storage.seed('transformers-cache', [WEIGHT_URL]);
    storage.seed('kokoro-voices', [VOICE_URL]);

    expect(await isModelCached(BASE, 'af_heart')).toBe(true);
  });

  it('follows the dtype to the file name transformers.js asks for', async () => {
    const cache = storage.seed('transformers-cache', []);
    storage.seed('kokoro-voices', []);

    await isModelCached({ ...BASE, dtype: 'q8' }, 'af_heart');

    expect(cache.match).toHaveBeenCalledWith(
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx',
    );
  });

  it('keeps the hard-coded kokoro-js repo id for the voice, not the configured one', async () => {
    storage.seed('transformers-cache', [
      'https://huggingface.co/acme/kokoro/resolve/main/onnx/model.onnx',
    ]);
    const voices = storage.seed('kokoro-voices', []);

    await isModelCached({ ...BASE, modelId: 'acme/kokoro' }, 'af_heart');

    expect(voices.match).toHaveBeenCalledWith(VOICE_KEY);
    expect(voices.match).toHaveBeenCalledWith(
      'https://huggingface.co/acme/kokoro/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/voices/af_heart.bin',
    );
  });

  it('asks once when the two spellings of a URL are the same string', async () => {
    const cache = storage.seed('transformers-cache', []);

    await isModelCached({ ...BASE, modelRevision: 'main' }, 'af_heart');

    expect(cache.match).toHaveBeenCalledTimes(1);
    expect(cache.match).toHaveBeenCalledWith(
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx',
    );
  });

  // SSR, and browsers that expose no Cache Storage on insecure origins.
  it('is false with no caches global at all', async () => {
    Reflect.deleteProperty(globalThis, 'caches');
    expect(await isModelCached(BASE, 'af_heart')).toBe(false);
  });

  // Some privacy modes throw SecurityError rather than returning nothing.
  it('is false when the cache storage refuses to answer', async () => {
    storage.has.mockRejectedValue(new Error('SecurityError'));
    expect(await isModelCached(BASE, 'af_heart')).toBe(false);
  });

  it('is false when opening the cache throws', async () => {
    storage.seed('transformers-cache', [WEIGHT_KEY]);
    storage.open.mockRejectedValue(new Error('SecurityError'));
    expect(await isModelCached(BASE, 'af_heart')).toBe(false);
  });

  it('is false when a lookup rejects', async () => {
    const cache = storage.seed('transformers-cache', []);
    cache.match.mockRejectedValue(new Error('boom'));
    expect(await isModelCached(BASE, 'af_heart')).toBe(false);
  });
});

describe('warmModelCache', () => {
  it('fetches the pinned URLs and files them under the library keys', async () => {
    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);

    expect(globalThis.fetch).toHaveBeenCalledWith(WEIGHT_URL);
    expect(globalThis.fetch).toHaveBeenCalledWith(VOICE_URL);
    expect(storage.caches.get('transformers-cache')?.put).toHaveBeenCalledWith(
      WEIGHT_KEY,
      expect.anything(),
    );
    expect(storage.caches.get('kokoro-voices')?.put).toHaveBeenCalledWith(
      VOICE_KEY,
      expect.anything(),
    );
  });

  // The download is 325 MB. Two of them concurrently is not a slower feature,
  // it is a broken one.
  it('runs once however many times it is asked', async () => {
    const first = warmModelCache(BASE, 'af_heart');
    const second = warmModelCache(BASE, 'af_heart');
    expect(second).toBe(first);

    await first;
    await warmModelCache(BASE, 'af_heart');

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // A failure is remembered too: retrying 325 MB on every button press is
  // worse than staying on the cloud for the rest of the session.
  it('does not retry a download that already failed', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
    })) as unknown as typeof fetch;

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh download when the voice changes', async () => {
    await warmModelCache(BASE, 'af_heart');
    await warmModelCache(BASE, 'bm_george');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/voices/bm_george.bin',
    );
  });

  it('skips a file that is already cached', async () => {
    storage.seed('transformers-cache', [WEIGHT_KEY]);

    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(VOICE_URL);
  });

  it('gives up on the voice when the weights never arrived', async () => {
    globalThis.fetch = vi.fn(async (url: unknown) =>
      url === WEIGHT_URL ? { ok: false } : { ok: true },
    ) as unknown as typeof fetch;

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports failure when only the voice fails', async () => {
    globalThis.fetch = vi.fn(async (url: unknown) =>
      url === VOICE_URL ? { ok: false } : { ok: true },
    ) as unknown as typeof fetch;

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
  });

  // Nothing below this call is allowed to reject: it is fired and forgotten
  // from a click handler, so an unhandled rejection is the only way it could
  // ever be noticed.
  it('resolves rather than rejecting when a guard itself throws', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });

    await expect(warmModelCache(BASE, 'af_heart')).resolves.toBe(false);
  });

  it('reports failure when the request itself throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
  });

  it('reports failure when writing to the cache is refused', async () => {
    const cache = storage.seed('transformers-cache', []);
    cache.put.mockRejectedValue(new Error('QuotaExceededError'));

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
  });

  it('does nothing without a Cache Storage to write into', async () => {
    Reflect.deleteProperty(globalThis, 'caches');

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // Data Saver is a user asking not to be charged for 325 MB of convenience.
  it('respects Data Saver', async () => {
    setNavigatorProp('connection', { saveData: true });

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('downloads when the connection reports no Data Saver', async () => {
    setNavigatorProp('connection', { saveData: false });

    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);
  });

  it('refuses to fill a nearly full origin', async () => {
    setNavigatorProp('storage', {
      estimate: async () => ({ quota: 400_000_000, usage: 390_000_000 }),
    });

    expect(await warmModelCache(BASE, 'af_heart')).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('downloads when there is room', async () => {
    setNavigatorProp('storage', {
      estimate: async () => ({ quota: 2_000_000_000, usage: 10_000_000 }),
    });

    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);
  });

  it('treats a reported usage of nothing as an empty origin', async () => {
    setNavigatorProp('storage', {
      estimate: async () => ({ quota: 2_000_000_000 }),
    });

    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);
  });

  // The estimate is advisory and missing in several browsers; refusing on
  // ignorance would disable the on-device path for all of them.
  it('proceeds when the quota is unknown', async () => {
    setNavigatorProp('storage', { estimate: async () => ({}) });

    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);
  });

  it('proceeds when the estimate throws', async () => {
    setNavigatorProp('storage', {
      estimate: async () => {
        throw new Error('nope');
      },
    });

    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);
  });

  it('proceeds on a browser with no storage manager', async () => {
    setNavigatorProp('storage', {});

    expect(await warmModelCache(BASE, 'af_heart')).toBe(true);
  });
});
