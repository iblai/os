import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import type { KokoroResponse } from '@/lib/tts/kokoro.worker';

// ---------------------------------------------------------------------------
// The on-device (`iblai`) path of useSpeech.
//
// Both halves of the pipeline are replaced: `StreamPlayer` (covered in full by
// lib/tts/__tests__/stream-player.test.ts) and the Worker itself, which jsdom
// does not implement and which would otherwise download ~88 MB of weights.
// What is under test here is the wiring between them and the transport store
// the speak button reads.
// ---------------------------------------------------------------------------

const mockUseUsername = vi.fn();
const mockUseMentorSettings = vi.fn();

vi.mock('@/providers/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('../use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

vi.mock('@/lib/config', () => ({
  config: { dmUrl: () => 'https://dm.test' },
}));

vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: { DM_TOKEN_KEY: 'dm_token' },
}));

const players = vi.hoisted(() => {
  const instances: FakePlayerShape[] = [];
  const state = { startResolvesTo: true };

  class StreamPlayer {
    onDrained: (() => void) | null = null;
    start = vi.fn(async () => state.startResolvesTo);
    enqueue = vi.fn();
    markComplete = vi.fn();
    stop = vi.fn();
    pause = vi.fn();
    resume = vi.fn();
    constructor() {
      instances.push(this as unknown as FakePlayerShape);
    }
  }

  return { instances, state, StreamPlayer };
});

type FakePlayerShape = {
  onDrained: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  enqueue: ReturnType<typeof vi.fn>;
  markComplete: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

vi.mock('@/lib/tts/stream-player', () => ({
  StreamPlayer: players.StreamPlayer,
}));

import { useSpeech } from '../use-speech';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

type WorkerMessage = { type: string; [key: string]: unknown };

const workers: FakeWorker[] = [];

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  posted: WorkerMessage[] = [];
  terminated = false;

  constructor(readonly url: unknown) {
    workers.push(this);
  }

  postMessage(message: WorkerMessage) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  /** Delivers a message from the worker to whatever handler is attached. */
  emit(data: KokoroResponse | null) {
    this.onmessage?.({ data } as MessageEvent);
  }

  get lastGenerate() {
    return this.posted.filter((m) => m.type === 'generate').at(-1);
  }
}

const createdAudios: FakeAudio[] = [];

class FakeAudio {
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {});
  pause = vi.fn();
  constructor() {
    createdAudios.push(this);
  }
}

const createdUtterances: Array<{ text: string }> = [];

class FakeUtterance {
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {
    createdUtterances.push(this);
  }
}

const synthSpeak = vi.fn();
const synthCancel = vi.fn();

/** The singleton worker/player useSpeech reuses for the lifetime of the tab. */
function activeWorker() {
  const worker = workers.at(-1);
  if (!worker) throw new Error('no worker was created');
  return worker;
}

function activePlayer() {
  const player = players.instances.at(-1);
  if (!player) throw new Error('no player was created');
  return player;
}

/** Total synthesis requests posted since the last reset, across all workers. */
function generateCount() {
  return workers.reduce(
    (n, worker) =>
      n + worker.posted.filter((m) => m.type === 'generate').length,
    0,
  );
}

function chunk(overrides: Partial<Extract<KokoroResponse, { type: 'chunk' }>>) {
  return {
    type: 'chunk' as const,
    requestId: activeWorker().lastGenerate?.requestId as number,
    index: 0,
    total: 2,
    pcm: new Float32Array(2400),
    samplingRate: 24000,
    ...overrides,
  };
}

/**
 * Message ids are unique per test on purpose: the completed-utterance cache is
 * a module singleton keyed on the id, and reusing one across tests would turn
 * an unrelated test into a cache hit.
 */
let nextId = 0;
let objectUrlSeq = 0;
function messageId() {
  nextId += 1;
  return `msg-${nextId}`;
}

async function speakIblai(content = 'Hello there.') {
  const id = messageId();
  const { result } = renderHook(() =>
    useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
  );
  await act(async () => {
    result.current.speak({ id, content } as never);
  });
  return { result, id };
}

beforeEach(() => {
  // `workers` is NOT cleared: useSpeech builds the Worker once per tab and
  // reuses it, so clearing the array would lose the singleton the assertions
  // need. Its recorded traffic is reset instead.
  for (const worker of workers) {
    worker.posted.length = 0;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminated = false;
  }
  createdAudios.length = 0;
  createdUtterances.length = 0;
  players.state.startResolvesTo = true;
  for (const player of players.instances) {
    player.start.mockClear();
    player.enqueue.mockClear();
    player.markComplete.mockClear();
    player.stop.mockClear();
  }

  mockUseUsername.mockReset().mockReturnValue('alice');
  mockUseMentorSettings
    .mockReset()
    .mockReturnValue({ data: { voiceProvider: 'iblai' } });

  synthSpeak.mockReset();
  synthCancel.mockReset();
  (globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;
  (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
  (
    window as unknown as { SpeechSynthesisUtterance: unknown }
  ).SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak: synthSpeak, cancel: synthCancel },
  });

  objectUrlSeq = 0;
  URL.createObjectURL = vi.fn(() => {
    objectUrlSeq += 1;
    return `blob:kokoro-${objectUrlSeq}`;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSpeech — iblai (on-device) provider', () => {
  // MUST be the first test in this file. useSpeech builds the Worker once and
  // caches it for the lifetime of the tab, so construction can only be observed
  // failing before any other test has created it.
  describe('no Worker support', () => {
    it('falls back to the browser voice', async () => {
      (globalThis as unknown as { Worker: unknown }).Worker = undefined;

      const { result } = renderHook(() =>
        useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
      );
      await act(async () => {
        result.current.speak({
          id: messageId(),
          content: 'No workers here.',
        } as never);
      });

      expect(synthSpeak).toHaveBeenCalled();
      expect(createdUtterances.at(-1)?.text).toBe('No workers here.');
      expect(workers).toHaveLength(0);
    });
  });

  describe('routing', () => {
    it('is supported without an identity or a tenant, unlike the endpoint', () => {
      mockUseUsername.mockReturnValue(undefined);
      const { result } = renderHook(() => useSpeech({ mentorId: 'm1' }));
      expect(result.current.isSupported).toBe(true);
    });

    it('stays supported on a browser with no Web Speech API', () => {
      Reflect.deleteProperty(window, 'speechSynthesis');
      const { result } = renderHook(() => useSpeech({ mentorId: 'm1' }));
      expect(result.current.isSupported).toBe(true);
    });

    it('is unsupported when the browser has neither speech synthesis nor workers', () => {
      Reflect.deleteProperty(window, 'speechSynthesis');
      (globalThis as unknown as { Worker: unknown }).Worker = undefined;
      const { result } = renderHook(() => useSpeech({ mentorId: 'm1' }));
      expect(result.current.isSupported).toBe(false);
    });

    it('never calls the server TTS endpoint', async () => {
      await speakIblai();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('leaves the endpoint provider untouched', async () => {
      mockUseMentorSettings.mockReturnValue({
        data: { voiceProvider: 'openai' },
      });
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'audio/mpeg' },
        body: null,
        blob: async () => new Blob([new ArrayBuffer(8)]),
      })) as unknown as typeof fetch;

      const { result } = renderHook(() =>
        useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
      );
      await act(async () => {
        result.current.speak({ id: messageId(), content: 'hi' } as never);
      });

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
      expect(generateCount()).toBe(0);
    });
  });

  describe('synthesis request', () => {
    it('sends the markdown-stripped prose, never the raw markdown', async () => {
      await speakIblai('## Setup\n\nRun **npm install** now.');

      const request = activeWorker().lastGenerate;
      expect(request?.text).toBe('Setup\nRun npm install now.');
      expect(request?.text).not.toContain('#');
      expect(request?.text).not.toContain('**');
    });

    it('carries a resolved config so the worker reads no env of its own', async () => {
      await speakIblai();

      expect(activeWorker().lastGenerate?.config).toMatchObject({
        modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
        dtype: 'q8',
        voice: 'af_heart',
        wasmPaths: '/ort/',
      });
    });

    it('opens the audio graph before asking for any audio', async () => {
      await speakIblai();
      expect(activePlayer().start).toHaveBeenCalled();
      expect(activeWorker().posted.at(-1)?.type).toBe('generate');
    });

    it('shows the loading state until the first chunk arrives', async () => {
      const { result } = await speakIblai();

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isSpeaking).toBe(false);

      act(() => activeWorker().emit(chunk({ index: 0 })));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSpeaking).toBe(true);
    });

    it('speaks nothing when the message strips down to no prose', async () => {
      const { result } = await speakIblai('```ts\nconst a = 1;\n```');

      expect(generateCount()).toBe(0);
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('ignores a message with no content at all', async () => {
      const { result } = renderHook(() => useSpeech({ mentorId: 'm1' }));
      await act(async () => {
        result.current.speak({ id: messageId(), content: '' } as never);
      });
      expect(generateCount()).toBe(0);
    });
  });

  describe('streaming playback', () => {
    // The point of the whole design: chunk 1 plays while chunk 2 is still
    // being synthesised, so time-to-first-sound does not grow with length.
    it('schedules each chunk the moment it arrives', async () => {
      const { result } = await speakIblai();
      const worker = activeWorker();
      const player = activePlayer();

      // The plan message is bookkeeping only; it must not disturb playback.
      act(() =>
        worker.emit({
          type: 'plan',
          requestId: worker.lastGenerate?.requestId as number,
          total: 2,
        }),
      );
      expect(player.enqueue).not.toHaveBeenCalled();

      const first = chunk({ index: 0 });
      act(() => worker.emit(first));
      expect(player.enqueue).toHaveBeenCalledWith(first.pcm, 24000);
      expect(result.current.isSpeaking).toBe(true);

      const second = chunk({ index: 1 });
      act(() => worker.emit(second));
      expect(player.enqueue).toHaveBeenCalledTimes(2);
      expect(player.enqueue).toHaveBeenLastCalledWith(second.pcm, 24000);
      // Still the same utterance; no state churn on later chunks.
      expect(result.current.isSpeaking).toBe(true);
    });

    it('marks the stream complete rather than declaring playback over', async () => {
      const { result } = await speakIblai();
      const worker = activeWorker();

      act(() => worker.emit(chunk({ index: 0 })));
      act(() =>
        worker.emit({
          type: 'complete',
          requestId: worker.lastGenerate?.requestId as number,
          blob: new Blob([new ArrayBuffer(8)], { type: 'audio/wav' }),
        }),
      );

      expect(activePlayer().markComplete).toHaveBeenCalled();
      // The tail is still queued — the button must keep showing "stop".
      expect(result.current.isSpeaking).toBe(true);
    });

    it('clears the speaking state when the queue actually drains', async () => {
      const { result } = await speakIblai();
      act(() => activeWorker().emit(chunk({ index: 0 })));

      act(() => activePlayer().onDrained?.());

      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('discards replies from an utterance the user moved on from', async () => {
      const { result } = await speakIblai();
      const worker = activeWorker();

      act(() => worker.emit(chunk({ index: 0, requestId: -1 })));
      act(() => worker.emit(null));

      expect(activePlayer().enqueue).not.toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe('completed-utterance cache', () => {
    it('replays the assembled WAV instead of synthesising twice', async () => {
      const { result } = renderHook(() =>
        useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
      );
      const id = messageId();

      await act(async () => {
        result.current.speak({ id, content: 'Hello there.' } as never);
      });
      const worker = activeWorker();
      act(() => worker.emit(chunk({ index: 0 })));
      act(() =>
        worker.emit({
          type: 'complete',
          requestId: worker.lastGenerate?.requestId as number,
          blob: new Blob([new ArrayBuffer(8)], { type: 'audio/wav' }),
        }),
      );
      const generateCalls = worker.posted.filter(
        (m) => m.type === 'generate',
      ).length;

      act(() => result.current.stop());
      await act(async () => {
        result.current.speak({ id, content: 'Hello there.' } as never);
      });

      expect(worker.posted.filter((m) => m.type === 'generate')).toHaveLength(
        generateCalls,
      );
      expect(createdAudios).toHaveLength(1);
      expect(createdAudios[0].play).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(true);
      expect(result.current.currentMessageId).toBe(id);
    });

    it('clears state when the replay ends', async () => {
      const { result } = renderHook(() =>
        useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
      );
      const id = messageId();

      await act(async () => {
        result.current.speak({ id, content: 'Hello there.' } as never);
      });
      const worker = activeWorker();
      act(() =>
        worker.emit({
          type: 'complete',
          requestId: worker.lastGenerate?.requestId as number,
          blob: new Blob([new ArrayBuffer(8)], { type: 'audio/wav' }),
        }),
      );
      act(() => result.current.stop());
      await act(async () => {
        result.current.speak({ id, content: 'Hello there.' } as never);
      });

      act(() => createdAudios[0].onended?.());

      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('resets when the replay refuses to play', async () => {
      const { result } = renderHook(() =>
        useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
      );
      const id = messageId();

      await act(async () => {
        result.current.speak({ id, content: 'Hello there.' } as never);
      });
      const worker = activeWorker();
      act(() =>
        worker.emit({
          type: 'complete',
          requestId: worker.lastGenerate?.requestId as number,
          blob: new Blob([new ArrayBuffer(8)], { type: 'audio/wav' }),
        }),
      );
      act(() => result.current.stop());

      const failing = vi.fn(async () => {
        throw new Error('NotAllowedError');
      });
      class RefusingAudio extends FakeAudio {
        play = failing;
      }
      (globalThis as unknown as { Audio: unknown }).Audio = RefusingAudio;

      await act(async () => {
        result.current.speak({ id, content: 'Hello there.' } as never);
      });

      await waitFor(() => expect(result.current.isSpeaking).toBe(false));
      expect(result.current.currentMessageId).toBeNull();
    });

    it('releases the previous cached blob when a new message replaces it', async () => {
      const { result } = renderHook(() =>
        useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
      );

      for (let i = 0; i < 2; i += 1) {
        await act(async () => {
          result.current.speak({
            id: messageId(),
            content: 'Hello there.',
          } as never);
        });
        const worker = activeWorker();
        act(() =>
          worker.emit({
            type: 'complete',
            requestId: worker.lastGenerate?.requestId as number,
            blob: new Blob([new ArrayBuffer(8)], { type: 'audio/wav' }),
          }),
        );
      }

      // Exactly one cache slot: the first message's blob is released the
      // moment the second replaces it.
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:kokoro-1');
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:kokoro-2');
    });
  });

  describe('cancellation', () => {
    it('cancels the worker and silences the graph without killing the model', async () => {
      const { result } = await speakIblai();
      const worker = activeWorker();

      act(() => result.current.stop());

      expect(worker.posted.at(-1)).toEqual({ type: 'cancel' });
      expect(activePlayer().stop).toHaveBeenCalled();
      expect(worker.onmessage).toBeNull();
      // Terminating would throw away ~88MB of loaded weights.
      expect(worker.terminated).toBe(false);
      expect(result.current.isSpeaking).toBe(false);
    });

    it('supersedes an in-flight utterance when a new one starts', async () => {
      const { result } = renderHook(() =>
        useSpeech({ mentorId: 'm1', tenantKey: 'org-1' }),
      );
      await act(async () => {
        result.current.speak({ id: messageId(), content: 'First.' } as never);
      });
      const worker = activeWorker();
      const firstRequestId = worker.lastGenerate?.requestId;

      await act(async () => {
        result.current.speak({ id: messageId(), content: 'Second.' } as never);
      });

      expect(worker.posted.filter((m) => m.type === 'cancel')).not.toHaveLength(
        0,
      );
      expect(worker.lastGenerate?.requestId).not.toBe(firstRequestId);

      // A late chunk from the first run must not reach the new playback.
      act(() =>
        worker.emit(chunk({ index: 0, requestId: firstRequestId as number })),
      );
      expect(activePlayer().enqueue).not.toHaveBeenCalled();
    });
  });

  describe('degradation', () => {
    // `selectAutoplayLastAiMessage` speaks with no user gesture behind it, so
    // the context stays suspended and nothing would ever be heard. Falling back
    // beats burning a minute of CPU on silence.
    it('falls back to the browser voice when the audio context stays suspended', async () => {
      players.state.startResolvesTo = false;

      const { result } = await speakIblai('Autoplayed reply.');

      expect(createdUtterances).toHaveLength(1);
      expect(createdUtterances[0].text).toBe('Autoplayed reply.');
      expect(synthSpeak).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(true);
      expect(generateCount()).toBe(0);
    });

    it('falls back when the worker reports a failure', async () => {
      const { result } = await speakIblai('Model is unreachable.');
      const worker = activeWorker();

      act(() =>
        worker.emit({
          type: 'error',
          requestId: worker.lastGenerate?.requestId as number,
          message: 'Failed to fetch model',
        }),
      );

      expect(synthSpeak).toHaveBeenCalled();
      expect(createdUtterances[0].text).toBe('Model is unreachable.');
      expect(result.current.isSpeaking).toBe(true);
    });

    it('falls back when the worker itself fails to boot', async () => {
      await speakIblai('Worker is broken.');

      act(() => activeWorker().onerror?.(new ErrorEvent('error')));

      expect(synthSpeak).toHaveBeenCalled();
      expect(createdUtterances[0].text).toBe('Worker is broken.');
    });
  });
});

describe('useSpeech — device capability gates', () => {
  function withNavigatorProp<T>(
    name: 'userAgent' | 'maxTouchPoints' | 'gpu',
    value: unknown,
    run: () => Promise<T>,
  ): Promise<T> {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, name);
    Object.defineProperty(navigator, name, { configurable: true, value });
    return run().finally(() => {
      if (descriptor) Object.defineProperty(navigator, name, descriptor);
      else Reflect.deleteProperty(navigator, name);
    });
  }

  it('routes iOS to the system voice: every iOS browser is WebKit, and the model trips its tab memory kill', async () => {
    await withNavigatorProp(
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) CriOS/125.0',
      async () => {
        await speakIblai('Read this on an iPhone.');

        expect(generateCount()).toBe(0);
        expect(synthSpeak).toHaveBeenCalled();
        expect(createdUtterances[0].text).toBe('Read this on an iPhone.');
      },
    );
  });

  it('downgrades to wasm when navigator.gpu exists but refuses an adapter', async () => {
    await withNavigatorProp(
      'gpu',
      { requestAdapter: async () => null },
      async () => {
        await speakIblai('Blocklisted GPU.');

        const generate = activeWorker().lastGenerate;
        expect(generate?.config).toMatchObject({
          device: 'wasm',
          dtype: 'q8',
        });
      },
    );
  });

  it('keeps webgpu when the adapter is granted', async () => {
    await withNavigatorProp(
      'gpu',
      { requestAdapter: async () => ({}) },
      async () => {
        await speakIblai('Healthy GPU.');

        const generate = activeWorker().lastGenerate;
        expect(generate?.config).toMatchObject({
          device: 'webgpu',
          dtype: 'fp32',
        });
      },
    );
  });
});
