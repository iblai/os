import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { KokoroConfig } from '../config';
import type { KokoroResponse } from '../kokoro.worker';

// ---------------------------------------------------------------------------
// kokoro-js stand-in
//
// The real package downloads ~88 MB of ONNX weights and runs inference; none of
// that is under test here. What *is* under test is everything around it: how
// the text is cut up, how cancellation interleaves with the generate loop, and
// what lands on the wire.
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  /** Mirrors kokoro-js's splitter closely enough: sentence-final punctuation. */
  class TextSplitterStream {
    private text = '';
    push(...texts: string[]) {
      this.text += texts.join('');
    }
    close() {}
    *[Symbol.iterator]() {
      for (const sentence of this.text.split(/(?<=[.!?])\s+/)) yield sentence;
    }
  }

  const fromPretrained = vi.fn();
  const generate = vi.fn();
  const phonemize = vi.fn();
  const env = { wasmPaths: '' };

  return {
    fromPretrained,
    generate,
    phonemize,
    env,
    TextSplitterStream,
    // The stand-in module is never imported directly by these tests: pulling
    // the real `kokoro-js` into the Node test process boots phonemizer's
    // emscripten build, which installs its own `process` handlers and takes the
    // vitest worker down with it.
    factory: () => ({
      KokoroTTS: { from_pretrained: fromPretrained },
      TextSplitterStream,
      env,
    }),
  };
});

vi.mock('kokoro-js', hoisted.factory);

// Same hazard as kokoro-js above, and worse: importing the real `phonemizer`
// boots an emscripten espeak-ng build that installs its own `process`
// handlers and takes the vitest worker down with it. The stand-in returns one
// "phoneme" per character, which is close enough to the measured 1.079 for the
// chunk-boundary assertions and keeps them arithmetic rather than linguistic.
vi.mock('phonemizer', () => ({ phonemize: hoisted.phonemize }));

/**
 * The stand-in splitter only implements what `chunkText` uses; the real type
 * also carries kokoro-js's private buffer fields.
 */
const Splitter = hoisted.TextSplitterStream as unknown as Parameters<
  typeof import('../kokoro.worker').chunkText
>[1];

type Posted = { message: KokoroResponse; transfer?: Transferable[] };

let posted: Posted[] = [];
let messageListeners: Array<(event: MessageEvent) => void> = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function audio(length: number, samplingRate = 24000) {
  return {
    audio: new Float32Array(length).fill(0.25),
    sampling_rate: samplingRate,
  };
}

function config(overrides: Partial<KokoroConfig> = {}): KokoroConfig {
  return {
    modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    dtype: 'q8',
    device: 'wasm',
    voice: 'af_heart',
    speed: 1,
    wasmPaths: '/ort/',
    ...overrides,
  };
}

/**
 * Reloads the worker with a clean slate: the module holds the cached model, the
 * cached kokoro-js import and the generation counter, all of which are
 * per-worker-lifetime state that must not leak between tests.
 */
async function loadWorker() {
  vi.resetModules();
  posted = [];
  messageListeners = [];
  hoisted.env.wasmPaths = '';
  hoisted.phonemize.mockReset();
  // One "phoneme" per character: close enough to the measured 1.079 for the
  // boundary assertions, and keeps them arithmetic rather than linguistic.
  hoisted.phonemize.mockImplementation(async (text: string) => [text]);
  hoisted.generate.mockReset();
  hoisted.generate.mockImplementation(async () => audio(2400));
  hoisted.fromPretrained.mockReset();
  hoisted.fromPretrained.mockImplementation(async () => ({
    generate: hoisted.generate,
  }));

  return import('../kokoro.worker');
}

/** jsdom's Blob has no `arrayBuffer()`, so read it the long way round. */
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function messages(type: KokoroResponse['type']) {
  return posted.map((p) => p.message).filter((m) => m.type === type);
}

beforeEach(() => {
  Object.defineProperty(window, 'postMessage', {
    configurable: true,
    writable: true,
    value: (message: KokoroResponse, transfer?: Transferable[]) => {
      posted.push({ message, transfer });
    },
  });
  // Capture the module-scope listener registration instead of letting it pile
  // up on the jsdom window across reloads.
  vi.spyOn(window, 'addEventListener').mockImplementation(((
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    if (type === 'message') {
      messageListeners.push(listener as (event: MessageEvent) => void);
    }
  }) as typeof window.addEventListener);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('splitLongSentence', () => {
  it('leaves a sentence that already fits alone', async () => {
    const worker = await loadWorker();
    expect(worker.splitLongSentence('Short enough.')).toEqual([
      'Short enough.',
    ]);
  });

  it('breaks on word boundaries, never mid-word', async () => {
    const worker = await loadWorker();
    const sentence = Array.from({ length: 120 }, (_, i) => `word${i}`).join(
      ' ',
    );

    const parts = worker.splitLongSentence(sentence);

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(430);
    expect(parts.join(' ')).toBe(sentence);
  });

  it('honours an explicit budget', async () => {
    const worker = await loadWorker();
    const sentence = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');

    const parts = worker.splitLongSentence(sentence, 50);

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(50);
  });

  it('collapses runs of whitespace rather than emitting empty parts', async () => {
    const worker = await loadWorker();
    expect(worker.splitLongSentence('  a   b  ')).toEqual(['a b']);
  });

  it('returns nothing for an empty sentence', async () => {
    const worker = await loadWorker();
    expect(worker.splitLongSentence('   ')).toEqual([]);
  });
});

describe('chunkText', () => {
  // The budget is deliberately well under the model's 510-phoneme context:
  // Kokoro muffles progressively *within* a generation, so chunk length is the
  // window over which that drift accumulates. 150 was picked by ear.
  it('keeps every chunk inside the phoneme budget', async () => {
    const worker = await loadWorker();
    const sentence = `${'a'.repeat(60)}.`; // 61 chars
    const count = (piece: string) => piece.length; // 1 phoneme per char

    const chunks = worker.chunkText(
      Array(12).fill(sentence).join(' '),
      Splitter,
      count,
    );

    for (const chunk of chunks) expect(count(chunk)).toBeLessThanOrEqual(150);
    // 743 "phonemes" over a 150 budget needs at least five chunks.
    expect(chunks.length).toBeGreaterThanOrEqual(5);
  });

  // Packing to an even target and then folding stubs exists to keep short
  // chunks out: chunk length selects the style vector, so a stub beside a full
  // chunk is audible as the speaker changing.
  it('leaves no stub chunk far below the others', async () => {
    const worker = await loadWorker();
    const count = (piece: string) => piece.length;
    // Deliberately awkward: a long run then one tiny trailing sentence.
    const text = `${Array(7)
      .fill(`${'a'.repeat(60)}.`)
      .join(' ')} Hi.`;

    const chunks = worker.chunkText(text, Splitter, count);
    const sizes = chunks.map(count);
    const biggest = Math.max(...sizes);

    for (const chunk of chunks) expect(count(chunk)).toBeLessThanOrEqual(150);
    // nothing may be a fraction of the largest chunk
    expect(Math.min(...sizes)).toBeGreaterThan(biggest * 0.3);
  });

  it('merges a leading stub forward when it has no previous neighbour', async () => {
    const worker = await loadWorker();
    const count = (piece: string) => piece.length;
    // Tiny first sentence, then full-size ones: the only neighbour is ahead.
    const text = `Hi. ${Array(6)
      .fill(`${'a'.repeat(60)}.`)
      .join(' ')}`;

    const chunks = worker.chunkText(text, Splitter, count);

    expect(chunks[0].startsWith('Hi.')).toBe(true);
    expect(count(chunks[0])).toBeGreaterThan(3);
    for (const chunk of chunks) expect(count(chunk)).toBeLessThanOrEqual(150);
  });

  it('leaves a stub alone when neither neighbour has room', async () => {
    const worker = await loadWorker();
    const count = (piece: string) => piece.length;
    // Both neighbours are already at the budget, so no merge can fit.
    const full = `${'a'.repeat(148)}.`;
    const chunks = worker.chunkText(`${full} Hi. ${full}`, Splitter, count);

    // The stub survives rather than being force-merged past the ceiling.
    for (const chunk of chunks) expect(count(chunk)).toBeLessThanOrEqual(150);
    expect(chunks.join(' ')).toContain('Hi.');
  });

  it('measures in phonemes, not characters, when a counter is supplied (dense cuts sooner)', async () => {
    const worker = await loadWorker();
    const text = Array(12)
      .fill(`${'a'.repeat(60)}.`)
      .join(' ');

    // Same text, two densities: a phoneme-dense counter must cut sooner.
    const sparse = worker.chunkText(text, Splitter, (p: string) => p.length);
    const dense = worker.chunkText(text, Splitter, (p: string) => p.length * 3);

    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  // The reason chunking exists at all: kokoro-js tokenises with
  // `truncation: true`, so anything past ~510 phoneme tokens is dropped without
  // an error. A chunk over the limit means silently unspoken text.
  it('keeps every chunk under the character fallback when no counter is given', async () => {
    const worker = await loadWorker();
    const text = Array(60).fill('The quick brown fox jumps.').join(' ');

    const chunks = worker.chunkText(text, Splitter);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(430);
    expect(chunks.join(' ')).toBe(text);
  });

  it('cuts at sentence boundaries so the seams are inaudible', async () => {
    const worker = await loadWorker();
    const text = Array(10)
      .fill(`${'x'.repeat(140)}.`)
      .join(' ');

    const chunks = worker.chunkText(text, Splitter);

    for (const chunk of chunks) expect(chunk.endsWith('.')).toBe(true);
  });

  it('falls back to word boundaries for a single over-long sentence', async () => {
    const worker = await loadWorker();
    const runOn = `${Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ')}.`;

    const chunks = worker.chunkText(runOn, Splitter);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(430);
  });

  it('drops blank sentences', async () => {
    const worker = await loadWorker();
    expect(worker.chunkText('One.   Two.', Splitter)).toEqual(['One. Two.']);
  });

  it('produces nothing for empty text', async () => {
    const worker = await loadWorker();
    expect(worker.chunkText('   ', Splitter)).toEqual([]);
  });
});

describe('concatWaveforms', () => {
  it('joins the per-chunk waveforms end to end', async () => {
    const worker = await loadWorker();
    const merged = worker.concatWaveforms([
      new Float32Array([1, 2]),
      new Float32Array([3]),
      new Float32Array([4, 5]),
    ]);
    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles an empty list', async () => {
    const worker = await loadWorker();
    expect(worker.concatWaveforms([])).toHaveLength(0);
  });
});

describe('mergeStubs', () => {
  const len = (piece: string) => piece.length;

  it('merges a stub into whichever neighbour is smaller', async () => {
    const worker = await loadWorker();
    // Both neighbours have room; the shorter one should absorb the stub, so a
    // merge never manufactures a new outlier.
    const out = worker.mergeStubs(['aaaaaaaa', 'bb', 'cccc'], 10, 100, len);

    expect(out).toEqual(['aaaaaaaa', 'bb cccc']);
  });

  it('merges backward when only the previous neighbour has room', async () => {
    const worker = await loadWorker();
    // `previous` must clear the floor itself, or it would be treated as a stub
    // and merged forward first — which would take the stub with it and never
    // exercise the backward path.
    const out = worker.mergeStubs(
      ['aaaaaaaa', 'bb', 'c'.repeat(19)],
      10,
      20,
      len,
    );

    expect(out[0]).toBe('aaaaaaaa bb');
    expect(out).toHaveLength(2);
  });

  it('merges forward when there is no previous neighbour', async () => {
    const worker = await loadWorker();
    const out = worker.mergeStubs(['bb', 'cccccccc'], 10, 100, len);

    expect(out).toEqual(['bb cccccccc']);
  });

  it('leaves a stub alone when neither neighbour has room', async () => {
    const worker = await loadWorker();
    const full = 'x'.repeat(19);
    const out = worker.mergeStubs([full, 'bb', full], 10, 20, len);

    expect(out).toEqual([full, 'bb', full]);
  });

  it('leaves a lone chunk alone however short', async () => {
    const worker = await loadWorker();
    expect(worker.mergeStubs(['hi'], 100, 200, len)).toEqual(['hi']);
  });

  it('keeps chunks that already clear the floor', async () => {
    const worker = await loadWorker();
    const input = ['aaaaaa', 'bbbbbb', 'cccccc'];
    expect(worker.mergeStubs(input, 10, 100, len)).toEqual(input);
  });
});

describe('encodeWav', () => {
  it('writes a well-formed 16-bit mono header', async () => {
    const worker = await loadWorker();
    const blob = worker.encodeWav(new Float32Array(4), 24000);
    const view = new DataView(await readBlob(blob));
    const ascii = (offset: number, length: number) =>
      String.fromCharCode(
        ...Array.from({ length }, (_, i) => view.getUint8(offset + i)),
      );

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 8);
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');
    expect(view.getUint32(4, true)).toBe(36 + 8);
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(28, true)).toBe(48000); // byte rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(8);
  });

  it('clamps out-of-range samples instead of wrapping them', async () => {
    const worker = await loadWorker();
    const blob = worker.encodeWav(new Float32Array([2, -2, 0]), 24000);
    const view = new DataView(await readBlob(blob));

    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(0);
  });
});

describe('generate', () => {
  it('streams each chunk as it is produced, then the assembled WAV', async () => {
    const worker = await loadWorker();

    await worker.handleRequest({
      type: 'generate',
      requestId: 7,
      text: Array(30).fill('The quick brown fox jumps.').join(' '),
      config: config(),
    });

    const plan = messages('plan');
    const chunks = messages('chunk');
    const complete = messages('complete');

    expect(plan).toHaveLength(1);
    expect(chunks.length).toBeGreaterThan(1);
    expect(complete).toHaveLength(1);
    // Every response carries the request id so a superseded reply is
    // recognisable on the main thread.
    for (const message of posted) expect(message.message.requestId).toBe(7);
    // The chunk stream comes before the assembled file, which is the whole
    // point: playback starts on chunk 1.
    expect(posted.at(-1)?.message.type).toBe('complete');
  });

  it('transfers each chunk buffer rather than cloning it', async () => {
    const worker = await loadWorker();

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'One sentence.',
      config: config(),
    });

    const chunk = posted.find((p) => p.message.type === 'chunk');
    expect(chunk?.transfer).toHaveLength(1);
    if (chunk?.message.type !== 'chunk') throw new Error('expected a chunk');
    expect(chunk.transfer?.[0]).toBe(chunk.message.pcm.buffer);
    expect(chunk.message.samplingRate).toBe(24000);
    expect(chunk.message.index).toBe(0);
  });

  it('points onnxruntime at same-origin binaries before loading the model', async () => {
    const worker = await loadWorker();

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello.',
      config: config({ wasmPaths: '/mentor/ort/' }),
    });

    expect(hoisted.env.wasmPaths).toBe('/mentor/ort/');
    expect(hoisted.fromPretrained).toHaveBeenCalledWith(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      { dtype: 'q8', device: 'wasm' },
    );
  });

  it('passes the configured voice and speed through', async () => {
    const worker = await loadWorker();

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello.',
      config: config({ voice: 'bm_george', speed: 1.4 }),
    });

    expect(hoisted.generate).toHaveBeenCalledWith('Hello.', {
      voice: 'bm_george',
      speed: 1.4,
    });
  });

  // Phonemising is what lets chunks fill to the real 510 ceiling instead of a
  // character guess. If it fails, a slightly small chunk is survivable; a
  // failed utterance is not.
  it('still speaks when phonemisation fails, falling back to characters', async () => {
    const worker = await loadWorker();
    hoisted.phonemize.mockRejectedValue(new Error('espeak data missing'));

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello there. This still has to be spoken.',
      config: config(),
    });

    expect(messages('error')).toHaveLength(0);
    expect(messages('chunk').length).toBeGreaterThan(0);
    expect(messages('complete')).toHaveLength(1);
  });

  it('estimates pieces the phonemiser never saw', async () => {
    const worker = await loadWorker();
    // A run-on with no sentence punctuation: chunkText breaks it on word
    // boundaries, and those sub-units are absent from the phonemised map.
    const runOn = Array.from({ length: 300 }, (_, i) => `w${i}`).join(' ');

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: runOn,
      config: config(),
    });

    expect(messages('error')).toHaveLength(0);
    expect(messages('chunk').length).toBeGreaterThan(1);
  });

  it('loads the ~88MB model once and reuses it', async () => {
    const worker = await loadWorker();
    const request = {
      type: 'generate' as const,
      requestId: 1,
      text: 'Hello.',
      config: config(),
    };

    await worker.handleRequest(request);
    await worker.handleRequest({ ...request, requestId: 2 });

    expect(hoisted.fromPretrained).toHaveBeenCalledTimes(1);
  });

  it('reloads when the requested weights change', async () => {
    const worker = await loadWorker();

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello.',
      config: config(),
    });
    await worker.handleRequest({
      type: 'generate',
      requestId: 2,
      text: 'Hello.',
      config: config({ dtype: 'fp32', device: 'webgpu' }),
    });

    expect(hoisted.fromPretrained).toHaveBeenCalledTimes(2);
  });
});

describe('failure reporting', () => {
  it('reports a blocked model fetch instead of hanging', async () => {
    const worker = await loadWorker();
    hoisted.fromPretrained.mockRejectedValueOnce(
      new Error('Failed to fetch model'),
    );

    await worker.handleRequest({
      type: 'generate',
      requestId: 3,
      text: 'Hello.',
      config: config(),
    });

    expect(messages('error')).toEqual([
      { type: 'error', requestId: 3, message: 'Failed to fetch model' },
    ]);
  });

  it('lets a later request retry after a failed load', async () => {
    const worker = await loadWorker();
    hoisted.fromPretrained.mockRejectedValueOnce(new Error('offline'));

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello.',
      config: config(),
    });
    await worker.handleRequest({
      type: 'generate',
      requestId: 2,
      text: 'Hello.',
      config: config(),
    });

    expect(hoisted.fromPretrained).toHaveBeenCalledTimes(2);
    expect(messages('complete')).toHaveLength(1);
  });

  it('reports text that produced no chunks', async () => {
    const worker = await loadWorker();

    await worker.handleRequest({
      type: 'generate',
      requestId: 4,
      text: '   ',
      config: config(),
    });

    expect(messages('error')).toEqual([
      { type: 'error', requestId: 4, message: 'Nothing to synthesise.' },
    ]);
  });

  it('stringifies a non-Error rejection', async () => {
    const worker = await loadWorker();
    hoisted.generate.mockRejectedValueOnce('out of memory');

    await worker.handleRequest({
      type: 'generate',
      requestId: 5,
      text: 'Hello.',
      config: config(),
    });

    expect(messages('error')).toEqual([
      { type: 'error', requestId: 5, message: 'out of memory' },
    ]);
  });

  // The dynamic import is what keeps kokoro-js out of the main bundle, so its
  // chunk can genuinely fail to arrive — a stale deploy, an offline tab.
  it('reports a kokoro-js chunk that fails to load, and retries next time', async () => {
    vi.resetModules();
    posted = [];
    messageListeners = [];
    vi.doMock('kokoro-js', () => {
      throw new Error('ChunkLoadError');
    });
    try {
      const worker = await import('../kokoro.worker');
      await worker.handleRequest({
        type: 'generate',
        requestId: 6,
        text: 'Hello.',
        config: config(),
      });

      expect(messages('error')).toHaveLength(1);
      expect(messages('error')[0].requestId).toBe(6);

      // The cached import promise was cleared, so a later utterance can still
      // succeed once the chunk is reachable again.
      vi.doMock('kokoro-js', hoisted.factory);
      hoisted.fromPretrained.mockResolvedValue({ generate: hoisted.generate });
      hoisted.generate.mockResolvedValue(audio(2400));
      await worker.handleRequest({
        type: 'generate',
        requestId: 7,
        text: 'Hello.',
        config: config(),
      });

      expect(messages('complete')).toHaveLength(1);
    } finally {
      // Restore the stand-in rather than unmocking: an unmocked `kokoro-js`
      // would load for real in the next test and kill the vitest worker.
      vi.doMock('kokoro-js', hoisted.factory);
    }
  });
});

describe('cancellation', () => {
  // The generate loop cannot be interrupted from outside — an `await
  // tts.generate(...)` already in flight runs to completion regardless. So
  // cancellation is a counter the loop consults at each checkpoint.
  it('stands down while phonemising, before any chunk is planned', async () => {
    const worker = await loadWorker();
    const gate = deferred<string[]>();
    hoisted.phonemize.mockReturnValue(gate.promise);

    const inFlight = worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello there.',
      config: config(),
    });
    // Park the request inside the phonemise pre-pass, then supersede it.
    await Promise.resolve();
    void worker.handleRequest({ type: 'cancel' });
    gate.resolve(['Hello there.']);
    await inFlight;

    expect(messages('plan')).toHaveLength(0);
    expect(messages('chunk')).toHaveLength(0);
    expect(hoisted.generate).not.toHaveBeenCalled();
  });

  it('stands down before loading the model', async () => {
    const worker = await loadWorker();

    const inFlight = worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello.',
      config: config(),
    });
    // Runs synchronously while the request is parked awaiting the kokoro-js
    // module, which is the earliest checkpoint.
    void worker.handleRequest({ type: 'cancel' });
    await inFlight;

    expect(hoisted.fromPretrained).not.toHaveBeenCalled();
    expect(posted).toEqual([]);
  });

  it('stands down while the weights are still downloading', async () => {
    const worker = await loadWorker();
    const gate = deferred<{ generate: typeof hoisted.generate }>();
    hoisted.fromPretrained.mockReturnValueOnce(gate.promise);

    const inFlight = worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'Hello.',
      config: config(),
    });
    await vi.waitFor(() => expect(hoisted.fromPretrained).toHaveBeenCalled());
    await worker.handleRequest({ type: 'cancel' });
    gate.resolve({ generate: hoisted.generate });
    await inFlight;

    expect(hoisted.generate).not.toHaveBeenCalled();
    expect(posted).toEqual([]);
  });

  it('stands down between chunks, without emitting the finished chunk', async () => {
    const worker = await loadWorker();
    const gate = deferred<ReturnType<typeof audio>>();
    hoisted.generate.mockReturnValueOnce(gate.promise);

    const inFlight = worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'One. Two.',
      config: config(),
    });
    await vi.waitFor(() => expect(messages('plan')).toHaveLength(1));
    await worker.handleRequest({ type: 'cancel' });
    gate.resolve(audio(2400));
    await inFlight;

    expect(messages('chunk')).toEqual([]);
    expect(messages('complete')).toEqual([]);
    expect(messages('plan')).toHaveLength(1);
  });

  it('lets a newer utterance supersede an in-flight one', async () => {
    const worker = await loadWorker();
    const gate = deferred<ReturnType<typeof audio>>();
    hoisted.generate.mockReturnValueOnce(gate.promise);

    const first = worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'First.',
      config: config(),
    });
    await vi.waitFor(() => expect(messages('plan')).toHaveLength(1));
    const second = worker.handleRequest({
      type: 'generate',
      requestId: 2,
      text: 'Second.',
      config: config(),
    });
    gate.resolve(audio(2400));
    await Promise.all([first, second]);

    // Nothing from the superseded run reaches the main thread.
    for (const { message } of posted) {
      if (message.type !== 'plan') expect(message.requestId).toBe(2);
    }
    expect(messages('complete')).toHaveLength(1);
  });
});

describe('worker message adapter', () => {
  it('forwards posted messages to the request handler', async () => {
    const worker = await loadWorker();
    expect(messageListeners).toHaveLength(1);
    expect(worker.handleRequest).toBeTypeOf('function');

    messageListeners[0]({
      data: { type: 'generate', requestId: 9, text: '  ', config: config() },
    } as MessageEvent);
    await vi.waitFor(() => expect(messages('error')).toHaveLength(1));

    expect(messages('error')[0].requestId).toBe(9);
  });
});

describe('wasm realtime gate', () => {
  /** ~26 chars per sentence; 12 sentences comfortably exceeds one 150-phoneme chunk. */
  const MULTI_CHUNK_TEXT = Array(12)
    .fill('The quick brown fox jumps.')
    .join(' ');

  /** A clock the generate mock can wind forward to simulate slow inference. */
  function fakeClock() {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    return { advance: (ms: number) => (now += ms) };
  }

  it('abandons a run whose first chunk generates slower than realtime, before any audio is posted', async () => {
    const worker = await loadWorker();
    const clock = fakeClock();
    // 0.1s of audio in 10s of compute: 0.01x realtime.
    hoisted.generate.mockImplementation(async () => {
      clock.advance(10_000);
      return audio(2400);
    });

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: MULTI_CHUNK_TEXT,
      config: config(),
    });

    expect(messages('chunk')).toEqual([]);
    expect(messages('complete')).toEqual([]);
    const [error] = messages('error');
    if (error?.type !== 'error') throw new Error('expected an error');
    expect(error.message).toMatch(/realtime/);
  });

  it('remembers the verdict: later requests fail fast without re-benchmarking', async () => {
    const worker = await loadWorker();
    const clock = fakeClock();
    hoisted.generate.mockImplementation(async () => {
      clock.advance(10_000);
      return audio(2400);
    });
    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: MULTI_CHUNK_TEXT,
      config: config(),
    });

    hoisted.generate.mockClear();
    await worker.handleRequest({
      type: 'generate',
      requestId: 2,
      text: MULTI_CHUNK_TEXT,
      config: config(),
    });

    expect(hoisted.generate).not.toHaveBeenCalled();
    expect(messages('error')).toHaveLength(2);
  });

  it('exempts a single-chunk utterance -- it is already complete, so nothing can lag', async () => {
    const worker = await loadWorker();
    const clock = fakeClock();
    hoisted.generate.mockImplementation(async () => {
      clock.advance(10_000);
      return audio(2400);
    });

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: 'One short sentence.',
      config: config(),
    });

    expect(messages('chunk')).toHaveLength(1);
    expect(messages('complete')).toHaveLength(1);
    expect(messages('error')).toEqual([]);
  });

  it('never gates webgpu: slow chunks there stutter the page, not the audio', async () => {
    const worker = await loadWorker();
    const clock = fakeClock();
    hoisted.generate.mockImplementation(async () => {
      clock.advance(10_000);
      return audio(2400);
    });

    await worker.handleRequest({
      type: 'generate',
      requestId: 1,
      text: MULTI_CHUNK_TEXT,
      config: config({ device: 'webgpu', dtype: 'fp32' }),
    });

    expect(messages('chunk').length).toBeGreaterThan(1);
    expect(messages('error')).toEqual([]);
  });
});

describe('generation pacing', () => {
  it('computes no delay until the buffer exceeds the ahead target', async () => {
    const worker = await loadWorker();
    // 10s generated, playback at 0: only 10s ahead, under the 15s target.
    expect(worker.paceDelayMs(10, 0)).toBe(0);
    // Exactly at the target is still "keep generating".
    expect(worker.paceDelayMs(15, 0)).toBe(0);
    // 5s over target: wait, but never longer than one cancellation tick.
    expect(worker.paceDelayMs(20, 0)).toBe(250);
    // 100ms over target: a wait shorter than the tick is taken as-is.
    expect(worker.paceDelayMs(15.1, 0)).toBeCloseTo(100);
    // Playback progress drains the excess.
    expect(worker.paceDelayMs(20, 10)).toBe(0);
  });

  it('pauses generation while the listener already has enough queued', async () => {
    const worker = await loadWorker();
    vi.useFakeTimers();
    try {
      vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
      // Each chunk is 20s of audio, generated instantly: after chunk one the
      // buffer is 5s over target, so chunk two must wait ~5s of playback.
      hoisted.generate.mockImplementation(async () => audio(20 * 24000));

      const inFlight = worker.handleRequest({
        type: 'generate',
        requestId: 1,
        text: Array(8).fill('The quick brown fox jumps.').join(' '),
        config: config(),
      });

      await vi.advanceTimersByTimeAsync(0);
      const plan = messages('plan')[0];
      if (plan?.type !== 'plan') throw new Error('expected a plan');
      expect(plan.total).toBeGreaterThan(1);
      expect(messages('chunk')).toHaveLength(1);

      // 4.75s in, the 20s chunk still leaves the buffer over the 15s target:
      // nothing new may be generated yet.
      await vi.advanceTimersByTimeAsync(4750);
      expect(messages('chunk')).toHaveLength(1);

      // Past the 5s mark the pacing wait ends and chunk two arrives.
      await vi.advanceTimersByTimeAsync(750);
      expect(messages('chunk')).toHaveLength(2);

      // Enough playback time for every remaining chunk to clear its wait.
      await vi.advanceTimersByTimeAsync(plan.total * 20_000);
      expect(messages('chunk')).toHaveLength(plan.total);
      expect(messages('complete')).toHaveLength(1);

      await inFlight;
    } finally {
      vi.useRealTimers();
    }
  });

  it('stands down mid-pacing when cancelled', async () => {
    const worker = await loadWorker();
    vi.useFakeTimers();
    try {
      vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
      hoisted.generate.mockImplementation(async () => audio(20 * 24000));

      const inFlight = worker.handleRequest({
        type: 'generate',
        requestId: 1,
        text: Array(8).fill('The quick brown fox jumps.').join(' '),
        config: config(),
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(messages('chunk')).toHaveLength(1);

      await worker.handleRequest({ type: 'cancel' });
      await vi.advanceTimersByTimeAsync(60_000);
      await inFlight;

      expect(messages('chunk')).toHaveLength(1);
      expect(messages('complete')).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
