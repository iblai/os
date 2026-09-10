import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockAudioToText = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useAudioToTextMutation: () => [mockAudioToText],
}));

const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

const mockStart = vi.fn();
const mockStop = vi.fn();
vi.mock('@/hooks/use-timer', () => ({
  useTimer: () => ({
    start: mockStart,
    stop: mockStop,
    time: 0,
  }),
}));

import useVoiceChat, {
  pickMimeType,
  extensionFor,
  micErrorMessage,
} from '../use-voice-chat';
import { toast } from 'sonner';

type Recorder = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
};

describe('useVoiceChat', () => {
  const mockOnTranscript = vi.fn();
  const mockGetUserMedia = vi.fn();
  const trackStop = vi.fn();
  let recorder: Recorder;
  let mockStream: { getTracks: ReturnType<typeof vi.fn> };

  const render = () =>
    renderHook(() => useVoiceChat({ onTranscript: mockOnTranscript }));

  /** Drive a full record -> stop cycle, emitting `bytes` of audio. */
  const record = async (
    result: ReturnType<typeof render>['result'],
    { bytes = 2048, elapsedMs = 4000 } = {},
  ) => {
    await act(async () => {
      await result.current.handleMicrophoneBtnClick();
    });
    if (bytes > 0) {
      recorder.ondataavailable?.({ data: new Blob(['x'.repeat(bytes)]) });
    }
    vi.setSystemTime(new Date(Date.now() + elapsedMs));
    await act(async () => {
      await result.current.handleMicrophoneBtnClick();
    });
    await act(async () => {
      recorder.onstop?.();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-27T00:00:00Z'));

    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');

    mockStream = { getTracks: vi.fn().mockReturnValue([{ stop: trackStop }]) };

    recorder = {
      start: vi.fn(),
      stop: vi.fn(function (this: Recorder) {
        this.state = 'inactive';
      }),
      state: 'recording',
      mimeType: 'audio/webm;codecs=opus',
      ondataavailable: null,
      onstop: null,
      onerror: null,
    };

    mockGetUserMedia.mockResolvedValue(mockStream);
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });

    const Ctor = vi.fn(() => recorder) as unknown as {
      isTypeSupported: (t: string) => boolean;
    };
    Ctor.isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus';
    vi.stubGlobal('MediaRecorder', Ctor);

    mockAudioToText.mockReturnValue({
      unwrap: () => Promise.resolve({ text: 'transcribed text' }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns recording false, processing false and a timer value', () => {
      const { result } = render();
      expect(result.current.recording).toBe(false);
      expect(result.current.processing).toBe(false);
      expect(result.current.time).toBe(0);
      expect(typeof result.current.handleMicrophoneBtnClick).toBe('function');
    });
  });

  describe('starting recording', () => {
    it('requests the mic with noise-suppression constraints and starts the timer', async () => {
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      expect(result.current.recording).toBe(true);
      expect(mockStart).toHaveBeenCalled();
    });

    it('starts the recorder with a timeslice so a cluster is flushed early', async () => {
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      expect(recorder.start).toHaveBeenCalledWith(250);
    });

    it('selects a supported mime type', async () => {
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      expect(MediaRecorder).toHaveBeenCalledWith(mockStream, {
        mimeType: 'audio/webm;codecs=opus',
      });
    });

    it('omits the mime option when none is supported', async () => {
      (
        MediaRecorder as unknown as { isTypeSupported: () => boolean }
      ).isTypeSupported = () => false;
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      expect(MediaRecorder).toHaveBeenCalledWith(mockStream, undefined);
    });
  });

  describe('stopping and transcribing', () => {
    it('uploads the audio and hands the transcript back', async () => {
      const { result } = render();
      await record(result);

      await waitFor(() => expect(mockAudioToText).toHaveBeenCalled());
      expect(mockAudioToText).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'tenant-1', userId: 'testuser' }),
      );
      await waitFor(() =>
        expect(mockOnTranscript).toHaveBeenCalledWith('transcribed text'),
      );
      expect(mockStop).toHaveBeenCalled();
      expect(result.current.recording).toBe(false);
    });

    it('names the file from the recorder mime type', async () => {
      recorder.mimeType = 'audio/mp4';
      const { result } = render();
      await record(result);

      await waitFor(() => expect(mockAudioToText).toHaveBeenCalled());
      const { formData } = mockAudioToText.mock.calls[0][0];
      expect(formData.file.name).toBe('recording.mp4');
      expect(formData.file.type).toBe('audio/mp4');
    });

    it('releases every track after the recording stops', async () => {
      const { result } = render();
      await record(result);
      expect(trackStop).toHaveBeenCalled();
    });

    it('clears processing once the round trip settles', async () => {
      const { result } = render();
      await record(result);
      await waitFor(() => expect(result.current.processing).toBe(false));
    });
  });

  describe('guards against invalid uploads (iblai-platform#2402)', () => {
    it('does not upload a recording shorter than the minimum', async () => {
      const { result } = render();
      await record(result, { elapsedMs: 200 });

      expect(mockAudioToText).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('That recording was too short');
    });

    it('does not upload when no audio bytes were captured', async () => {
      const { result } = render();
      await record(result, { bytes: 0 });

      expect(mockAudioToText).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        'No audio was captured, please try again',
      );
    });

    it('drops zero-length dataavailable chunks', async () => {
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      recorder.ondataavailable?.({ data: new Blob([]) });
      vi.setSystemTime(new Date(Date.now() + 4000));
      await act(async () => {
        recorder.onstop?.();
      });

      expect(mockAudioToText).not.toHaveBeenCalled();
    });

    it('warns and skips when the transcript is blank', async () => {
      mockAudioToText.mockReturnValue({
        unwrap: () => Promise.resolve({ text: '   ' }),
      });
      const { result } = render();
      await record(result);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "We couldn't make out any speech, please try again",
        ),
      );
      expect(mockOnTranscript).not.toHaveBeenCalled();
    });
  });

  describe('microphone acquisition failures', () => {
    it.each([
      ['NotAllowedError', 'Microphone access is blocked'],
      ['NotFoundError', 'No microphone was found.'],
      ['NotReadableError', 'Your microphone is in use by another app.'],
      ['WeirdError', 'Could not start recording, please try again.'],
    ])('surfaces a toast for %s and stays idle', async (name, fragment) => {
      const err = new Error('nope');
      err.name = name;
      mockGetUserMedia.mockRejectedValue(err);

      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(result.current.recording).toBe(false);
      expect(mockStart).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining(fragment),
      );
    });

    it('reports an unsupported browser when mediaDevices is missing', async () => {
      Object.defineProperty(global.navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Voice input is not supported in this browser',
      );
      expect(result.current.recording).toBe(false);
    });

    it('releases the stream when the MediaRecorder constructor throws', async () => {
      vi.stubGlobal(
        'MediaRecorder',
        Object.assign(
          vi.fn(() => {
            throw new Error('unsupported');
          }),
          { isTypeSupported: () => true },
        ),
      );
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(trackStop).toHaveBeenCalled();
      expect(result.current.recording).toBe(false);
    });

    it('releases the stream when recorder.start() throws', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      recorder.start = vi.fn(() => {
        throw new Error('NotSupportedError');
      });

      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(result.current.recording).toBe(false);
      expect(trackStop).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        'Voice input is not supported in this browser',
      );
      expect(mockStart).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('blocks recording until the username has resolved', async () => {
      mockUseUsername.mockReturnValue(null);
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(mockGetUserMedia).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        'Still signing you in, please try again in a moment',
      );
    });
  });

  describe('transcription failures', () => {
    it('toasts and clears processing when the API rejects', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAudioToText.mockReturnValue({
        unwrap: () => Promise.reject({ status: 400 }),
      });

      const { result } = render();
      await record(result);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Could not process your audio, please try again',
        ),
      );
      await waitFor(() => expect(result.current.processing).toBe(false));
      expect(consoleError).toHaveBeenCalledWith(
        '[voice-chat] transcription failed',
        expect.objectContaining({ tenant: 'tenant-1', bytes: 2048 }),
      );
      consoleError.mockRestore();
    });

    it('surfaces a toast when the recorder itself errors', async () => {
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      await act(async () => {
        recorder.onerror?.();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Recording stopped unexpectedly, please try again',
      );
      expect(result.current.recording).toBe(false);
      expect(trackStop).toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('ignores a second click while the first is still resolving', async () => {
      let release: (v: unknown) => void = () => {};
      mockGetUserMedia.mockReturnValue(
        new Promise((resolve) => {
          release = resolve;
        }),
      );

      const { result } = render();
      let first: Promise<void>;
      act(() => {
        first = result.current.handleMicrophoneBtnClick();
        void result.current.handleMicrophoneBtnClick();
      });
      await act(async () => {
        release(mockStream);
        await first;
      });

      expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    });

    it('stops the recorder and releases the mic on unmount', async () => {
      const { result, unmount } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      unmount();

      expect(recorder.stop).toHaveBeenCalled();
      expect(trackStop).toHaveBeenCalled();
    });
  });

  describe('stale callback protection', () => {
    // recorder.onstop is bound once when recording starts, but the consumer
    // passes a fresh onTranscript on every render (it closes over the current
    // composer text). Without a ref to the latest callback, anything typed
    // DURING the recording is silently discarded.
    it('calls the newest onTranscript, not the one bound at record time', async () => {
      const first = vi.fn();
      const latest = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb }) => useVoiceChat({ onTranscript: cb }),
        { initialProps: { cb: first } },
      );

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // consumer re-renders with a new callback while recording is in flight
      rerender({ cb: latest });

      recorder.ondataavailable?.({ data: new Blob(['x'.repeat(2048)]) });
      vi.setSystemTime(new Date(Date.now() + 4000));
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      await act(async () => {
        recorder.onstop?.();
      });

      await waitFor(() =>
        expect(latest).toHaveBeenCalledWith('transcribed text'),
      );
      expect(first).not.toHaveBeenCalled();
    });
  });

  describe('teardown ordering', () => {
    it('does not upload when onstop fires after the recording was cancelled', async () => {
      const { result, unmount } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      recorder.ondataavailable?.({ data: new Blob(['x'.repeat(2048)]) });
      vi.setSystemTime(new Date(Date.now() + 4000));

      unmount();
      await act(async () => {
        recorder.onstop?.();
      });

      expect(mockAudioToText).not.toHaveBeenCalled();
    });

    it('stopping after the recorder was already released is a no-op', async () => {
      const { result } = render();
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      await act(async () => {
        recorder.onerror?.();
      });
      recorder.stop.mockClear();

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(recorder.stop).not.toHaveBeenCalled();
    });
  });

  describe('unmounting mid-flight', () => {
    /** Start + stop a recording whose upload promise stays pending. */
    const recordWithPendingUpload = async (
      result: ReturnType<typeof render>['result'],
    ) => {
      let settle!: {
        resolve: (v: unknown) => void;
        reject: (e: unknown) => void;
      };
      mockAudioToText.mockReturnValue({
        unwrap: () =>
          new Promise((resolve, reject) => {
            settle = { resolve, reject };
          }),
      });

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      recorder.ondataavailable?.({ data: new Blob(['x'.repeat(2048)]) });
      vi.setSystemTime(new Date(Date.now() + 4000));
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });
      await act(async () => {
        recorder.onstop?.();
      });
      return settle;
    };

    it('ignores a transcript that resolves after unmount', async () => {
      const { result, unmount } = render();
      const settle = await recordWithPendingUpload(result);

      unmount();
      await act(async () => {
        settle.resolve({ text: 'too late' });
      });

      expect(mockOnTranscript).not.toHaveBeenCalled();
    });

    it('stays silent when the upload rejects after unmount', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const { result, unmount } = render();
      const settle = await recordWithPendingUpload(result);

      unmount();
      await act(async () => {
        settle.reject({ status: 400 });
      });

      expect(toast.error).not.toHaveBeenCalledWith(
        'Could not process your audio, please try again',
      );
      consoleError.mockRestore();
    });
  });

  describe('mime type fallbacks', () => {
    it('falls back to audio/webm when neither the recorder nor the probe reports one', async () => {
      (
        MediaRecorder as unknown as { isTypeSupported: () => boolean }
      ).isTypeSupported = () => false;
      recorder.mimeType = '';

      const { result } = render();
      await record(result);

      await waitFor(() => expect(mockAudioToText).toHaveBeenCalled());
      const { formData } = mockAudioToText.mock.calls[0][0];
      expect(formData.file.name).toBe('recording.webm');
      expect(formData.file.type).toBe('audio/webm');
    });

    it('falls back to the probed type when the recorder reports none', async () => {
      recorder.mimeType = '';

      const { result } = render();
      await record(result);

      await waitFor(() => expect(mockAudioToText).toHaveBeenCalled());
      const { formData } = mockAudioToText.mock.calls[0][0];
      expect(formData.file.type).toBe('audio/webm;codecs=opus');
    });
  });

  describe('helpers', () => {
    it('extensionFor maps known containers and falls back to webm', () => {
      expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
      expect(extensionFor('audio/mp4')).toBe('mp4');
      expect(extensionFor('audio/ogg')).toBe('ogg');
      expect(extensionFor('audio/mpeg')).toBe('mp3');
      expect(extensionFor('audio/wav')).toBe('wav');
      expect(extensionFor('audio/unknown')).toBe('webm');
    });

    it('pickMimeType returns empty when MediaRecorder is absent', () => {
      vi.stubGlobal('MediaRecorder', undefined);
      expect(pickMimeType()).toBe('');
    });

    it('micErrorMessage handles a non-DOMException value', () => {
      expect(micErrorMessage(undefined)).toBe(
        'Could not start recording, please try again.',
      );
    });
  });
});
