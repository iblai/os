/**
 * @file kokoro.worker.ts
 * @input `KokoroGenerateRequest` / `KokoroCancelRequest` messages carrying the
 *   already-markdown-stripped plain text and a fully-resolved `KokoroConfig`.
 * @output A `plan` message, then one `chunk` message per synthesised segment
 *   (PCM transferred, not copied), then a `complete` message carrying the whole
 *   utterance as a single WAV blob. `error` on any failure.
 * @position The off-main-thread half of the on-device TTS pipeline. Runs
 *   `kokoro-js` (Transformers.js + onnxruntime-web). Talks to `useSpeech`; knows
 *   nothing about React, markdown, or the audio graph.
 *
 * Three constraints shape this file.
 *
 * 1. ONNX inference is *synchronous* once it enters WASM/WebGPU. On the main
 *    thread a single chunk freezes the UI for seconds, so this must be a Worker.
 * 2. `kokoro-js` is dynamically `import()`ed rather than imported at the top, so
 *    the Transformers.js runtime is fetched only by users whose mentor is
 *    actually configured for the on-device voice, and never enters the main
 *    bundle at all.
 * 3. Kokoro has a fixed ~510-phoneme-token context and `generate()` calls the
 *    tokenizer with `truncation: true`. Anything past the limit is *silently
 *    discarded* -- no error, no warning, the tail of the message simply never
 *    gets spoken. Hence {@link chunkText}, which is not an optimisation but a
 *    correctness requirement.
 */

import type { KokoroConfig } from './config';

/**
 * Phonemes per chunk.
 *
 * This is a deliberate departure from the reference implementation
 * (hexgrad/kokoro, `KPipeline.en_tokenize`), which fills to the model's full
 * 510-phoneme context before cutting. Kokoro's output degrades *within* a
 * single generation: a chunk starts clean and grows progressively muffled
 * toward its end, then recovers when the next chunk begins. Chunk length is
 * therefore the window over which that drift accumulates, and filling to 510
 * maximises it.
 *
 * 150 was chosen by listening, sweeping 510 -> 300 -> 250 -> 200 -> 150 over a
 * two-page assistant reply. The cost is more seams -- ~32 chunks instead of 10
 * for that document -- which is a good trade here because the joins are
 * inaudible while the muffling is not.
 *
 * Phonemes, not characters: English runs ~1.079 phonemes per character, so a
 * character budget is a guess. Counting the phonemes removes it.
 */
const MAX_CHUNK_PHONEMES = 150;

/**
 * Measured English phoneme density: 1.079 phonemes per character across sample
 * assistant replies, ranging 1.00-1.14. Used only to estimate pieces that were
 * not phonemised up front.
 */
const PHONEMES_PER_CHAR = 1.079;

/**
 * Fallback character budget, used only when phonemisation is unavailable.
 * {@link MAX_CHUNK_PHONEMES} / 1.14 (the densest ratio measured), rounded down.
 */
const FALLBACK_CHUNK_CHARS = 130;

/** Kokoro's output rate; the seed value before the first chunk reports its own. */
const DEFAULT_SAMPLING_RATE = 24000;

/**
 * Minimum generation speed, as a multiple of playback speed, for the WASM
 * backend to be worth using at all.
 *
 * Without COOP/COEP the WASM backend is single-threaded, and on the machines
 * measured it generates at ~0.5x realtime -- meaning playback drains the
 * buffer twice as fast as generation refills it, and the listener hears a
 * pause before every chunk that grows with the message. No buffering strategy
 * beats a sub-realtime generator, so the first chunk doubles as a benchmark:
 * if it comes out slower than this floor, the utterance is abandoned *before
 * any audio is scheduled* and the caller falls back to the system voice. The
 * 1.1 (rather than 1.0) leaves headroom for per-chunk variance -- a generator
 * that exactly keeps pace still seams on any hiccup.
 */
const MIN_WASM_REALTIME = 1.1;

/**
 * How much audio to keep generated-but-unplayed before pausing generation.
 *
 * Generating flat-out is what made WebGPU playback freeze the page: inference
 * saturates the GPU for the whole generation window (measured 13.5s of frozen
 * frames in 30s of scrolling), even though playback only needs a new chunk
 * every few seconds. Pacing to this buffer keeps the same gapless audio while
 * cutting GPU duty to roughly `1 / realtimeFactor` -- an occasional hitch
 * instead of a frozen page. Two chunks' worth: wide enough that a slow chunk
 * cannot drain it, small enough that the GPU idles most of the time.
 */
const BUFFER_AHEAD_SECONDS = 15;

/** How often the pacing wait re-checks progress and cancellation. */
const PACE_TICK_MS = 250;

const WAV_HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

// ---------------------------------------------------------------------------
// Message protocol
// ---------------------------------------------------------------------------

export type KokoroGenerateRequest = {
  type: 'generate';
  /** Echoed on every response so a superseded reply can be discarded. */
  requestId: number;
  text: string;
  config: KokoroConfig;
};

export type KokoroCancelRequest = { type: 'cancel' };

export type KokoroRequest = KokoroGenerateRequest | KokoroCancelRequest;

export type KokoroResponse =
  | { type: 'plan'; requestId: number; total: number }
  | {
      type: 'chunk';
      requestId: number;
      index: number;
      total: number;
      pcm: Float32Array;
      samplingRate: number;
    }
  | { type: 'complete'; requestId: number; blob: Blob }
  | { type: 'error'; requestId: number; message: string };

/**
 * The slice of the worker global this file uses. Declared structurally rather
 * than via `/// <reference lib="webworker" />`, which cannot coexist with the
 * project's `dom` lib without duplicate-identifier errors.
 */
type WorkerScope = {
  postMessage(message: KokoroResponse, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
  ): void;
};

function post(message: KokoroResponse, transfer?: Transferable[]): void {
  (self as unknown as WorkerScope).postMessage(message, transfer);
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

type KokoroModule = typeof import('kokoro-js');
type SentenceSplitter = KokoroModule['TextSplitterStream'];
type KokoroTts = Awaited<
  ReturnType<KokoroModule['KokoroTTS']['from_pretrained']>
>;
type GenerateOptions = NonNullable<Parameters<KokoroTts['generate']>[1]>;

/**
 * Breaks a single sentence that is itself over-long on word boundaries.
 *
 * A last resort: the seam is audible because it lands mid-thought. It only
 * triggers on text with no punctuation at all for a whole chunk's worth -- a
 * pasted URL list, a run-on generated line.
 */
export function splitLongSentence(
  sentence: string,
  budget = FALLBACK_CHUNK_CHARS,
): string[] {
  const parts: string[] = [];
  let current = '';
  for (const word of sentence.split(/\s+/)) {
    if (!word) continue;
    if (current && current.length + 1 + word.length > budget) {
      parts.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Priority order for choosing a cut point, copied from the reference
 * implementation's `waterfall_last`. Sentence ends are preferred; failing that
 * a clause break; failing that a comma. Cutting at the highest available tier
 * is what keeps the seam from landing mid-thought.
 */
const CUT_WATERFALL = ['.!?…', ':;', ',—'];

/** Last index in `units` that ends at the best available punctuation tier. */
export function waterfallCut(units: string[]): number {
  // Units are trimmed and non-empty by the time they reach here, so every one
  // of them has a last character.
  for (const tier of CUT_WATERFALL) {
    for (let i = units.length - 1; i > 0; i -= 1) {
      if (tier.includes(units[i - 1].slice(-1))) return i;
    }
  }
  return units.length;
}

/**
 * Sentence-splits `text`, then greedily packs whole sentences into chunks of at
 * most {@link MAX_CHUNK_CHARS}.
 *
 * Packing rather than emitting one chunk per sentence matters twice over: each
 * `generate()` call carries fixed overhead, and Kokoro computes prosody per
 * call, so a chunk holding several sentences sounds like one breath instead of
 * several disconnected ones. Cutting only at full stops is what makes the seams
 * inaudible -- the listener hears a sentence boundary, which is where they
 * expect a pause anyway.
 *
 * The splitter class is injected rather than imported so this stays a pure
 * function: `kokoro-js` only exists after the dynamic import resolves.
 */
export function chunkText(
  text: string,
  Splitter: SentenceSplitter,
  /**
   * Phoneme count for a piece of text. Injected so this stays a pure function
   * and so the character fallback can be exercised directly. When omitted,
   * lengths are estimated from characters.
   */
  countPhonemes?: (piece: string) => number,
): string[] {
  const splitter = new Splitter();
  splitter.push(text);
  splitter.close();

  const budget = countPhonemes ? MAX_CHUNK_PHONEMES : FALLBACK_CHUNK_CHARS;
  const measure = countPhonemes ?? ((piece: string) => piece.length);

  const units = [...splitter]
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')
    .flatMap((sentence) =>
      measure(sentence) > budget
        ? splitLongSentence(
            sentence,
            countPhonemes
              ? // convert the phoneme budget back to characters for the
                // word-level fallback, using this sentence's own density
                Math.max(
                  1,
                  Math.floor((budget * sentence.length) / measure(sentence)),
                )
              : budget,
          )
        : [sentence],
    );

  // Pack toward an even target rather than filling to the brim.
  //
  // Filling greedily leaves the remainder in a stub, and at this budget those
  // get tiny. Chunk length selects the voice's style vector -- af_heart's
  // 40-phoneme vector is only 0.83 similar to its 150-phoneme one -- so a stub
  // beside a full chunk is audible as the *speaker* changing, a different
  // defect from the muffling the small budget is there to avoid.
  const total = units.reduce((n, u) => n + measure(u) + 1, -1);
  const chunkCount = Math.max(1, Math.ceil(total / budget));
  const target = Math.ceil(total / chunkCount);

  const chunks: string[] = [];
  let pending: string[] = [];
  let pendingCount = 0;

  // `waterfallCut` always returns at least 1, and this only runs with units
  // pending, so the slice is never empty.
  const flush = (upTo: number) => {
    chunks.push(pending.slice(0, upTo).join(' '));
    pending = pending.slice(upTo);
    pendingCount = pending.reduce((n, u) => n + measure(u) + 1, -1);
    if (pendingCount < 0) pendingCount = 0;
  };

  for (const unit of units) {
    const next = pendingCount + (pending.length ? 1 : 0) + measure(unit);
    if (pending.length && next > target) flush(waterfallCut(pending));
    pending.push(unit);
    pendingCount = pendingCount + (pendingCount ? 1 : 0) + measure(unit);
  }
  if (pending.length) chunks.push(pending.join(' '));

  return mergeStubs(chunks, target, budget, measure);
}

/**
 * Folds under-sized chunks into a neighbour.
 *
 * Packing alone cannot even out chunk sizes, because the units are whole
 * sentences and real prose varies wildly -- a two-page reply produced chunks
 * from 15 to 154 characters before this ran, and 46 to 154 after. The small end
 * is what matters: see the style-vector note above.
 */
export function mergeStubs(
  chunks: string[],
  target: number,
  budget: number,
  measure: (piece: string) => number,
): string[] {
  const floor = target * 0.45;
  const out = [...chunks];

  for (let i = 0; i < out.length; i += 1) {
    if (out.length < 2 || measure(out[i]) >= floor) continue;

    const previous = i > 0 ? i - 1 : -1;
    const next = i < out.length - 1 ? i + 1 : -1;
    const fits = (j: number) =>
      j >= 0 && measure(`${out[j]} ${out[i]}`) <= budget;

    // Prefer the smaller neighbour, so merging does not create a new outlier.
    let into = -1;
    if (fits(previous) && fits(next)) {
      into = measure(out[previous]) <= measure(out[next]) ? previous : next;
    } else if (fits(previous)) {
      into = previous;
    } else if (fits(next)) {
      into = next;
    }
    if (into === -1) continue;

    out[into] = into < i ? `${out[into]} ${out[i]}` : `${out[i]} ${out[into]}`;
    out.splice(i, 1);
    // Re-examine from before the merge: the merged chunk may itself be short.
    i = Math.max(-1, i - 2);
  }
  return out;
}

// ---------------------------------------------------------------------------
// WAV assembly
// ---------------------------------------------------------------------------

/** Joins the per-chunk waveforms into one continuous track. */
export function concatWaveforms(waveforms: Float32Array[]): Float32Array {
  const total = waveforms.reduce((n, w) => n + w.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const waveform of waveforms) {
    merged.set(waveform, offset);
    offset += waveform.length;
  }
  return merged;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Encodes mono float PCM as a 16-bit little-endian WAV blob.
 *
 * Hand-rolled rather than reusing `RawAudio#toBlob` from
 * `@huggingface/transformers`: that package is a transitive dependency of
 * `kokoro-js`, not a declared one, and importing it directly would be a phantom
 * dependency pnpm's isolated store is entitled to break at any time.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk length
  view.setUint16(20, 1, true); // format: uncompressed PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true); // byte rate
  view.setUint16(32, BYTES_PER_SAMPLE, true); // block align
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = WAV_HEADER_BYTES;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped * (clamped < 0 ? 0x8000 : 0x7fff), true);
    offset += BYTES_PER_SAMPLE;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// ---------------------------------------------------------------------------
// Model lifecycle
// ---------------------------------------------------------------------------

let modulePromise: Promise<KokoroModule> | null = null;
let modelPromise: Promise<KokoroTts> | null = null;
let modelKey = '';

/**
 * Loads `kokoro-js` once and points onnxruntime-web at same-origin binaries.
 *
 * transformers.js otherwise resolves its `.wasm` from
 * `https://cdn.jsdelivr.net/`, which this app's CSP `connect-src` blocks -- the
 * fetch fails and the model never initialises. `scripts/copy-ort-assets.sh`
 * puts the binaries under `public/ort/` so `config.wasmPaths` resolves locally.
 */
async function loadModule(config: KokoroConfig): Promise<KokoroModule> {
  modulePromise ??= import('kokoro-js').catch((error) => {
    modulePromise = null;
    throw error;
  });
  const kokoro = await modulePromise;
  kokoro.env.wasmPaths = config.wasmPaths;
  return kokoro;
}

/**
 * Loads (and caches) the weights. Keyed on everything that changes the bytes on
 * the wire, so flipping the env config re-fetches while repeat utterances do
 * not: this is an ~88 MB download the browser only caches once it completes.
 */
async function loadModel(
  kokoro: KokoroModule,
  config: KokoroConfig,
): Promise<KokoroTts> {
  const key = `${config.modelId}|${config.dtype}|${config.device}`;
  if (!modelPromise || modelKey !== key) {
    modelKey = key;
    modelPromise = kokoro.KokoroTTS.from_pretrained(config.modelId, {
      dtype: config.dtype,
      device: config.device,
    }).catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Bumped on every new request. The generate loop cannot be interrupted from
 * outside -- an `await tts.generate(...)` already in flight runs to completion
 * whatever the main thread wants -- so cancellation is cooperative: the loop
 * compares this counter against its own id after every await and stands down
 * the moment a newer request, or an explicit `cancel`, supersedes it.
 */
let generation = 0;

/**
 * Set the first time a WASM run fails the {@link MIN_WASM_REALTIME} benchmark,
 * and never cleared: hardware does not speed up mid-session, so later messages
 * skip straight to the fallback instead of re-paying a multi-second benchmark
 * chunk each time.
 */
let wasmProvenTooSlow = false;

/**
 * Milliseconds to wait before generating the next chunk, given how much audio
 * exists and how long playback has been running. Zero when the buffer is at or
 * below {@link BUFFER_AHEAD_SECONDS}; capped at {@link PACE_TICK_MS} so the
 * wait loop stays responsive to cancellation.
 *
 * Playback position is inferred from wall clock rather than reported by the
 * main thread: the first chunk starts playing the moment it is posted, so
 * `now - playbackStartedAt` tracks it without a feedback protocol. The one
 * divergence is user-initiated pause, which makes the estimate run *ahead* of
 * true playback -- erring toward generating more than needed, i.e. toward
 * exactly the behaviour shipped before pacing existed.
 */
export function paceDelayMs(
  generatedSeconds: number,
  playbackElapsedSeconds: number,
): number {
  const excess =
    generatedSeconds - playbackElapsedSeconds - BUFFER_AHEAD_SECONDS;
  if (excess <= 0) return 0;
  return Math.min(excess * 1000, PACE_TICK_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Phonemises every sentence up front and returns a synchronous lookup for
 * {@link chunkText}.
 *
 * The reference pipeline phonemises the whole message before cutting, and
 * measures chunks with `len(ps)`. Matching that is the point of this pass: it
 * lets chunkText fill to the real 510-phoneme ceiling rather than guessing from
 * characters, which is what made our chunks two thirds of the size they should
 * have been. `phonemize` is async, so the work happens here and chunkText stays
 * a synchronous, testable function.
 *
 * Sub-units produced inside chunkText (a run-on sentence broken on word
 * boundaries) are not in the map and fall back to the measured density. On any
 * failure the whole counter is dropped and chunkText reverts to its character
 * budget -- a slightly small chunk is survivable, a failed utterance is not.
 */
async function buildPhonemeCounter(
  text: string,
  Splitter: SentenceSplitter,
): Promise<((piece: string) => number) | undefined> {
  try {
    const { phonemize } = await import('phonemizer');

    const splitter = new Splitter();
    splitter.push(text);
    splitter.close();
    const sentences = [...splitter]
      .map((s) => s.trim())
      .filter((s) => s !== '');

    const counts = new Map<string, number>();
    await Promise.all(
      sentences.map(async (sentence) => {
        const phonemes = await phonemize(sentence, 'en-us');
        counts.set(sentence, phonemes.join(' ').length);
      }),
    );

    return (piece: string) =>
      counts.get(piece) ?? Math.round(piece.length * PHONEMES_PER_CHAR);
  } catch {
    return undefined;
  }
}

async function generate(request: KokoroGenerateRequest): Promise<void> {
  const id = ++generation;
  const { requestId, config, text } = request;

  if (config.device === 'wasm' && wasmProvenTooSlow) {
    throw new Error(
      'On-device synthesis runs slower than realtime on this hardware.',
    );
  }

  const kokoro = await loadModule(config);
  if (id !== generation) return;

  const tts = await loadModel(kokoro, config);
  if (id !== generation) return;

  const countPhonemes = await buildPhonemeCounter(
    text,
    kokoro.TextSplitterStream,
  );
  if (id !== generation) return;

  const chunks = chunkText(text, kokoro.TextSplitterStream, countPhonemes);
  if (chunks.length === 0) throw new Error('Nothing to synthesise.');

  post({ type: 'plan', requestId, total: chunks.length });

  const waveforms: Float32Array[] = [];
  let samplingRate = DEFAULT_SAMPLING_RATE;
  let generatedSeconds = 0;
  let playbackStartedAt = 0;

  for (const [index, chunk] of chunks.entries()) {
    // Pause while the listener already has plenty queued -- see paceDelayMs.
    while (index > 0) {
      const elapsed = (performance.now() - playbackStartedAt) / 1000;
      const delay = paceDelayMs(generatedSeconds, elapsed);
      if (delay === 0) break;
      await sleep(delay);
      if (id !== generation) return;
    }

    const generateStartedAt = performance.now();
    const audio = await tts.generate(chunk, {
      voice: config.voice as GenerateOptions['voice'],
      speed: config.speed,
    });
    if (id !== generation) return;

    samplingRate = audio.sampling_rate;

    // Emitted exactly as generated. The reference implementation does no edge
    // processing at all -- no trimming, no fades, one sample of silence between
    // chunks -- and it is reported to sound right, so this pipeline matches it
    // rather than second-guessing it.
    const cleaned = audio.audio;
    const chunkSeconds = cleaned.length / samplingRate;

    if (index === 0) {
      // The first chunk doubles as a benchmark: on a generator that cannot
      // keep pace with playback, bail *before* any audio is scheduled so the
      // caller's fallback voice starts fresh instead of after a Kokoro
      // opening. A single-chunk utterance is exempt -- it is already complete,
      // so there is no next chunk to be late for.
      const generateSeconds =
        (performance.now() - generateStartedAt) / 1000 || Number.MIN_VALUE;
      const realtimeFactor = chunkSeconds / generateSeconds;
      if (
        config.device === 'wasm' &&
        chunks.length > 1 &&
        realtimeFactor < MIN_WASM_REALTIME
      ) {
        wasmProvenTooSlow = true;
        throw new Error(
          `On-device synthesis runs at ${realtimeFactor.toFixed(2)}x realtime here; ` +
            'playback would outpace it.',
        );
      }
      playbackStartedAt = performance.now();
    }
    generatedSeconds += chunkSeconds;

    waveforms.push(cleaned);

    // Hand a *copy* to the main thread so playback can start now; the worker
    // keeps the original to assemble the final WAV. Transferring the copy's
    // buffer makes the hand-off a pointer move rather than a structured clone
    // of a multi-megabyte array.
    const pcm = cleaned.slice();
    post(
      {
        type: 'chunk',
        requestId,
        index,
        total: chunks.length,
        pcm,
        samplingRate,
      },
      [pcm.buffer],
    );
  }

  post({
    type: 'complete',
    requestId,
    blob: encodeWav(concatWaveforms(waveforms), samplingRate),
  });
}

/**
 * Exported for tests: the listener below is a one-line adapter over this, and
 * driving it directly is far cheaper than synthesising `MessageEvent`s.
 */
export async function handleRequest(request: KokoroRequest): Promise<void> {
  if (request.type === 'cancel') {
    // Nothing to abort synchronously; bumping the counter is what makes the
    // in-flight loop stand down at its next checkpoint.
    generation += 1;
    return;
  }

  try {
    await generate(request);
  } catch (error) {
    post({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

(self as unknown as WorkerScope).addEventListener('message', (event) => {
  void handleRequest(event.data as KokoroRequest);
});
