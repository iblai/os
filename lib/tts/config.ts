/**
 * @file config.ts
 * @input `process.env.NEXT_PUBLIC_*` (inlined at build time) and `navigator`.
 * @output A fully-resolved {@link KokoroConfig} describing which model to fetch,
 *   at what precision, on which backend, and where the ONNX Runtime WASM
 *   binaries live.
 * @position Pure-ish resolver on the main thread. `useSpeech` calls it once per
 *   utterance and hands the result to the worker over `postMessage`, so the
 *   worker never has to read `process.env` itself -- which keeps the worker
 *   bundle free of build-time substitution and makes every value here testable.
 *
 * Everything is overridable because production will self-host the weights
 * rather than pull them from the Hugging Face CDN, and the self-hosted repo id
 * is not known at authoring time.
 */

/** ONNX weight precisions `kokoro-js` accepts. */
export type KokoroDtype = 'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16';

/** Execution backends `kokoro-js` accepts in a browser. */
export type KokoroDevice = 'webgpu' | 'wasm';

export type KokoroConfig = {
  /** Hugging Face (or self-hosted, HF-layout) repo id for the ONNX weights. */
  modelId: string;
  /** Origin the weights are served from, no trailing slash. */
  modelHost: string;
  /**
   * Git ref the weights are pinned to. A commit sha rather than `main`, so a
   * force-push to the upstream repo cannot swap ~310 MB of executable model
   * graph under a returning user.
   */
  modelRevision: string;
  dtype: KokoroDtype;
  device: KokoroDevice;
  /** One of `kokoro-js`'s 27 voice ids, e.g. `af_heart`. */
  voice: string;
  speed: number;
  /**
   * Directory the ONNX Runtime `.wasm` / `.mjs` pair is served from. MUST be
   * same-origin: transformers.js defaults this to `https://cdn.jsdelivr.net/`,
   * which this app's CSP `connect-src` blocks. `scripts/copy-ort-assets.sh`
   * copies the binaries into `public/ort/` so the default below resolves.
   */
  wasmPaths: string;
};

const DEFAULT_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DEFAULT_MODEL_HOST = 'https://huggingface.co';

/**
 * `onnx-community/Kokoro-82M-v1.0-ONNX` at the sha this app was verified
 * against. Bump it deliberately, after re-listening: the repo is a third
 * party's, `main` moves, and a model graph is code.
 */
const DEFAULT_MODEL_REVISION = '1939ad2a8e416c0acfeecc08a694d14ef25f2231';

/**
 * Mirrors transformers.js's `DEFAULT_DTYPE_SUFFIX_MAPPING`
 * (`@huggingface/transformers/src/utils/dtypes.js`), restricted to the dtypes
 * {@link KokoroDtype} allows. Drifting from it means
 * {@link resolveModelWeightUrl} names a file the loader never asks for.
 */
const DTYPE_FILE_SUFFIX: Record<KokoroDtype, string> = {
  fp32: '',
  fp16: '_fp16',
  q8: '_quantized',
  q4: '_q4',
  q4f16: '_q4f16',
};

/**
 * The `resolve/main` prefix `kokoro-js` and transformers.js emit when nothing
 * pins them -- the shape {@link pinModelRequestUrl} rewrites.
 */
const UNPINNED_URL = /^https:\/\/huggingface\.co\/(.+?)\/resolve\/main\/(.+)$/;

/**
 * The dtype is picked per backend, because onnxruntime-web's WebGPU execution
 * provider does not evaluate every Kokoro graph correctly.
 *
 * Measured in Chrome against this model -- same sentence, same voice, 24 kHz:
 *
 * | dtype | device | result                                                 |
 * |-------|--------|--------------------------------------------------------|
 * | fp32  | webgpu | correct -- 135,600 samples, matches the CPU run exactly |
 * | q8    | webgpu | WRONG -- 143,400 samples: the duration predictor        |
 * |       |        | diverges, so speech comes out smeared and unintelligible|
 * | fp16  | webgpu | silent -- all-zero output (NaN)                         |
 * | q4f16 | webgpu | silent -- all-zero output (NaN)                         |
 * | q8    | wasm   | correct -- matches the CPU run exactly                  |
 *
 * So fp32 on WebGPU (~310 MB) and q8 on WASM (~88 MB): the quantized weights
 * are only trustworthy on the CPU backend. `NEXT_PUBLIC_TTS_KOKORO_DTYPE`
 * overrides this once a newer onnxruntime-web fixes the WebGPU int8 path --
 * re-measure the sample count before trusting it, since the failure is silent.
 */
const DEFAULT_DTYPE_BY_DEVICE: Record<KokoroDevice, KokoroDtype> = {
  webgpu: 'fp32',
  wasm: 'q8',
};

const DEFAULT_VOICE = 'af_heart';
const DEFAULT_SPEED = 1;

const VALID_DTYPES: readonly string[] = [
  'fp32',
  'fp16',
  'q8',
  'q4',
  'q4f16',
] as const;

/**
 * WebGPU when the browser exposes it, WASM otherwise.
 *
 * There is no COOP/COEP on this app, so there is no `SharedArrayBuffer` and the
 * WASM backend runs single-threaded -- on a long message it can generate slower
 * than realtime. That is survivable: `StreamPlayer` schedules each chunk at
 * `max(cursor, currentTime)`, so losing the race costs a seam, not correctness.
 */
const VALID_DEVICES: readonly string[] = ['webgpu', 'wasm'] as const;

/**
 * `NEXT_PUBLIC_TTS_KOKORO_DEVICE` pins the backend, overriding detection.
 *
 * Worth having beyond debugging: WebGPU inference contends with the compositor
 * for the same GPU, so while a chunk generates the browser cannot draw. That
 * shows up as ~1s freezes during scrolling, with no long tasks on the main
 * thread -- it is not JS blocking, so no amount of moving work off-thread
 * helps. A deployment that values a smooth UI over generation speed can force
 * `wasm` here.
 */
function detectDevice(): KokoroDevice {
  const raw = process.env.NEXT_PUBLIC_TTS_KOKORO_DEVICE?.trim();
  if (raw && VALID_DEVICES.includes(raw)) return raw as KokoroDevice;

  return typeof navigator !== 'undefined' && 'gpu' in navigator
    ? 'webgpu'
    : 'wasm';
}

function readDtype(device: KokoroDevice): KokoroDtype {
  const raw = process.env.NEXT_PUBLIC_TTS_KOKORO_DTYPE?.trim();
  return raw && VALID_DTYPES.includes(raw)
    ? (raw as KokoroDtype)
    : DEFAULT_DTYPE_BY_DEVICE[device];
}

function readSpeed(): number {
  const parsed = Number(process.env.NEXT_PUBLIC_TTS_KOKORO_SPEED);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SPEED;
}

/**
 * Trailing slash is required -- onnxruntime-web concatenates the file name onto
 * this string without inserting one.
 */
function readWasmPaths(): string {
  const configured = process.env.NEXT_PUBLIC_TTS_KOKORO_WASM_PATH?.trim();
  const base =
    configured || `${process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''}/ort`;
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Precedence for the voice: what the mentor is configured with, then the
 * deployment default, then Kokoro's best-graded voice.
 *
 * The mentor's value wins over the env var because the env var is a
 * deployment-wide fallback for mentors that have never had a voice chosen --
 * letting it override an explicit per-mentor choice would make the picker
 * silently ineffective.
 */
function readVoice(selected?: string | null): string {
  return (
    selected?.trim() ||
    process.env.NEXT_PUBLIC_TTS_KOKORO_VOICE?.trim() ||
    DEFAULT_VOICE
  );
}

/**
 * Origin the weights come from, normalised to a bare `scheme://host[:port]`.
 *
 * Exported because `middleware.ts` derives the CSP `connect-src` entry from it:
 * repointing this at a self-hosted mirror has to widen the policy in the same
 * step, or the fetch is blocked and the voice silently never starts.
 *
 * A bare host is accepted (and assumed https) because that is the shape people
 * paste; anything unparseable falls back rather than emitting a URL that would
 * 404 halfway through a 310 MB download.
 */
export function resolveModelHost(): string {
  const raw = process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_HOST?.trim();
  if (!raw) return DEFAULT_MODEL_HOST;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return DEFAULT_MODEL_HOST;
  }
}

function readModelRevision(): string {
  return (
    process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL_REVISION?.trim() ||
    DEFAULT_MODEL_REVISION
  );
}

/** `{host}/{model}/resolve/{revision}`, the prefix every model file hangs off. */
function modelBaseUrl(config: KokoroConfig): string {
  return `${config.modelHost}/${config.modelId}/resolve/${config.modelRevision}`;
}

/**
 * The one place the weight URL is spelled out.
 *
 * Callers that need to know whether the download has already happened -- a
 * `caches.match` probe against `transformers-cache`, say -- must ask here
 * rather than rebuild the string, because the dtype-to-filename mapping is
 * transformers.js's, not ours.
 */
export function resolveModelWeightUrl(config: KokoroConfig): string {
  return `${modelBaseUrl(config)}/onnx/model${DTYPE_FILE_SUFFIX[config.dtype]}.onnx`;
}

/**
 * Redirects an unpinned Hugging Face request onto the configured host and
 * revision, leaving everything else untouched.
 *
 * This exists because neither library offers a supported hook. `kokoro-js`
 * 1.2.1 destructures `from_pretrained`'s options down to `{dtype, device,
 * progress_callback}` and drops `revision` on the floor, and the `env` it
 * re-exports proxies only `wasmPaths` -- transformers.js's `remoteHost` /
 * `remotePathTemplate` are unreachable from an app that (under pnpm) cannot
 * import `@huggingface/transformers` directly. Rewriting the request is the
 * only remaining seam, and it is the only one that also covers the voice
 * tensors, whose URL `kokoro-js` hard-codes to `resolve/main`.
 */
export function pinModelRequestUrl(url: string, config: KokoroConfig): string {
  const match = UNPINNED_URL.exec(url);
  return match ? `${modelBaseUrl(config)}/${match[2]}` : url;
}

export function resolveKokoroConfig(
  selectedVoice?: string | null,
): KokoroConfig {
  const device = detectDevice();
  return {
    modelId:
      process.env.NEXT_PUBLIC_TTS_KOKORO_MODEL?.trim() || DEFAULT_MODEL_ID,
    modelHost: resolveModelHost(),
    modelRevision: readModelRevision(),
    dtype: readDtype(device),
    device,
    voice: readVoice(selectedVoice),
    speed: readSpeed(),
    wasmPaths: readWasmPaths(),
  };
}

/**
 * Where the ibl.ai voice is synthesised. Both halves run the same Kokoro model
 * and the same voices; the difference is which machine does the arithmetic.
 *
 * `auto` is the default and the only mode a deployment normally wants. It
 * serves the first utterances from the backend -- no download, ~4s to audio --
 * while the weights come down in the background, and switches to the browser
 * permanently once they land. Devices that could never run the model well
 * (iOS, where WebKit kills the tab; anything without a WebGPU adapter, where
 * the WASM backend generates at ~0.5x realtime) simply stay on the cloud, and
 * never download anything. The arbitration lives in `lib/tts/iblai-routing.ts`.
 *
 * `cloud` and `device` pin one half, for debugging and for testing the path
 * the arbiter would not have chosen -- `device` is the only way to reach the
 * WASM backend, which `auto` deliberately never selects.
 */
export type IblaiMode = 'auto' | 'cloud' | 'device';

const VALID_IBLAI_MODES: readonly string[] = [
  'auto',
  'cloud',
  'device',
] as const;

export function resolveIblaiMode(): IblaiMode {
  const raw = process.env.NEXT_PUBLIC_TTS_IBLAI_MODE?.trim();
  return raw && VALID_IBLAI_MODES.includes(raw) ? (raw as IblaiMode) : 'auto';
}

type NavigatorWithGpu = Navigator & {
  gpu?: { requestAdapter(): Promise<unknown | null> };
};

/**
 * Whether WebGPU will actually hand out an adapter, not merely whether the API
 * object exists.
 *
 * The distinction matters: `navigator.gpu` is present on blocklisted GPUs and
 * on browsers that expose the API while denying the hardware, and `kokoro-js`
 * given `device: 'webgpu'` there fails the whole utterance instead of
 * degrading. Probing up front turns that failure into a clean fall-back to
 * WASM (see {@link downgradeToWasm}).
 */
export async function probeWebGpu(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const gpu = (navigator as NavigatorWithGpu).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

/**
 * The same config re-targeted at the WASM backend. The dtype is re-derived for
 * the new device -- q8 by default, since fp32 would mean the 310 MB download on
 * the one backend that gains nothing from it -- while still honouring an
 * explicit `NEXT_PUBLIC_TTS_KOKORO_DTYPE` override.
 */
export function downgradeToWasm(config: KokoroConfig): KokoroConfig {
  return { ...config, device: 'wasm', dtype: readDtype('wasm') };
}

/**
 * True on iOS and iPadOS whatever the browser -- Apple requires every iOS
 * browser (Chrome and Firefox included) to run on WebKit, so an engine-level
 * failure reproduces across all of them.
 *
 * On-device synthesis is disabled on these devices: WebKit enforces a per-tab
 * memory ceiling and kills the page outright when the model crosses it -- a
 * crash JavaScript cannot catch, observed as a reload loop on an iPhone 12
 * Pro Max in Safari and Chrome alike. The system voice (`speechSynthesis`,
 * Siri-backed on iOS) is the graceful floor.
 *
 * iPadOS 13+ masquerades as macOS in the user agent; the giveaway is that no
 * real Mac reports touch points.
 */
export function isIosWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}
