import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

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

import { useSpeech } from '../use-speech';

type AudioInstance = {
  src: string;
  paused: boolean;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  onerror: (() => void) | null;
};

let createdAudios: AudioInstance[] = [];

class FakeAudio implements AudioInstance {
  src: string;
  paused = true;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(src = '') {
    this.src = src;
    createdAudios.push(this);
  }
}

type UtteranceInstance = {
  text: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

let createdUtterances: UtteranceInstance[] = [];

class FakeUtterance implements UtteranceInstance {
  text: string;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
    createdUtterances.push(this);
  }
}

const speak = vi.fn();
const cancel = vi.fn();

beforeEach(() => {
  createdAudios = [];
  createdUtterances = [];
  speak.mockReset();
  cancel.mockReset();
  mockUseUsername.mockReset();
  mockUseMentorSettings.mockReset();
  mockUseUsername.mockReturnValue('alice');
  mockUseMentorSettings.mockReturnValue({ data: { voiceProvider: 'browser' } });
  window.localStorage.clear();

  // Install fake speech APIs on the jsdom window
  (
    window as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }
  ).SpeechSynthesisUtterance = FakeUtterance;
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak, cancel },
  });

  // Audio constructor used by useSpeech
  (globalThis as unknown as { Audio: typeof FakeAudio }).Audio = FakeAudio;

  // jsdom doesn't implement object URLs — stub them so playback can attach.
  URL.createObjectURL = vi.fn(
    () => 'blob:fake-url',
  ) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;

  // jsdom has no MediaSource, so the hook uses the buffered fallback by
  // default. Streaming-specific tests install a fake MediaSource explicitly.
  delete (window as unknown as { MediaSource?: unknown }).MediaSource;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function headers(contentType: string | null) {
  return {
    get: (key: string) =>
      key.toLowerCase() === 'content-type' ? contentType : null,
  };
}

// A successful, fully-buffered response (no streaming body). The hook reads it
// via response.blob() and plays it from an object URL.
function mockFetchOk(contentType: string | null = 'audio/mpeg') {
  const blob = new Blob([new ArrayBuffer(8)]);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: headers(contentType),
    body: null,
    blob: async () => blob,
  })) as unknown as typeof fetch;
}

function mockFetchFail(status = 500) {
  globalThis.fetch = vi.fn(async () => ({
    ok: false,
    status,
    headers: headers(null),
    body: null,
    blob: async () => new Blob([]),
  })) as unknown as typeof fetch;
}

describe('useSpeech', () => {
  describe('initial state and support detection', () => {
    it('exposes idle initial snapshot and browser support', () => {
      const { result } = renderHook(() => useSpeech());
      expect(result.current.currentMessageId).toBeNull();
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSupported).toBe(true);
    });

    it('reports endpoint support when voiceProvider is set and identity/tenant are present', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { voiceProvider: 'openai' },
      });
      const { result } = renderHook(() =>
        useSpeech({ tenantKey: 'org-1', mentorId: 'm1' }),
      );
      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('speakViaBrowser', () => {
    it('uses SpeechSynthesisUtterance and updates snapshot', () => {
      const { result } = renderHook(() => useSpeech());
      act(() => {
        result.current.speak({
          id: 'msg-1',
          content: 'hello there',
        } as never);
      });
      expect(speak).toHaveBeenCalledTimes(1);
      expect(createdUtterances).toHaveLength(1);
      expect(createdUtterances[0].text).toBe('hello there');
      expect(result.current.isSpeaking).toBe(true);
      expect(result.current.currentMessageId).toBe('msg-1');

      act(() => {
        createdUtterances[0].onend?.();
      });
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('clears snapshot when utterance errors', () => {
      const { result } = renderHook(() => useSpeech());
      act(() => {
        result.current.speak({ id: 'm2', content: 'words' } as never);
      });
      act(() => {
        createdUtterances[0].onerror?.();
      });
      expect(result.current.isSpeaking).toBe(false);
    });

    it('ignores messages with empty content', () => {
      const { result } = renderHook(() => useSpeech());
      act(() => {
        result.current.speak({ id: 'm3', content: '' } as never);
      });
      expect(speak).not.toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(false);
    });
  });

  describe('speakViaEndpoint (buffered fallback)', () => {
    beforeEach(() => {
      mockUseMentorSettings.mockReturnValue({
        data: { voiceProvider: 'openai' },
      });
      window.localStorage.setItem('dm_token', 'tok-123');
    });

    it('fetches the TTS endpoint and plays the returned audio', async () => {
      mockFetchOk();

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));

      await act(async () => {
        result.current.speak({ id: 'm-endpoint', content: 'play me' } as never);
      });

      await waitFor(() => expect(createdAudios).toHaveLength(1));
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://dm.test/api/ai-mentor/orgs/org-1/users/alice/chat-messages/m-endpoint/tts',
        expect.objectContaining({
          method: 'GET',
          cache: 'no-cache',
          headers: { Authorization: 'Token tok-123' },
        }),
      );
      expect(createdAudios[0].src).toBe('blob:fake-url');
      expect(createdAudios[0].play).toHaveBeenCalled();
      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      expect(result.current.currentMessageId).toBe('m-endpoint');

      act(() => {
        createdAudios[0].onended?.();
      });
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
      // The object URL backing playback is released when playback ends.
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    });

    it('falls back to browser speech when the endpoint returns a non-audio payload', async () => {
      mockFetchOk('application/json');

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));

      await act(async () => {
        result.current.speak({
          id: 'm-fb',
          content: 'fallback please',
        } as never);
      });

      await waitFor(() => expect(createdUtterances).toHaveLength(1));
      expect(speak).toHaveBeenCalled();
      // An audio element is created up front but never played for non-audio.
      expect(createdAudios[0]?.play).not.toHaveBeenCalled();
    });

    it('defaults the audio type and plays when no content-type is returned', async () => {
      mockFetchOk(null);

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({
          id: 'm-noct',
          content: 'no content type',
        } as never);
      });

      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      expect(createdAudios[0].play).toHaveBeenCalled();
    });

    it('omits the auth header when no DM token is available', async () => {
      window.localStorage.removeItem('dm_token');
      mockFetchOk();

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-noauth', content: 'no token' } as never);
      });

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0][1] as RequestInit;
      expect(call.headers).toBeUndefined();
    });

    it('resets state when the fetch fails', async () => {
      mockFetchFail(500);
      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));

      await act(async () => {
        result.current.speak({ id: 'm-err', content: 'broken' } as never);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('swallows the abort error when playback is stopped mid-request', async () => {
      // A request that only settles when its abort signal fires.
      globalThis.fetch = vi.fn(
        (_url, opts) =>
          new Promise((_resolve, reject) => {
            (opts as RequestInit).signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-abort', content: 'abort me' } as never);
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        result.current.stop();
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('emits audio error -> resets snapshot', async () => {
      mockFetchOk();

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-aerr', content: 'audio err' } as never);
      });
      await waitFor(() => expect(createdAudios).toHaveLength(1));

      act(() => {
        createdAudios[0].onerror?.();
      });
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('does nothing when username or tenant is missing in endpoint mode', async () => {
      mockUseUsername.mockReturnValue('');
      mockFetchOk();
      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-skip', content: 'noop' } as never);
      });
      // useEndpoint is false -> falls back to browser speech
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(speak).toHaveBeenCalled();
    });
  });

  describe('speakViaEndpoint (progressive MediaSource streaming)', () => {
    let fakeMediaSource: FakeMediaSource;

    type Listener = () => void;

    class FakeSourceBuffer {
      appended: Uint8Array[] = [];
      failOnAppend = false;
      private listeners: Record<string, Listener[]> = {};
      addEventListener(type: string, cb: Listener) {
        (this.listeners[type] ||= []).push(cb);
      }
      removeEventListener(type: string, cb: Listener) {
        this.listeners[type] = (this.listeners[type] || []).filter(
          (l) => l !== cb,
        );
      }
      appendBuffer(chunk: Uint8Array) {
        this.appended.push(chunk);
        // Mirror the async nature of a real append, emitting either success
        // (`updateend`) or failure (`error`) on the next microtask.
        const event = this.failOnAppend ? 'error' : 'updateend';
        queueMicrotask(() => (this.listeners[event] || []).forEach((l) => l()));
      }
    }

    class FakeMediaSource {
      static isTypeSupported = vi.fn(() => true);
      readyState: 'closed' | 'open' | 'ended' = 'closed';
      sourceBuffers: FakeSourceBuffer[] = [];
      endOfStream = vi.fn(() => {
        this.readyState = 'ended';
      });
      addSourceBuffer = vi.fn((_mime: string) => {
        const sb = new FakeSourceBuffer();
        this.sourceBuffers.push(sb);
        return sb;
      });
      private listeners: Record<string, Listener[]> = {};
      addEventListener(type: string, cb: Listener) {
        (this.listeners[type] ||= []).push(cb);
        if (type === 'sourceopen') {
          // The browser opens the source asynchronously after src assignment.
          queueMicrotask(() => {
            this.readyState = 'open';
            cb();
          });
        }
      }
      removeEventListener(type: string, cb: Listener) {
        this.listeners[type] = (this.listeners[type] || []).filter(
          (l) => l !== cb,
        );
      }
    }

    function mockFetchStream(
      chunks: Uint8Array[],
      { contentType = 'audio/mpeg', readError = false } = {},
    ) {
      let i = 0;
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: headers(contentType),
        body: {
          getReader: () => ({
            read: vi.fn(async () => {
              if (i < chunks.length) {
                return { done: false, value: chunks[i++] };
              }
              if (readError) {
                throw new Error('network dropped mid-stream');
              }
              return { done: true, value: undefined };
            }),
          }),
        },
        blob: async () => new Blob([]),
      })) as unknown as typeof fetch;
    }

    beforeEach(() => {
      mockUseMentorSettings.mockReturnValue({
        data: { voiceProvider: 'openai' },
      });
      window.localStorage.setItem('dm_token', 'tok-123');
      fakeMediaSource = new FakeMediaSource();
      // The hook does `new window.MediaSource()`; hand back our single instance
      // so the test can assert against it.
      const ctor = function () {
        return fakeMediaSource;
      } as unknown as typeof MediaSource;
      (
        ctor as unknown as {
          isTypeSupported: typeof FakeMediaSource.isTypeSupported;
        }
      ).isTypeSupported = FakeMediaSource.isTypeSupported;
      (window as unknown as { MediaSource: typeof MediaSource }).MediaSource =
        ctor;
    });

    it('streams chunks through a SourceBuffer and plays progressively', async () => {
      const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
      mockFetchStream(chunks);

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));

      await act(async () => {
        result.current.speak({ id: 'm-stream', content: 'stream me' } as never);
      });

      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      expect(FakeMediaSource.isTypeSupported).toHaveBeenCalledWith(
        'audio/mpeg',
      );
      expect(fakeMediaSource.addSourceBuffer).toHaveBeenCalledWith(
        'audio/mpeg',
      );
      expect(createdAudios[0].src).toBe('blob:fake-url');
      expect(createdAudios[0].play).toHaveBeenCalled();

      // All chunks are appended and the stream is finalised.
      await waitFor(() =>
        expect(fakeMediaSource.sourceBuffers[0].appended).toHaveLength(2),
      );
      await waitFor(() =>
        expect(fakeMediaSource.endOfStream).toHaveBeenCalled(),
      );
      expect(result.current.currentMessageId).toBe('m-stream');
    });

    it('normalises audio/mp3 to audio/mpeg for streaming', async () => {
      mockFetchStream([new Uint8Array([1, 2, 3])], {
        contentType: 'audio/mp3',
      });

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-mp3', content: 'mp3' } as never);
      });

      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      expect(fakeMediaSource.addSourceBuffer).toHaveBeenCalledWith(
        'audio/mpeg',
      );
    });

    it('falls back to buffered playback when the codec is not stream-supported', async () => {
      mockFetchStream([new Uint8Array([1, 2, 3])]);
      (
        window as unknown as { MediaSource: { isTypeSupported: () => boolean } }
      ).MediaSource.isTypeSupported = vi.fn(() => false);

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-nocodec', content: 'no codec' } as never);
      });

      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      // No streaming: the buffered fallback plays from an object URL instead.
      expect(fakeMediaSource.addSourceBuffer).not.toHaveBeenCalled();
      expect(createdAudios[0].src).toBe('blob:fake-url');
      expect(createdAudios[0].play).toHaveBeenCalled();
    });

    it('skips empty chunks while streaming', async () => {
      mockFetchStream([new Uint8Array(0), new Uint8Array([1, 2, 3])]);

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-gap', content: 'gap' } as never);
      });

      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      // The zero-length chunk is ignored; only the real chunk is buffered.
      await waitFor(() =>
        expect(fakeMediaSource.sourceBuffers[0].appended).toHaveLength(1),
      );
    });

    it('resets when the browser cannot create a source buffer for the stream', async () => {
      mockFetchStream([new Uint8Array([1, 2, 3])]);
      fakeMediaSource.addSourceBuffer = vi.fn(() => {
        throw new Error('unsupported codec');
      });

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-nosb', content: 'no buffer' } as never);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(fakeMediaSource.addSourceBuffer).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('resets and finalises the stream when a chunk fails to buffer', async () => {
      mockFetchStream([new Uint8Array([1, 2, 3])]);
      const failingBuffer = new FakeSourceBuffer();
      failingBuffer.failOnAppend = true;
      fakeMediaSource.addSourceBuffer = vi.fn(() => failingBuffer);

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-aperr', content: 'append err' } as never);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
      // The pump tears the source down after the append error.
      expect(fakeMediaSource.endOfStream).toHaveBeenCalled();
    });

    it('resets when the stream errors mid-download', async () => {
      mockFetchStream([new Uint8Array([1, 2, 3])], { readError: true });

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-neterr', content: 'drop' } as never);
      });

      // The first chunk buffers and plays, then the read rejects.
      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      await waitFor(() =>
        expect(fakeMediaSource.endOfStream).toHaveBeenCalled(),
      );
    });

    it('resets when the stream produces no audio', async () => {
      mockFetchStream([]);

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-empty', content: 'silence' } as never);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('stops streaming without re-finalising the source when aborted mid-stream', async () => {
      // First read yields a chunk; the second only settles when aborted.
      let reads = 0;
      globalThis.fetch = vi.fn((_url, opts) =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: headers('audio/mpeg'),
          body: {
            getReader: () => ({
              read: vi.fn(() => {
                reads += 1;
                if (reads === 1) {
                  return Promise.resolve({
                    done: false,
                    value: new Uint8Array([1, 2, 3]),
                  });
                }
                return new Promise((_resolve, reject) => {
                  (opts as RequestInit).signal?.addEventListener('abort', () =>
                    reject(new DOMException('Aborted', 'AbortError')),
                  );
                });
              }),
            }),
          },
          blob: async () => new Blob([]),
        }),
      ) as unknown as typeof fetch;

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({
          id: 'm-streamabort',
          content: 'abort stream',
        } as never);
      });

      // The first chunk buffers and plays.
      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      fakeMediaSource.endOfStream.mockClear();

      await act(async () => {
        result.current.stop();
        await Promise.resolve();
      });

      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
      // An aborted stream is torn down by stop(), not finalised by the pump.
      expect(fakeMediaSource.endOfStream).not.toHaveBeenCalled();
    });
  });

  describe('toggle and stop', () => {
    it('stop resets the snapshot and tears down active audio', async () => {
      mockUseMentorSettings.mockReturnValue({
        data: { voiceProvider: 'openai' },
      });
      window.localStorage.setItem('dm_token', 'tok-123');
      mockFetchOk();

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));
      await act(async () => {
        result.current.speak({ id: 'm-stop', content: 'stop me' } as never);
      });
      await waitFor(() => expect(createdAudios).toHaveLength(1));

      act(() => {
        result.current.stop();
      });
      expect(createdAudios[0].pause).toHaveBeenCalled();
      expect(result.current.isSpeaking).toBe(false);
      expect(cancel).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    });

    it('toggle stops when the same message is active', () => {
      const { result } = renderHook(() => useSpeech());
      act(() => {
        result.current.toggle({ id: 'm-t', content: 'first' } as never);
      });
      expect(result.current.isSpeaking).toBe(true);

      act(() => {
        result.current.toggle({ id: 'm-t', content: 'first' } as never);
      });
      expect(result.current.isSpeaking).toBe(false);
    });

    it('toggle starts speech when no message is active', () => {
      const { result } = renderHook(() => useSpeech());
      act(() => {
        result.current.toggle({ id: 'm-t2', content: 'second' } as never);
      });
      expect(speak).toHaveBeenCalled();
      expect(result.current.currentMessageId).toBe('m-t2');
    });
  });

  describe('cleanup on unmount', () => {
    it('resets speech state when the last consumer unmounts', () => {
      const { result, unmount } = renderHook(() => useSpeech());
      act(() => {
        result.current.speak({ id: 'm-u', content: 'bye' } as never);
      });
      expect(result.current.isSpeaking).toBe(true);
      unmount();
      expect(cancel).toHaveBeenCalled();
    });
  });
});
