import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock data-layer
const mockAudioToText = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useAudioToTextMutation: () => [mockAudioToText],
}));

// Mock useUsername
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

// Mock useTimer
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockTime = 0;
vi.mock('@/hooks/use-timer', () => ({
  useTimer: () => ({
    start: mockStart,
    stop: mockStop,
    time: mockTime,
  }),
}));

import useVoiceChat from '../use-voice-chat';
import { toast } from 'sonner';

describe('useVoiceChat', () => {
  const mockSendMessage = vi.fn();
  const mockGetUserMedia = vi.fn();
  let mockMediaRecorder: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    ondataavailable: ((event: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
  };
  let mockStream: {
    getTracks: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');

    // Create mock stream
    mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    };

    // Create mock MediaRecorder
    mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null,
      onstop: null,
    };

    // Mock navigator.mediaDevices.getUserMedia
    mockGetUserMedia.mockResolvedValue(mockStream);
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      writable: true,
      configurable: true,
    });

    // Mock MediaRecorder constructor
    vi.stubGlobal(
      'MediaRecorder',
      vi.fn(() => mockMediaRecorder),
    );

    // Default audioToText mock
    mockAudioToText.mockReturnValue({
      unwrap: () => Promise.resolve({ text: 'transcribed text' }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return recording as false initially', () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      expect(result.current.recording).toBe(false);
    });

    it('should return processing as false initially', () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      expect(result.current.processing).toBe(false);
    });

    it('should return handleMicrophoneBtnClick function', () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      expect(typeof result.current.handleMicrophoneBtnClick).toBe('function');
    });

    it('should return time from useTimer', () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      expect(result.current.time).toBe(0);
    });
  });

  describe('starting recording', () => {
    it('should start recording when handleMicrophoneBtnClick is called', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(result.current.recording).toBe(true);
    });

    it('should request microphone access', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it('should create MediaRecorder with stream', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(MediaRecorder).toHaveBeenCalledWith(mockStream);
    });

    it('should start MediaRecorder', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    it('should call timer start', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(mockStart).toHaveBeenCalled();
    });
  });

  describe('stopping recording', () => {
    it('should stop recording when handleMicrophoneBtnClick is called while recording', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(result.current.recording).toBe(true);

      // Stop recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(result.current.recording).toBe(false);
    });

    it('should stop MediaRecorder', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Stop recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(mockMediaRecorder.stop).toHaveBeenCalled();
    });

    it('should call timer stop', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Stop recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('voice to text conversion', () => {
    it('should call audioToText when recording stops', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Simulate data available
      act(() => {
        mockMediaRecorder.ondataavailable?.({ data: new Blob(['audio data']) });
      });

      // Stop recording - this triggers onstop
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
        // Manually trigger onstop
        mockMediaRecorder.onstop?.();
      });

      await waitFor(() => {
        expect(mockAudioToText).toHaveBeenCalled();
      });
    });

    it('should send transcribed text message', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Simulate data available
      act(() => {
        mockMediaRecorder.ondataavailable?.({ data: new Blob(['audio data']) });
      });

      // Stop and trigger onstop
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
        mockMediaRecorder.onstop?.();
      });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('transcribed text');
      });
    });

    it('should stop all tracks after conversion', async () => {
      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Stop and trigger onstop
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
        mockMediaRecorder.onstop?.();
      });

      await waitFor(() => {
        expect(mockStream.getTracks).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('should show toast error when audioToText fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAudioToText.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Stop and trigger onstop
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
        mockMediaRecorder.onstop?.();
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Could not process your audio, please try again',
        );
      });

      consoleSpy.mockRestore();
    });

    it('should set processing to false after error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAudioToText.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Stop and trigger onstop
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
        mockMediaRecorder.onstop?.();
      });

      await waitFor(() => {
        expect(result.current.processing).toBe(false);
      });

      consoleSpy.mockRestore();
    });
  });

  describe('with null username', () => {
    it('should use empty string when username is null', async () => {
      mockUseUsername.mockReturnValue(null);

      const { result } = renderHook(() =>
        useVoiceChat({ sendMessage: mockSendMessage }),
      );

      // Start recording
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
      });

      // Stop and trigger onstop
      await act(async () => {
        await result.current.handleMicrophoneBtnClick();
        mockMediaRecorder.onstop?.();
      });

      await waitFor(() => {
        expect(mockAudioToText).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: '',
          }),
        );
      });
    });
  });
});
