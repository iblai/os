import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TTS_MIME,
  attachMediaSourceStream,
  canStreamWithMediaSource,
  normalizeAudioMime,
} from '../media-source-stream';

// ---------------------------------------------------------------------------
// Fakes
//
// jsdom has neither `MediaSource` nor `SourceBuffer`, and the behaviour under
// test is the event choreography between them — `sourceopen`, then `updateend`
// or `error` per append. The fakes therefore fire those by hand so a test can
// stall a stream, fail one append, or close the source mid-pump.
// ---------------------------------------------------------------------------

class FakeEventTarget {
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void) {
    const set = this.listeners.get(type) ?? new Set<() => void>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }

  emit(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
}

class FakeSourceBuffer extends FakeEventTarget {
  appended: Uint8Array[] = [];
  /** Fire `error` instead of `updateend` on the next append. */
  failNextAppend = false;
  /** Throw synchronously from `appendBuffer`, as a detached buffer does. */
  appendThrows = false;

  appendBuffer(chunk: Uint8Array) {
    if (this.appendThrows) throw new Error('sourcebuffer detached');
    this.appended.push(chunk);
    const failing = this.failNextAppend;
    this.failNextAppend = false;
    queueMicrotask(() => this.emit(failing ? 'error' : 'updateend'));
  }
}

class FakeMediaSource extends FakeEventTarget {
  static isTypeSupported = vi.fn((_mime: string) => true);

  readyState: 'closed' | 'open' | 'ended' = 'closed';
  sourceBuffer: FakeSourceBuffer | null = null;
  addSourceBufferMime: string | null = null;
  addSourceBufferThrows = false;
  endOfStreamCalls = 0;
  endOfStreamThrows = false;

  constructor() {
    super();
    sources.push(this);
  }

  addSourceBuffer(mime: string) {
    if (this.addSourceBufferThrows) {
      throw new Error(`unsupported type: ${mime}`);
    }
    this.addSourceBufferMime = mime;
    this.sourceBuffer = new FakeSourceBuffer();
    return this.sourceBuffer;
  }

  endOfStream() {
    this.endOfStreamCalls += 1;
    if (this.endOfStreamThrows)
      throw new Error('endOfStream on a closed source');
    this.readyState = 'ended';
  }

  /** What the browser does once it has attached the object URL. */
  open() {
    this.readyState = 'open';
    this.emit('sourceopen');
  }
}

let sources: FakeMediaSource[] = [];

function installMediaSource(ctor: unknown = FakeMediaSource) {
  Object.defineProperty(window, 'MediaSource', {
    configurable: true,
    writable: true,
    value: ctor,
  });
}

type ReadResult = { done: boolean; value?: Uint8Array };

function bodyOf(read: () => Promise<ReadResult>): ReadableStream<Uint8Array> {
  return {
    getReader: () => ({ read }),
  } as unknown as ReadableStream<Uint8Array>;
}

function chunks(...list: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return bodyOf(async () =>
    index < list.length
      ? { done: false, value: list[index++] }
      : { done: true },
  );
}

function bytes(length: number) {
  return new Uint8Array(length).fill(7);
}

function attach(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal = new AbortController().signal,
  mime = 'audio/mpeg',
) {
  const audio = document.createElement('audio');
  const handle = attachMediaSourceStream(audio, body, mime, signal);
  return { audio, ...handle, source: sources[0] };
}

beforeEach(() => {
  sources = [];
  FakeMediaSource.isTypeSupported.mockReset().mockReturnValue(true);
  installMediaSource();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tts-stream');
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'MediaSource');
  vi.restoreAllMocks();
});

describe('normalizeAudioMime', () => {
  it('falls back to the default when the endpoint names no type', () => {
    expect(normalizeAudioMime(null)).toBe(DEFAULT_TTS_MIME);
  });

  it('falls back to the default for an empty header', () => {
    expect(normalizeAudioMime('   ')).toBe(DEFAULT_TTS_MIME);
  });

  // MediaSource rejects the non-standard spelling outright.
  it('rewrites audio/mp3 to audio/mpeg', () => {
    expect(normalizeAudioMime('audio/mp3')).toBe('audio/mpeg');
    expect(normalizeAudioMime('Audio/MP3; charset=binary')).toBe('audio/mpeg');
  });

  it('strips codec parameters and lowercases everything else', () => {
    expect(normalizeAudioMime('AUDIO/WEBM; codecs="opus"')).toBe('audio/webm');
  });
});

describe('canStreamWithMediaSource', () => {
  it('accepts a type the browser reports as supported', () => {
    expect(canStreamWithMediaSource('audio/mpeg')).toBe(true);
    expect(FakeMediaSource.isTypeSupported).toHaveBeenCalledWith('audio/mpeg');
  });

  it('rejects a type the browser reports as unsupported', () => {
    FakeMediaSource.isTypeSupported.mockReturnValue(false);
    expect(canStreamWithMediaSource('audio/wav')).toBe(false);
  });

  it('rejects when MediaSource is absent entirely', () => {
    Reflect.deleteProperty(window, 'MediaSource');
    expect(canStreamWithMediaSource('audio/mpeg')).toBe(false);
  });

  it('rejects when MediaSource exposes no isTypeSupported', () => {
    installMediaSource({});
    expect(canStreamWithMediaSource('audio/mpeg')).toBe(false);
  });

  it('rejects during SSR, where there is no window', () => {
    vi.stubGlobal('window', undefined);
    expect(canStreamWithMediaSource('audio/mpeg')).toBe(false);
  });
});

describe('attachMediaSourceStream', () => {
  it('points the element at the object URL synchronously', () => {
    const { audio, objectUrl, ready } = attach(chunks(bytes(4)));
    expect(objectUrl).toBe('blob:tts-stream');
    expect(audio.src).toContain('blob:tts-stream');
    expect(URL.createObjectURL).toHaveBeenCalledWith(sources[0]);
    sources[0].open();
    return ready;
  });

  it('resolves on the first appended range, before the stream ends', async () => {
    let releaseSecond: () => void = () => {};
    const second = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let index = 0;
    const body = bodyOf(async () => {
      index += 1;
      if (index === 1) return { done: false, value: bytes(4) };
      await second;
      return { done: true };
    });

    const { ready, source } = attach(body);
    source.open();
    await ready;

    expect(source.endOfStreamCalls).toBe(0);
    releaseSecond();
    await vi.waitFor(() => expect(source.endOfStreamCalls).toBe(1));
  });

  it('appends every chunk and ends the stream once drained', async () => {
    const { ready, source } = attach(chunks(bytes(4), bytes(8)));
    source.open();
    await ready;
    await vi.waitFor(() => expect(source.endOfStreamCalls).toBe(1));

    expect(source.addSourceBufferMime).toBe('audio/mpeg');
    expect(source.sourceBuffer?.appended.map((c) => c.byteLength)).toEqual([
      4, 8,
    ]);
    expect(source.readyState).toBe('ended');
    expect(source.listenerCount('sourceopen')).toBe(0);
  });

  it('skips zero-length chunks rather than appending them', async () => {
    const { ready, source } = attach(chunks(bytes(0), bytes(4)));
    source.open();
    await ready;
    await vi.waitFor(() => expect(source.endOfStreamCalls).toBe(1));

    expect(source.sourceBuffer?.appended).toHaveLength(1);
  });

  it('leaves no per-append listeners behind', async () => {
    const { ready, source } = attach(chunks(bytes(4), bytes(4)));
    source.open();
    await ready;
    await vi.waitFor(() => expect(source.endOfStreamCalls).toBe(1));

    expect(source.sourceBuffer?.listenerCount('updateend')).toBe(0);
    expect(source.sourceBuffer?.listenerCount('error')).toBe(0);
  });

  it('rejects when the source buffer cannot be created', async () => {
    const { ready } = attach(chunks(bytes(4)));
    sources[0].addSourceBufferThrows = true;
    sources[0].open();

    await expect(ready).rejects.toThrow('unsupported type: audio/mpeg');
    expect(sources[0].sourceBuffer).toBeNull();
  });

  it('rejects when an append reports an error event', async () => {
    const { ready, source } = attach(chunks(bytes(4)));
    source.open();
    await vi.waitFor(() => expect(source.sourceBuffer).not.toBeNull());
    source.sourceBuffer!.failNextAppend = true;
    source.sourceBuffer!.emit('error');

    await expect(ready).rejects.toThrow('TTS source buffer append failed');
  });

  it('rejects and closes the source when appendBuffer throws', async () => {
    const { ready, source } = attach(chunks(bytes(4)));
    source.addSourceBuffer = ((mime: string) => {
      const buffer = FakeMediaSource.prototype.addSourceBuffer.call(
        source,
        mime,
      ) as FakeSourceBuffer;
      buffer.appendThrows = true;
      return buffer;
    }) as typeof source.addSourceBuffer;
    source.open();

    await expect(ready).rejects.toThrow('sourcebuffer detached');
    await vi.waitFor(() => expect(source.endOfStreamCalls).toBe(1));
  });

  it('rejects when the stream produced no audio at all', async () => {
    const { ready, source } = attach(chunks());
    source.open();

    await expect(ready).rejects.toThrow('TTS stream produced no audio');
    expect(source.endOfStreamCalls).toBe(1);
  });

  // An aborted utterance is a teardown, not a failure: the source is already
  // being discarded, so calling endOfStream on it would only throw.
  it('does not end the stream when the read failed after an abort', async () => {
    const controller = new AbortController();
    let index = 0;
    const body = bodyOf(async () => {
      index += 1;
      if (index === 1) return { done: false, value: bytes(4) };
      controller.abort();
      throw new DOMException('The user aborted a request.', 'AbortError');
    });

    const { ready, source } = attach(body, controller.signal);
    source.open();
    await ready;
    await vi.waitFor(() => expect(index).toBe(2));

    expect(source.endOfStreamCalls).toBe(0);
  });

  it('swallows an endOfStream that throws on the failure path', async () => {
    let index = 0;
    const body = bodyOf(async () => {
      index += 1;
      if (index === 1) return { done: false, value: bytes(4) };
      sources[0].endOfStreamThrows = true;
      throw new Error('network dropped');
    });

    const { ready, source } = attach(body);
    source.open();
    await ready;
    await vi.waitFor(() => expect(source.endOfStreamCalls).toBe(1));

    expect(source.readyState).toBe('open');
  });

  it('leaves a source that is no longer open alone', async () => {
    let index = 0;
    const body = bodyOf(async () => {
      index += 1;
      if (index === 1) return { done: false, value: bytes(4) };
      sources[0].readyState = 'closed';
      return { done: true };
    });

    const { ready, source } = attach(body);
    source.open();
    await ready;
    await vi.waitFor(() => expect(index).toBe(2));

    expect(source.endOfStreamCalls).toBe(0);
  });
});
