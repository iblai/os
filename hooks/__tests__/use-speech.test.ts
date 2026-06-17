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
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(data: ArrayBuffer | string = new ArrayBuffer(8)) {
  const blob = new Blob([data]);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    blob: async () => blob,
  })) as unknown as typeof fetch;
}

function mockFetchFail(status = 500) {
  globalThis.fetch = vi.fn(async () => ({
    ok: false,
    status,
    blob: async () => new Blob([]),
  })) as unknown as typeof fetch;
}

function stubFileReader(result: string | null) {
  class StubReader {
    onloadend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    result: string | null = result;
    error: unknown = null;
    readAsDataURL() {
      queueMicrotask(() => {
        if (result === null) {
          this.error = new Error('reader failed');
          this.onerror?.();
        } else {
          this.onloadend?.();
        }
      });
    }
  }
  (globalThis as unknown as { FileReader: typeof StubReader }).FileReader =
    StubReader;
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

  describe('speakViaEndpoint', () => {
    beforeEach(() => {
      mockUseMentorSettings.mockReturnValue({
        data: { voiceProvider: 'openai' },
      });
      window.localStorage.setItem('dm_token', 'tok-123');
    });

    it('fetches the TTS endpoint and plays the returned audio', async () => {
      mockFetchOk();
      stubFileReader('data:audio/mp3;base64,AAA');

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
      expect(createdAudios[0].play).toHaveBeenCalled();
      await waitFor(() => expect(result.current.isSpeaking).toBe(true));
      expect(result.current.currentMessageId).toBe('m-endpoint');

      act(() => {
        createdAudios[0].onended?.();
      });
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.currentMessageId).toBeNull();
    });

    it('falls back to browser speech when the endpoint returns a non-data URL', async () => {
      mockFetchOk();
      stubFileReader('https://not-a-data-url.test/audio.mp3');

      const { result } = renderHook(() => useSpeech({ tenantKey: 'org-1' }));

      await act(async () => {
        result.current.speak({
          id: 'm-fb',
          content: 'fallback please',
        } as never);
      });

      await waitFor(() => expect(createdUtterances).toHaveLength(1));
      expect(createdAudios).toHaveLength(0);
      expect(speak).toHaveBeenCalled();
    });

    it('omits the auth header when no DM token is available', async () => {
      window.localStorage.removeItem('dm_token');
      mockFetchOk();
      stubFileReader('data:audio/mp3;base64,AAA');

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

    it('emits audio error -> resets snapshot', async () => {
      mockFetchOk();
      stubFileReader('data:audio/mp3;base64,AAA');

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

  describe('toggle and stop', () => {
    it('stop resets the snapshot and tears down active audio', async () => {
      mockUseMentorSettings.mockReturnValue({
        data: { voiceProvider: 'openai' },
      });
      mockFetchOk();
      stubFileReader('data:audio/mp3;base64,AAA');

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
