import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  downgradeToWasm,
  isIosWebKit,
  pinModelRequestUrl,
  probeWebGpu,
  resolveIblaiMode,
  resolveKokoroConfig,
  resolveModelHost,
  resolveModelWeightUrl,
} from '../config';

const ENV_KEYS = [
  'NEXT_PUBLIC_TTS_IBLAI_MODE',
  'NEXT_PUBLIC_TTS_KOKORO_MODEL',
  'NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST',
  'NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION',
  'NEXT_PUBLIC_TTS_KOKORO_DTYPE',
  'NEXT_PUBLIC_TTS_KOKORO_DEVICE',
  'NEXT_PUBLIC_TTS_KOKORO_VOICE',
  'NEXT_PUBLIC_TTS_KOKORO_SPEED',
  'NEXT_PUBLIC_TTS_KOKORO_WASM_PATH',
  'NEXT_PUBLIC_BASE_PATH',
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function setGpu(present: boolean) {
  if (present) {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });
  } else {
    Reflect.deleteProperty(navigator, 'gpu');
  }
}

beforeEach(() => {
  clearEnv();
  setGpu(false);
});

afterEach(() => {
  clearEnv();
  setGpu(false);
  vi.restoreAllMocks();
});

describe('resolveKokoroConfig', () => {
  describe('defaults', () => {
    it('falls back to the public Kokoro repo at q8 on wasm', () => {
      expect(resolveKokoroConfig()).toEqual({
        modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
        modelHost: 'https://huggingface.co',
        modelRevision: '1939ad2a8e416c0acfeecc08a694d14ef25f2231',
        dtype: 'q8',
        device: 'wasm',
        voice: 'af_heart',
        speed: 1,
        wasmPaths: '/ort/',
      });
    });

    it('uses q8 on wasm, where quantized weights evaluate correctly', () => {
      expect(resolveKokoroConfig().dtype).toBe('q8');
    });
  });

  describe('backend detection', () => {
    it('prefers WebGPU when the browser exposes it', () => {
      setGpu(true);
      expect(resolveKokoroConfig().device).toBe('webgpu');
    });

    it('falls back to wasm without navigator.gpu', () => {
      expect(resolveKokoroConfig().device).toBe('wasm');
    });

    // Measured in Chrome: q8 on WebGPU produces 143,400 samples for a sentence
    // that every other backend renders as 135,600 — the duration predictor
    // diverges and the speech comes out garbled. fp16 and q4f16 return silence.
    // fp32 is the only WebGPU dtype that matches the CPU output.
    it('upgrades to fp32 on WebGPU, where quantized graphs evaluate wrongly', () => {
      setGpu(true);
      expect(resolveKokoroConfig().dtype).toBe('fp32');
    });

    it('still honours an explicit dtype override on WebGPU', () => {
      setGpu(true);
      process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE = 'q8';
      expect(resolveKokoroConfig().dtype).toBe('q8');
    });
  });

  describe('device override', () => {
    it('pins the backend when configured', () => {
      setGpu(true);
      process.env.NEXT_PUBLIC_TTS_KOKORO_DEVICE = 'wasm';
      const config = resolveKokoroConfig();
      expect(config.device).toBe('wasm');
      // and the dtype follows the forced device, not the detected one
      expect(config.dtype).toBe('q8');
    });

    it('can force WebGPU on a browser that does not advertise it', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_DEVICE = 'webgpu';
      expect(resolveKokoroConfig().device).toBe('webgpu');
    });

    it('ignores a value that is not a backend', () => {
      setGpu(true);
      process.env.NEXT_PUBLIC_TTS_KOKORO_DEVICE = 'cuda';
      expect(resolveKokoroConfig().device).toBe('webgpu');
    });

    it('ignores a blank override', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_DEVICE = '   ';
      expect(resolveKokoroConfig().device).toBe('wasm');
    });
  });

  describe('model source', () => {
    it('uses a self-hosted repo id when configured', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL = '  acme/kokoro-selfhosted  ';
      expect(resolveKokoroConfig().modelId).toBe('acme/kokoro-selfhosted');
    });

    it('ignores a blank override', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL = '   ';
      expect(resolveKokoroConfig().modelId).toBe(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
      );
    });

    it('carries the host and revision the worker will download from', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST =
        'https://weights.acme.dev';
      process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION = '  v2  ';
      const config = resolveKokoroConfig();
      expect(config.modelHost).toBe('https://weights.acme.dev');
      expect(config.modelRevision).toBe('v2');
    });

    it('ignores a blank revision override', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION = '   ';
      expect(resolveKokoroConfig().modelRevision).toBe(
        '1939ad2a8e416c0acfeecc08a694d14ef25f2231',
      );
    });
  });

  describe('dtype', () => {
    it.each(['fp32', 'fp16', 'q8', 'q4', 'q4f16'])('accepts %s', (dtype) => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE = dtype;
      expect(resolveKokoroConfig().dtype).toBe(dtype);
    });

    it('rejects a value kokoro-js would not understand', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE = 'int3';
      expect(resolveKokoroConfig().dtype).toBe('q8');
    });

    it('rejects a blank value', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE = '  ';
      expect(resolveKokoroConfig().dtype).toBe('q8');
    });
  });

  describe('voice', () => {
    it('is overridable', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_VOICE = 'bm_george';
      expect(resolveKokoroConfig().voice).toBe('bm_george');
    });

    it('ignores a blank override', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_VOICE = '';
      expect(resolveKokoroConfig().voice).toBe('af_heart');
    });
  });

  describe('selected voice', () => {
    it("uses the mentor's chosen voice", () => {
      expect(resolveKokoroConfig('bm_george').voice).toBe('bm_george');
    });

    // The env var is a deployment-wide fallback for mentors that have never
    // had a voice chosen; letting it win would make the picker ineffective.
    it("prefers the mentor's voice over the deployment default", () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_VOICE = 'af_bella';
      expect(resolveKokoroConfig('bm_george').voice).toBe('bm_george');
    });

    it('falls back to the deployment default when no voice is chosen', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_VOICE = 'af_bella';
      expect(resolveKokoroConfig(null).voice).toBe('af_bella');
      expect(resolveKokoroConfig(undefined).voice).toBe('af_bella');
    });

    it('ignores a blank selection', () => {
      expect(resolveKokoroConfig('   ').voice).toBe('af_heart');
    });
  });

  describe('speed', () => {
    it('is overridable', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_SPEED = '1.25';
      expect(resolveKokoroConfig().speed).toBe(1.25);
    });

    it('rejects a non-numeric value', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_SPEED = 'fast';
      expect(resolveKokoroConfig().speed).toBe(1);
    });

    it('rejects zero and negatives, which would produce no audio', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_SPEED = '0';
      expect(resolveKokoroConfig().speed).toBe(1);
      process.env.NEXT_PUBLIC_TTS_KOKORO_SPEED = '-2';
      expect(resolveKokoroConfig().speed).toBe(1);
    });
  });

  describe('wasmPaths', () => {
    // onnxruntime-web concatenates the file name onto this string, so a missing
    // trailing slash silently produces `/ortort-wasm...` and a 404.
    it('appends the trailing slash onnxruntime-web requires', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_WASM_PATH = '/static/ort';
      expect(resolveKokoroConfig().wasmPaths).toBe('/static/ort/');
    });

    it('keeps a trailing slash that is already there', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_WASM_PATH = '/static/ort/';
      expect(resolveKokoroConfig().wasmPaths).toBe('/static/ort/');
    });

    it('honours the app basePath so the assets stay same-origin', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/mentor';
      expect(resolveKokoroConfig().wasmPaths).toBe('/mentor/ort/');
    });

    it('prefers an explicit override over the basePath', () => {
      process.env.NEXT_PUBLIC_BASE_PATH = '/mentor';
      process.env.NEXT_PUBLIC_TTS_KOKORO_WASM_PATH = '/elsewhere/ort/';
      expect(resolveKokoroConfig().wasmPaths).toBe('/elsewhere/ort/');
    });

    it('ignores a blank override', () => {
      process.env.NEXT_PUBLIC_TTS_KOKORO_WASM_PATH = '  ';
      expect(resolveKokoroConfig().wasmPaths).toBe('/ort/');
    });
  });

  describe('server-side rendering', () => {
    it('resolves without a navigator', () => {
      const original = globalThis.navigator;
      // @ts-expect-error deliberately simulating a non-browser global scope
      delete globalThis.navigator;
      try {
        expect(resolveKokoroConfig().device).toBe('wasm');
      } finally {
        Object.defineProperty(globalThis, 'navigator', {
          configurable: true,
          value: original,
        });
      }
    });
  });
});

describe('resolveModelHost', () => {
  it('defaults to the Hugging Face hub', () => {
    expect(resolveModelHost()).toBe('https://huggingface.co');
  });

  it('normalises away a path and a trailing slash', () => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST =
      'https://weights.acme.dev/models/';
    expect(resolveModelHost()).toBe('https://weights.acme.dev');
  });

  it('keeps an explicit port', () => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST = 'http://localhost:8080';
    expect(resolveModelHost()).toBe('http://localhost:8080');
  });

  // A bare host is the shape people paste, and the CSP entry is derived from
  // whatever comes back here -- an unparseable origin would drop it silently.
  it('assumes https for a bare host', () => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST = 'weights.acme.dev';
    expect(resolveModelHost()).toBe('https://weights.acme.dev');
  });

  it('falls back rather than return something unparseable', () => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST = 'https://';
    expect(resolveModelHost()).toBe('https://huggingface.co');
  });

  it('ignores a blank override', () => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST = '   ';
    expect(resolveModelHost()).toBe('https://huggingface.co');
  });
});

describe('resolveModelWeightUrl', () => {
  it('names the pinned fp32 weights WebGPU downloads', () => {
    setGpu(true);
    expect(resolveModelWeightUrl(resolveKokoroConfig())).toBe(
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/onnx/model.onnx',
    );
  });

  // The suffixes are transformers.js's (`DEFAULT_DTYPE_SUFFIX_MAPPING`), not
  // ours: a cache probe against the wrong filename reports a miss forever.
  it.each([
    ['fp32', 'model.onnx'],
    ['fp16', 'model_fp16.onnx'],
    ['q8', 'model_quantized.onnx'],
    ['q4', 'model_q4.onnx'],
    ['q4f16', 'model_q4f16.onnx'],
  ])('maps %s to %s', (dtype, file) => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE = dtype;
    expect(resolveModelWeightUrl(resolveKokoroConfig())).toMatch(
      new RegExp(`/onnx/${file.replace('.', '\\.')}$`),
    );
  });

  it('follows a self-hosted host, repo and revision', () => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST = 'https://weights.acme.dev';
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL = 'acme/kokoro';
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION = 'v2';
    expect(resolveModelWeightUrl(resolveKokoroConfig())).toBe(
      'https://weights.acme.dev/acme/kokoro/resolve/v2/onnx/model_quantized.onnx',
    );
  });
});

describe('pinModelRequestUrl', () => {
  // What `kokoro-js` 1.2.1 emits: it drops `revision` from from_pretrained's
  // options, so transformers.js falls through to `main`.
  it('pins an unpinned weight request to the configured revision', () => {
    expect(
      pinModelRequestUrl(
        'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx',
        resolveKokoroConfig(),
      ),
    ).toBe(
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/onnx/model_quantized.onnx',
    );
  });

  // The one thing no transformers.js setting could have fixed: `kokoro-js`
  // hard-codes the voice tensor URL, hub and revision included.
  it('pins the hard-coded voice tensors too', () => {
    expect(
      pinModelRequestUrl(
        'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/af_heart.bin',
        resolveKokoroConfig(),
      ),
    ).toBe(
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/voices/af_heart.bin',
    );
  });

  it('re-homes the request when the weights are self-hosted', () => {
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST = 'https://weights.acme.dev';
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL = 'acme/kokoro';
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION = 'v2';
    expect(
      pinModelRequestUrl(
        'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer.json',
        resolveKokoroConfig(),
      ),
    ).toBe('https://weights.acme.dev/acme/kokoro/resolve/v2/tokenizer.json');
  });

  it('leaves an already-pinned request alone', () => {
    const pinned =
      'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/1939ad2a8e416c0acfeecc08a694d14ef25f2231/onnx/model.onnx';
    expect(pinModelRequestUrl(pinned, resolveKokoroConfig())).toBe(pinned);
  });

  // The worker patches its own `fetch`, so everything else the page does must
  // pass through untouched.
  it('leaves unrelated requests alone', () => {
    const config = resolveKokoroConfig();
    expect(pinModelRequestUrl('/ort/ort-wasm-simd-threaded.wasm', config)).toBe(
      '/ort/ort-wasm-simd-threaded.wasm',
    );
    expect(
      pinModelRequestUrl('https://api.iblai.app/v1/whatever', config),
    ).toBe('https://api.iblai.app/v1/whatever');
  });
});

/** Installs a `navigator.gpu` whose `requestAdapter` behaves as specified. */
function setGpuAdapter(requestAdapter: () => Promise<unknown | null>) {
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: { requestAdapter },
  });
}

describe('probeWebGpu', () => {
  it('is true only when an adapter is actually granted', async () => {
    setGpuAdapter(async () => ({}));
    await expect(probeWebGpu()).resolves.toBe(true);
  });

  // The API being present is not the same thing as the hardware being
  // available: blocklisted GPUs expose `navigator.gpu` and then refuse.
  it('is false when the adapter request is refused', async () => {
    setGpuAdapter(async () => null);
    await expect(probeWebGpu()).resolves.toBe(false);
  });

  it('is false when the adapter request throws', async () => {
    setGpuAdapter(() => Promise.reject(new Error('denied')));
    await expect(probeWebGpu()).resolves.toBe(false);
  });

  it('is false without the API at all', async () => {
    await expect(probeWebGpu()).resolves.toBe(false);
  });

  it('is false without a navigator (server side)', async () => {
    const original = globalThis.navigator;
    // @ts-expect-error deliberately simulating a non-browser global scope
    delete globalThis.navigator;
    try {
      await expect(probeWebGpu()).resolves.toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: original,
      });
    }
  });
});

describe('downgradeToWasm', () => {
  it('re-targets the backend and re-derives the dtype for it', () => {
    setGpu(true);
    const config = downgradeToWasm(resolveKokoroConfig());
    expect(config.device).toBe('wasm');
    // Not the webgpu default fp32: that would be the 310 MB download on the
    // one backend that gains nothing from it.
    expect(config.dtype).toBe('q8');
  });

  it('keeps everything else, including an explicit dtype override', () => {
    setGpu(true);
    process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE = 'q4';
    process.env.NEXT_PUBLIC_TTS_KOKORO_VOICE = 'bm_george';
    const config = downgradeToWasm(resolveKokoroConfig());
    expect(config.dtype).toBe('q4');
    expect(config.voice).toBe('bm_george');
  });
});

describe('isIosWebKit', () => {
  function setUserAgent(userAgent: string, maxTouchPoints = 0) {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: userAgent,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: maxTouchPoints,
    });
  }

  it('detects an iPhone, whatever the browser shell', () => {
    // CriOS is Chrome-on-iOS -- still WebKit, still subject to the tab kill.
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) CriOS/125.0',
      5,
    );
    expect(isIosWebKit()).toBe(true);
  });

  it('detects an iPad that admits to being one', () => {
    setUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) Safari/605.1',
      5,
    );
    expect(isIosWebKit()).toBe(true);
  });

  // iPadOS 13+ reports itself as a Mac; touch points are the tell.
  it('detects an iPad masquerading as macOS', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1',
      5,
    );
    expect(isIosWebKit()).toBe(true);
  });

  it('leaves a real Mac alone', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1',
      0,
    );
    expect(isIosWebKit()).toBe(false);
  });

  it('leaves everything else alone', () => {
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0', 0);
    expect(isIosWebKit()).toBe(false);
  });

  it('is false without a navigator (server side)', () => {
    const original = globalThis.navigator;
    // @ts-expect-error deliberately simulating a non-browser global scope
    delete globalThis.navigator;
    try {
      expect(isIosWebKit()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: original,
      });
    }
  });
});

describe('resolveIblaiMode', () => {
  // The arbiter decides per utterance: the backend answers immediately while
  // the weights download, then the browser takes over. Neither pinned mode is
  // a sensible deployment default.
  it('arbitrates by default', () => {
    expect(resolveIblaiMode()).toBe('auto');
  });

  it('can be pinned to the backend', () => {
    process.env.NEXT_PUBLIC_TTS_IBLAI_MODE = 'cloud';
    expect(resolveIblaiMode()).toBe('cloud');
  });

  // The only way to reach the WASM backend, which `auto` never selects.
  it('can be pinned to the browser, where no message text leaves the device', () => {
    process.env.NEXT_PUBLIC_TTS_IBLAI_MODE = 'device';
    expect(resolveIblaiMode()).toBe('device');
  });

  it('falls back to auto on a value that is not a mode', () => {
    process.env.NEXT_PUBLIC_TTS_IBLAI_MODE = 'onprem';
    expect(resolveIblaiMode()).toBe('auto');
  });

  it('ignores a blank override', () => {
    process.env.NEXT_PUBLIC_TTS_IBLAI_MODE = '   ';
    expect(resolveIblaiMode()).toBe('auto');
  });
});
