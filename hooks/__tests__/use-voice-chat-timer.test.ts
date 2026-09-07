import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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

import useVoiceChat from '../use-voice-chat';

type Recorder = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
};

// useTimer is deliberately NOT mocked here: the handlers the hook hands to
// MediaRecorder outlive the render that created them, so only the real timer
// exercises that path.
describe('useVoiceChat timer lifecycle', () => {
  let recorder: Recorder;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date('2026-08-27T00:00:00Z'));

    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');

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

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi
          .fn()
          .mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
      writable: true,
      configurable: true,
    });

    const Ctor = vi.fn(() => recorder) as unknown as {
      isTypeSupported: (type: string) => boolean;
    };
    Ctor.isTypeSupported = () => true;
    vi.stubGlobal('MediaRecorder', Ctor);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const renderVoiceChat = () =>
    renderHook(() => useVoiceChat({ onTranscript: vi.fn() }));

  it('stops the timer when the recorder errors and resets it on the next recording', async () => {
    const { result } = renderVoiceChat();

    await act(async () => {
      await result.current.handleMicrophoneBtnClick();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    const elapsedAtError = result.current.time;
    expect(elapsedAtError).toBeGreaterThanOrEqual(1990);

    await act(async () => {
      recorder.onerror?.();
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.time).toBe(elapsedAtError);

    recorder.state = 'recording';
    await act(async () => {
      await result.current.handleMicrophoneBtnClick();
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.time).toBeLessThan(200);
  });

  it('stops the timer on a normal stop', async () => {
    const { result } = renderVoiceChat();

    await act(async () => {
      await result.current.handleMicrophoneBtnClick();
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const elapsedAtStop = result.current.time;

    await act(async () => {
      await result.current.handleMicrophoneBtnClick();
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.time).toBe(elapsedAtStop);
  });
});
