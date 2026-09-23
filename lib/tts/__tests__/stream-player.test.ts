import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StreamPlayer } from '../stream-player';

// ---------------------------------------------------------------------------
// Fakes
//
// Web Audio does not exist in jsdom, and the whole point of the scheduler is
// the arithmetic it performs against `currentTime` — so the fake exposes a
// clock the tests can move by hand rather than one that ticks on its own.
// ---------------------------------------------------------------------------

class FakeSource {
  buffer: FakeBuffer | null = null;
  startedAt: number | null = null;
  stopCalls = 0;
  connectedTo: unknown = null;
  /** When true, `stop()` throws the way a spent source does in browsers. */
  stopThrows = false;
  private endedListeners: Array<() => void> = [];

  connect(destination: unknown) {
    this.connectedTo = destination;
  }

  start(when: number) {
    this.startedAt = when;
  }

  stop() {
    this.stopCalls += 1;
    if (this.stopThrows) throw new Error('cannot call stop on a spent source');
  }

  addEventListener(type: string, listener: () => void) {
    if (type === 'ended') this.endedListeners.push(listener);
  }

  /** Fires the `ended` event the browser would fire when playback finishes. */
  finish() {
    for (const listener of [...this.endedListeners]) listener();
  }
}

class FakeBuffer {
  duration: number;
  copied: Float32Array | null = null;
  constructor(
    readonly channels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.duration = length / sampleRate;
  }
  copyToChannel(data: Float32Array) {
    this.copied = data;
  }
}

class FakeAudioContext {
  state: AudioContextState;
  currentTime = 0;
  destination = { id: 'destination' };
  sources: FakeSource[] = [];
  buffers: FakeBuffer[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  suspend = vi.fn(async () => {
    this.state = 'suspended';
  });

  constructor() {
    this.state = nextContextState;
    contexts.push(this);
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = new FakeBuffer(channels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
  }

  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
}

let contexts: FakeAudioContext[] = [];
let nextContextState: AudioContextState = 'running';

function installAudioContext(ctor: unknown = FakeAudioContext) {
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: ctor,
  });
}

function pcm(length: number) {
  return new Float32Array(length).fill(0.5);
}

beforeEach(() => {
  contexts = [];
  nextContextState = 'running';
  installAudioContext();
  Reflect.deleteProperty(window, 'webkitAudioContext');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StreamPlayer', () => {
  describe('start', () => {
    it('reports ready when the context is running', async () => {
      const player = new StreamPlayer();
      await expect(player.start()).resolves.toBe(true);
      expect(contexts).toHaveLength(1);
    });

    it('reuses the context across utterances', async () => {
      const player = new StreamPlayer();
      await player.start();
      await player.start();
      expect(contexts).toHaveLength(1);
    });

    it('resumes a context that started suspended', async () => {
      nextContextState = 'suspended';
      const player = new StreamPlayer();
      await expect(player.start()).resolves.toBe(true);
      expect(contexts[0].resume).toHaveBeenCalled();
    });

    // The autoplay case: a context created without a user gesture stays
    // suspended, and Chrome's resume() promise simply never settles. Reporting
    // false is what lets useSpeech fall back instead of synthesising into a
    // void.
    it('reports not-ready when a blocked context never resumes', async () => {
      nextContextState = 'suspended';
      installAudioContext(
        class extends FakeAudioContext {
          resume = vi.fn(() => new Promise<void>(() => {}));
        },
      );
      const player = new StreamPlayer();
      await expect(player.start()).resolves.toBe(false);
    });

    it('reports not-ready when resume rejects outright', async () => {
      nextContextState = 'suspended';
      installAudioContext(
        class extends FakeAudioContext {
          resume = vi.fn(() => Promise.reject(new Error('nope')));
        },
      );
      const player = new StreamPlayer();
      await expect(player.start()).resolves.toBe(false);
    });

    it('reports not-ready when the browser has no Web Audio at all', async () => {
      Reflect.deleteProperty(window, 'AudioContext');
      const player = new StreamPlayer();
      await expect(player.start()).resolves.toBe(false);
      expect(contexts).toHaveLength(0);
    });

    // The hook is a client component, but it is still evaluated during SSR.
    it('reports not-ready when there is no window at all', async () => {
      vi.stubGlobal('window', undefined);
      try {
        const player = new StreamPlayer();
        await expect(player.start()).resolves.toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('accepts the webkit-prefixed constructor', async () => {
      Reflect.deleteProperty(window, 'AudioContext');
      Object.defineProperty(window, 'webkitAudioContext', {
        configurable: true,
        writable: true,
        value: FakeAudioContext,
      });
      const player = new StreamPlayer();
      await expect(player.start()).resolves.toBe(true);
    });
  });

  describe('scheduling', () => {
    it('gives the first chunk a little lead time', async () => {
      const player = new StreamPlayer();
      await player.start();
      contexts[0].currentTime = 10;

      player.enqueue(pcm(2400), 24000);

      expect(contexts[0].sources[0].startedAt).toBeCloseTo(10.05);
      expect(contexts[0].sources[0].connectedTo).toBe(contexts[0].destination);
      expect(contexts[0].buffers[0].copied).toHaveLength(2400);
    });

    // The heart of the design: chunk N+1 starts exactly where chunk N ends,
    // with no `ended` callback in the loop, so the seam is inaudible.
    it('starts each chunk exactly where the previous one ends', async () => {
      const player = new StreamPlayer();
      await player.start();

      player.enqueue(pcm(24000), 24000); // 1.0s
      contexts[0].currentTime = 0.2; // still playing chunk 1
      player.enqueue(pcm(12000), 24000); // 0.5s

      expect(contexts[0].sources[0].startedAt).toBeCloseTo(0.05);
      expect(contexts[0].sources[1].startedAt).toBeCloseTo(1.05);
      expect(player.queuedSeconds).toBeCloseTo(1.5);
    });

    // Single-threaded WASM can generate slower than realtime. The cursor is
    // then in the past, and the chunk must start now rather than being
    // scheduled into a moment that has already gone by.
    it('starts immediately when generation has fallen behind realtime', async () => {
      const player = new StreamPlayer();
      await player.start();

      player.enqueue(pcm(24000), 24000); // ends at 1.05
      contexts[0].currentTime = 9; // generation took 9 seconds

      player.enqueue(pcm(24000), 24000);

      expect(contexts[0].sources[1].startedAt).toBe(9);
    });

    it('ignores an empty chunk', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.enqueue(new Float32Array(0), 24000);
      expect(contexts[0].sources).toHaveLength(0);
    });

    it('ignores chunks that arrive before start', () => {
      const player = new StreamPlayer();
      player.enqueue(pcm(10), 24000);
      expect(contexts).toHaveLength(0);
    });
  });

  describe('elapsed', () => {
    it('is zero before anything is queued', async () => {
      const player = new StreamPlayer();
      expect(player.elapsed).toBe(0);
      await player.start();
      expect(player.elapsed).toBe(0);
    });

    it('tracks the context clock from the first chunk', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.enqueue(pcm(24000), 24000);
      contexts[0].currentTime = 0.55;
      expect(player.elapsed).toBeCloseTo(0.5);
    });

    it('never runs past what has actually been queued', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.enqueue(pcm(24000), 24000);
      contexts[0].currentTime = 99;
      expect(player.elapsed).toBe(1);
    });

    it('never goes negative before the lead time elapses', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.enqueue(pcm(24000), 24000);
      expect(player.elapsed).toBe(0);
    });
  });

  describe('drain signalling', () => {
    it('fires once the last chunk of a completed stream finishes', async () => {
      const player = new StreamPlayer();
      const onDrained = vi.fn();
      player.onDrained = onDrained;
      await player.start();

      player.enqueue(pcm(24000), 24000);
      player.enqueue(pcm(24000), 24000);
      player.markComplete();
      expect(onDrained).not.toHaveBeenCalled();

      contexts[0].sources[0].finish();
      expect(onDrained).not.toHaveBeenCalled();

      contexts[0].sources[1].finish();
      expect(onDrained).toHaveBeenCalledTimes(1);
    });

    // `complete` only means generation finished; chunks still ending is normal.
    it('does not fire while chunks are still being generated', async () => {
      const player = new StreamPlayer();
      const onDrained = vi.fn();
      player.onDrained = onDrained;
      await player.start();

      player.enqueue(pcm(24000), 24000);
      contexts[0].sources[0].finish();

      expect(onDrained).not.toHaveBeenCalled();
    });

    it('fires immediately when the tail had already played out', async () => {
      const player = new StreamPlayer();
      const onDrained = vi.fn();
      player.onDrained = onDrained;
      await player.start();

      player.enqueue(pcm(24000), 24000);
      contexts[0].sources[0].finish();
      player.markComplete();

      expect(onDrained).toHaveBeenCalledTimes(1);
    });

    it('tolerates having no listener attached', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.enqueue(pcm(24000), 24000);
      expect(() => player.markComplete()).not.toThrow();
    });

    // A deliberate stop must not look like the message finishing naturally,
    // or the button would report "done" on a cancel.
    it('does not fire when the user stops mid-utterance', async () => {
      const player = new StreamPlayer();
      const onDrained = vi.fn();
      player.onDrained = onDrained;
      await player.start();

      player.enqueue(pcm(24000), 24000);
      player.markComplete();
      const source = contexts[0].sources[0];
      player.stop();
      source.finish(); // browsers fire `ended` for a stopped source too

      expect(onDrained).not.toHaveBeenCalled();
    });
  });

  describe('pause and resume', () => {
    it('suspends the clock, freezing every scheduled start time', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.pause();
      expect(contexts[0].suspend).toHaveBeenCalled();
      expect(player.paused).toBe(true);
    });

    it('resumes from suspended', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.pause();
      contexts[0].resume.mockClear();
      player.resume();
      expect(contexts[0].resume).toHaveBeenCalled();
      expect(player.paused).toBe(false);
    });

    it('is inert without a context', () => {
      const player = new StreamPlayer();
      expect(() => {
        player.pause();
        player.resume();
      }).not.toThrow();
      expect(player.paused).toBe(false);
    });

    it('ignores a pause when already suspended and a resume when running', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.resume(); // already running
      contexts[0].resume.mockClear();
      player.pause();
      player.pause(); // already suspended
      expect(contexts[0].suspend).toHaveBeenCalledTimes(1);
      expect(contexts[0].resume).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('cancels every scheduled source and rewinds the cursor', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.enqueue(pcm(24000), 24000);
      player.enqueue(pcm(24000), 24000);

      player.stop();

      expect(contexts[0].sources.every((s) => s.stopCalls === 1)).toBe(true);
      expect(player.queuedSeconds).toBe(0);
      expect(player.elapsed).toBe(0);

      // A fresh utterance starts from the lead time again, not from the old
      // cursor.
      contexts[0].currentTime = 5;
      player.enqueue(pcm(24000), 24000);
      expect(contexts[0].sources[2].startedAt).toBeCloseTo(5.05);
    });

    it('swallows the throw from stopping an already-finished source', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.enqueue(pcm(24000), 24000);
      contexts[0].sources[0].stopThrows = true;
      expect(() => player.stop()).not.toThrow();
    });

    it('leaves a paused context ready for the next utterance', async () => {
      const player = new StreamPlayer();
      await player.start();
      player.pause();
      contexts[0].resume.mockClear();
      player.stop();
      expect(contexts[0].resume).toHaveBeenCalled();
    });

    it('is safe before any context exists', () => {
      const player = new StreamPlayer();
      expect(() => player.stop()).not.toThrow();
    });
  });
});
