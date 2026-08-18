import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// The per-utterance arbiter between the two halves of the `iblai` voice.
//
// Cache Storage and the download itself are stubbed: what is under test is the
// decision and the memo, not the bytes.
// ---------------------------------------------------------------------------

const mockIsModelCached = vi.fn();
const mockWarmModelCache = vi.fn();

vi.mock('../model-cache', () => ({
  isModelCached: (...args: unknown[]) => mockIsModelCached(...args),
  warmModelCache: (...args: unknown[]) => mockWarmModelCache(...args),
}));

import type { KokoroConfig } from '../config';
import {
  demoteIblaiRoute,
  peekIblaiRoute,
  primeIblaiRoute,
  resetIblaiRouting,
  startIblaiWarmUp,
} from '../iblai-routing';

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

function setNavigatorProp(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

function grantWebGpu() {
  setNavigatorProp('gpu', { requestAdapter: async () => ({}) });
}

beforeEach(() => {
  resetIblaiRouting();
  mockIsModelCached.mockReset().mockResolvedValue(false);
  mockWarmModelCache.mockReset().mockResolvedValue(true);
  setNavigatorProp('userAgent', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/125');
  setNavigatorProp('maxTouchPoints', 0);
  grantWebGpu();
});

afterEach(() => {
  resetIblaiRouting();
  Reflect.deleteProperty(navigator, 'gpu');
  vi.restoreAllMocks();
});

describe('primeIblaiRoute', () => {
  it('takes the device when the model and voice are already downloaded', async () => {
    mockIsModelCached.mockResolvedValue(true);

    expect(await primeIblaiRoute(BASE)).toEqual({
      route: 'device',
      warm: false,
    });
  });

  it('takes the cloud, and asks to be warmed, when nothing is downloaded', async () => {
    expect(await primeIblaiRoute(BASE)).toEqual({ route: 'cloud', warm: true });
  });

  // The model would load, then kill the tab: WebKit enforces a per-process
  // memory ceiling that no amount of downloading gets around.
  it('never chooses the device on iOS, and never warms it', async () => {
    setNavigatorProp(
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) CriOS/125.0',
    );

    expect(await primeIblaiRoute(BASE)).toEqual({
      route: 'cloud',
      warm: false,
    });
    expect(mockIsModelCached).not.toHaveBeenCalled();
  });

  // Single-threaded WASM generates at ~0.5x realtime -- audible gaps. The
  // cloud is the better automatic answer, so no download is worth starting.
  it('never chooses a WASM-only device, and never warms it', async () => {
    expect(await primeIblaiRoute({ ...BASE, device: 'wasm' })).toEqual({
      route: 'cloud',
      warm: false,
    });
    expect(mockIsModelCached).not.toHaveBeenCalled();
  });

  // `navigator.gpu` exists on blocklisted GPUs and in browsers that expose the
  // API while denying the hardware.
  it('never chooses the device when no adapter is granted', async () => {
    setNavigatorProp('gpu', { requestAdapter: async () => null });

    expect(await primeIblaiRoute(BASE)).toEqual({
      route: 'cloud',
      warm: false,
    });
  });

  it('resolves once per configuration', async () => {
    await primeIblaiRoute(BASE);
    await primeIblaiRoute(BASE);

    expect(mockIsModelCached).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight resolution between concurrent callers', async () => {
    const first = primeIblaiRoute(BASE);
    const second = primeIblaiRoute(BASE);

    await Promise.all([first, second]);

    expect(mockIsModelCached).toHaveBeenCalledTimes(1);
  });

  // The style tensors live in their own cache and are downloaded one voice at
  // a time, so a cached model says nothing about a voice nobody has used yet.
  it('resolves again for a different voice', async () => {
    await primeIblaiRoute(BASE);
    await primeIblaiRoute({ ...BASE, voice: 'bm_george' });

    expect(mockIsModelCached).toHaveBeenCalledTimes(2);
  });

  it('falls back to the cloud when the probe itself throws', async () => {
    mockIsModelCached.mockRejectedValue(new Error('boom'));

    expect(await primeIblaiRoute(BASE)).toEqual({
      route: 'cloud',
      warm: false,
    });
  });
});

describe('peekIblaiRoute', () => {
  // Null is the answer a click gets while the probe is still running, and it
  // means "cloud, for now" -- waiting would cost the click its user gesture.
  it('is null until the decision has resolved', () => {
    void primeIblaiRoute(BASE);
    expect(peekIblaiRoute(BASE)).toBeNull();
  });

  it('reports the resolved route synchronously afterwards', async () => {
    mockIsModelCached.mockResolvedValue(true);
    await primeIblaiRoute(BASE);

    expect(peekIblaiRoute(BASE)).toBe('device');
  });

  it('does not answer for a configuration nobody probed', () => {
    expect(peekIblaiRoute(BASE)).toBeNull();
  });
});

describe('startIblaiWarmUp', () => {
  it('downloads when the device is capable but has nothing cached', async () => {
    await startIblaiWarmUp(BASE);

    expect(mockWarmModelCache).toHaveBeenCalledWith(BASE, 'af_heart');
  });

  // "Cloud until the weights land, then device permanently."
  it('hands the next utterance to the device once the download lands', async () => {
    await startIblaiWarmUp(BASE);

    expect(peekIblaiRoute(BASE)).toBe('device');
  });

  it('stays on the cloud when the download failed', async () => {
    mockWarmModelCache.mockResolvedValue(false);

    await startIblaiWarmUp(BASE);

    expect(peekIblaiRoute(BASE)).toBe('cloud');
  });

  it('downloads nothing when the model is already there', async () => {
    mockIsModelCached.mockResolvedValue(true);

    await startIblaiWarmUp(BASE);

    expect(mockWarmModelCache).not.toHaveBeenCalled();
  });

  it('downloads nothing on a device that could never run it', async () => {
    setNavigatorProp('gpu', { requestAdapter: async () => null });

    await startIblaiWarmUp(BASE);

    expect(mockWarmModelCache).not.toHaveBeenCalled();
  });

  it('resolves the route itself when nothing primed it first', async () => {
    await startIblaiWarmUp(BASE);

    expect(mockIsModelCached).toHaveBeenCalledTimes(1);
  });
});

describe('demoteIblaiRoute', () => {
  it('sends the rest of the session to the cloud after a device failure', async () => {
    mockIsModelCached.mockResolvedValue(true);
    await primeIblaiRoute(BASE);

    demoteIblaiRoute(BASE);

    expect(peekIblaiRoute(BASE)).toBe('cloud');
  });

  it('sticks even against a probe that would have said device', async () => {
    mockIsModelCached.mockResolvedValue(true);
    demoteIblaiRoute(BASE);

    expect(await primeIblaiRoute(BASE)).toEqual({
      route: 'cloud',
      warm: false,
    });
    expect(mockIsModelCached).not.toHaveBeenCalled();
  });
});

describe('resetIblaiRouting', () => {
  it('forgets everything decided so far', async () => {
    mockIsModelCached.mockResolvedValue(true);
    await primeIblaiRoute(BASE);

    resetIblaiRouting();

    expect(peekIblaiRoute(BASE)).toBeNull();
  });
});
