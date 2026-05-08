import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Mock livekit-client - must be hoisted
const mockRoomConnect = vi.fn();
const mockRoomDisconnect = vi.fn();
const mockSetMicrophoneEnabled = vi.fn();
const mockSetScreenShareEnabled = vi.fn();
let mockIsMicrophoneEnabled = true;

// Store room event handlers so tests can trigger them
const roomEventHandlers: Record<string, (...args: any[]) => void> = {};
const mockRoomOn = vi.fn((event: string, handler: (...args: any[]) => void) => {
  roomEventHandlers[event] = handler;
});
const mockRoomOff = vi.fn();

vi.mock('livekit-client', () => ({
  Room: vi.fn(() => ({
    connect: mockRoomConnect,
    disconnect: mockRoomDisconnect,
    on: mockRoomOn,
    off: mockRoomOff,
    localParticipant: {
      setMicrophoneEnabled: mockSetMicrophoneEnabled,
      setScreenShareEnabled: mockSetScreenShareEnabled,
      get isMicrophoneEnabled() {
        return mockIsMicrophoneEnabled;
      },
      on: vi.fn(),
      off: vi.fn(),
    },
  })),
  VideoPresets: {
    h540: 'h540',
    h216: 'h216',
  },
  RoomEvent: {
    ConnectionStateChanged: 'connectionStateChanged',
    Disconnected: 'disconnected',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
  },
  ConnectionState: {
    Connected: 'connected',
    Disconnected: 'disconnected',
    Connecting: 'connecting',
    Reconnecting: 'reconnecting',
  },
  Track: {
    Source: {
      ScreenShare: 'screen_share',
      ScreenShareAudio: 'screen_share_audio',
      Microphone: 'microphone',
    },
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock data-layer
const mockInitiateCall = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateCallCredentialsMutation: () => [mockInitiateCall],
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
}));

import { useScreenSharing } from '../use-screen-sharing';
import { toast } from 'sonner';

describe('useScreenSharing', () => {
  const defaultProps = {
    tenantKey: 'tenant-1',
    mentorUniqueId: 'mentor-123',
    sessionId: 'session-456',
    username: 'testuser',
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMicrophoneEnabled = true;
    mockRoomConnect.mockResolvedValue(undefined);
    mockSetMicrophoneEnabled.mockResolvedValue(undefined);
    mockSetScreenShareEnabled.mockResolvedValue(undefined);
    mockInitiateCall.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          participant_token: 'test-token',
          ws_url: 'wss://test-url',
        }),
    });
    // Ensure getDisplayMedia is available by default (desktop browser)
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia: vi.fn() },
      writable: true,
      configurable: true,
    });
    // Clear captured room event handlers
    Object.keys(roomEventHandlers).forEach(
      (key) => delete roomEventHandlers[key],
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should return a room object', () => {
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      expect(result.current.room).toBeDefined();
    });

    it('should initiate call on mount', async () => {
      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockInitiateCall).toHaveBeenCalledWith({
          mentor: 'mentor-123',
          org: 'tenant-1',
          requestBody: {
            session_id: 'session-456',
            pathway: 'mentor-123',
          },
          userId: 'testuser',
        });
      });
    });

    it('should disconnect room on unmount', async () => {
      const { unmount } = renderHook(() => useScreenSharing(defaultProps));

      unmount();

      expect(mockRoomDisconnect).toHaveBeenCalled();
    });
  });

  describe('successful connection', () => {
    it('should connect to room with token', async () => {
      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalledWith(
          'wss://test-url',
          'test-token',
        );
      });
    });

    it('should enable microphone after connection', async () => {
      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(true);
      });
    });

    it('should enable screen share after connection', async () => {
      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockSetScreenShareEnabled).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('initiateCall error handling', () => {
    it('should show toast error when initiateCall fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockInitiateCall.mockReturnValue({
        unwrap: () =>
          Promise.reject({ error: { error: 'Custom error message' } }),
      });

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Custom error message');
      });

      consoleSpy.mockRestore();
    });

    it('should show default error message when error has no message', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockInitiateCall.mockReturnValue({
        unwrap: () => Promise.reject({}),
      });

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to initiate call. Please try again.',
        );
      });

      consoleSpy.mockRestore();
    });

    it('should call onError when initiateCall fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const onError = vi.fn();
      mockInitiateCall.mockReturnValue({
        unwrap: () => Promise.reject({}),
      });

      renderHook(() =>
        useScreenSharing({
          ...defaultProps,
          onError,
        }),
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not call room.connect when initiateCall fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockInitiateCall.mockReturnValue({
        unwrap: () => Promise.reject({}),
      });

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      expect(mockRoomConnect).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('room connection error handling', () => {
    it('should show toast error when room.connect fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockRoomConnect.mockRejectedValue(new Error('Connection failed'));

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to connect to room. Please try again.',
        );
      });

      consoleSpy.mockRestore();
    });

    it('should call onError when room.connect fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const onError = vi.fn();
      mockRoomConnect.mockRejectedValue(new Error('Connection failed'));

      renderHook(() =>
        useScreenSharing({
          ...defaultProps,
          onError,
        }),
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not enable microphone when connection fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockRoomConnect.mockRejectedValue(new Error('Connection failed'));

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      expect(mockSetMicrophoneEnabled).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('microphone error handling', () => {
    it('should show toast error when microphone enable fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockSetMicrophoneEnabled.mockRejectedValue(new Error('Microphone error'));

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Microphone is not enabled. Please enable microphone in your browser settings.',
        );
      });

      consoleSpy.mockRestore();
    });

    it('should call onError when microphone enable fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const onError = vi.fn();
      mockSetMicrophoneEnabled.mockRejectedValue(new Error('Microphone error'));

      renderHook(() =>
        useScreenSharing({
          ...defaultProps,
          onError,
        }),
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not attempt screen share when microphone fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockSetMicrophoneEnabled.mockRejectedValue(new Error('Microphone error'));

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      expect(mockSetScreenShareEnabled).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('screen share error handling', () => {
    it('should show toast error when screen share enable fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockSetScreenShareEnabled.mockRejectedValue(
        new Error('Screen share denied'),
      );

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Screen sharing could not be started. Please ensure your browser supports screen sharing and that you have granted the necessary permissions.',
        );
      });

      consoleSpy.mockRestore();
    });

    it('should call onError when screen share enable fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const onError = vi.fn();
      mockSetScreenShareEnabled.mockRejectedValue(
        new Error('Screen share denied'),
      );

      renderHook(() =>
        useScreenSharing({
          ...defaultProps,
          onError,
        }),
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('screen sharing not supported (mobile)', () => {
    it('should show unsupported toast when getDisplayMedia is not available', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Screen sharing is not supported on this device. Please use a desktop browser.',
        );
      });
    });

    it('should call onError when getDisplayMedia is not available', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });
      const onError = vi.fn();

      renderHook(() =>
        useScreenSharing({
          ...defaultProps,
          onError,
        }),
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should not attempt microphone or screen share when unsupported', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });

      renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      expect(mockSetMicrophoneEnabled).not.toHaveBeenCalled();
      expect(mockSetScreenShareEnabled).not.toHaveBeenCalled();
    });
  });

  describe('no participant token', () => {
    it('should not connect when no participant token', async () => {
      mockInitiateCall.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            participant_token: undefined,
            ws_url: 'wss://test-url',
          }),
      });

      renderHook(() => useScreenSharing(defaultProps));

      // Wait for any async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockRoomConnect).not.toHaveBeenCalled();
    });
  });

  describe('optional onError callback', () => {
    it('should work without onError callback on initiateCall error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockInitiateCall.mockReturnValue({
        unwrap: () => Promise.reject({}),
      });

      const propsWithoutCallback = {
        ...defaultProps,
        onError: undefined,
      };

      // Should not throw
      renderHook(() => useScreenSharing(propsWithoutCallback));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('room event handlers', () => {
    it('should handle ConnectionStateChanged to Connected', async () => {
      const onConnectionStateChange = vi.fn();
      renderHook(() =>
        useScreenSharing({ ...defaultProps, onConnectionStateChange }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      onConnectionStateChange.mockClear();
      roomEventHandlers['connectionStateChanged']?.('connected');

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith('connected');
      });
    });

    it('should handle ConnectionStateChanged to Disconnected', async () => {
      const onConnectionStateChange = vi.fn();
      renderHook(() =>
        useScreenSharing({ ...defaultProps, onConnectionStateChange }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      onConnectionStateChange.mockClear();
      roomEventHandlers['connectionStateChanged']?.('disconnected');

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith('disconnected');
      });
    });

    it('should handle ConnectionStateChanged to Connecting', async () => {
      const onConnectionStateChange = vi.fn();
      renderHook(() =>
        useScreenSharing({ ...defaultProps, onConnectionStateChange }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      onConnectionStateChange.mockClear();
      roomEventHandlers['connectionStateChanged']?.('connecting');

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith('connecting');
      });
    });

    it('should handle ConnectionStateChanged to Reconnecting', async () => {
      const onConnectionStateChange = vi.fn();
      renderHook(() =>
        useScreenSharing({ ...defaultProps, onConnectionStateChange }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      onConnectionStateChange.mockClear();
      roomEventHandlers['connectionStateChanged']?.('reconnecting');

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith('reconnecting');
      });
    });

    it('should update connection state to disconnected on RoomEvent.Disconnected', async () => {
      const onConnectionStateChange = vi.fn();
      renderHook(() =>
        useScreenSharing({ ...defaultProps, onConnectionStateChange }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      onConnectionStateChange.mockClear();

      // Trigger the Disconnected handler
      roomEventHandlers['disconnected']?.();

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith('disconnected');
      });
    });

    it('should update connection state to reconnecting on RoomEvent.Reconnecting', async () => {
      const onConnectionStateChange = vi.fn();
      renderHook(() =>
        useScreenSharing({ ...defaultProps, onConnectionStateChange }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      onConnectionStateChange.mockClear();

      roomEventHandlers['reconnecting']?.();

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith('reconnecting');
      });
    });

    it('should update connection state to connected on RoomEvent.Reconnected', async () => {
      const onConnectionStateChange = vi.fn();
      renderHook(() =>
        useScreenSharing({ ...defaultProps, onConnectionStateChange }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      onConnectionStateChange.mockClear();

      roomEventHandlers['reconnected']?.();

      await waitFor(() => {
        expect(onConnectionStateChange).toHaveBeenCalledWith('connected');
      });
    });

    it('should call onScreenShareStopped when screen share track is unpublished', async () => {
      const onScreenShareStopped = vi.fn();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() =>
        useScreenSharing({ ...defaultProps, onScreenShareStopped }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      // Trigger LocalTrackUnpublished with ScreenShare source
      roomEventHandlers['localTrackUnpublished']?.({
        source: 'screen_share',
      });

      expect(onScreenShareStopped).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should call onScreenShareStopped when screen share audio track is unpublished', async () => {
      const onScreenShareStopped = vi.fn();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() =>
        useScreenSharing({ ...defaultProps, onScreenShareStopped }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      roomEventHandlers['localTrackUnpublished']?.({
        source: 'screen_share_audio',
      });

      expect(onScreenShareStopped).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not call onScreenShareStopped for non-screen-share tracks', async () => {
      const onScreenShareStopped = vi.fn();

      renderHook(() =>
        useScreenSharing({ ...defaultProps, onScreenShareStopped }),
      );

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      roomEventHandlers['localTrackUnpublished']?.({
        source: 'microphone',
      });

      expect(onScreenShareStopped).not.toHaveBeenCalled();
    });
  });

  describe('remote audio mute/unmute (TrackMuted/TrackUnmuted)', () => {
    it('should set isMentorAudioEnabled to false when remote audio track is muted', async () => {
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      // Initial remote mentor audio should be enabled
      expect(result.current.isMentorAudioEnabled).toBe(true);

      act(() => {
        roomEventHandlers['trackMuted']?.(
          { kind: 'audio', source: 'unknown' },
          { isLocal: false },
        );
      });

      await waitFor(() => {
        expect(result.current.isMentorAudioEnabled).toBe(false);
      });
    });

    it('should set isMentorAudioEnabled to true when remote audio track is unmuted', async () => {
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['trackMuted']?.(
          { kind: 'audio', source: 'unknown' },
          { isLocal: false },
        );
      });

      await waitFor(() => {
        expect(result.current.isMentorAudioEnabled).toBe(false);
      });

      act(() => {
        roomEventHandlers['trackUnmuted']?.(
          { kind: 'audio', source: 'unknown' },
          { isLocal: false },
        );
      });

      await waitFor(() => {
        expect(result.current.isMentorAudioEnabled).toBe(true);
      });
    });

    it('should ignore non-audio remote track mute events', async () => {
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['trackMuted']?.(
          { kind: 'video', source: 'camera' },
          { isLocal: false },
        );
      });

      // Remote audio state should remain true
      expect(result.current.isMentorAudioEnabled).toBe(true);
    });

    it('should sync isMicrophoneEnabled to false when local microphone is muted externally', async () => {
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(result.current.isMicrophoneEnabled).toBe(true);
      });

      act(() => {
        roomEventHandlers['trackMuted']?.(
          { kind: 'audio', source: 'microphone' },
          { isLocal: true },
        );
      });

      await waitFor(() => {
        expect(result.current.isMicrophoneEnabled).toBe(false);
      });
    });

    it('should sync isMicrophoneEnabled to true when local microphone is unmuted externally', async () => {
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(result.current.isMicrophoneEnabled).toBe(true);
      });

      act(() => {
        roomEventHandlers['trackMuted']?.(
          { kind: 'audio', source: 'microphone' },
          { isLocal: true },
        );
      });

      await waitFor(() => {
        expect(result.current.isMicrophoneEnabled).toBe(false);
      });

      act(() => {
        roomEventHandlers['trackUnmuted']?.(
          { kind: 'audio', source: 'microphone' },
          { isLocal: true },
        );
      });

      await waitFor(() => {
        expect(result.current.isMicrophoneEnabled).toBe(true);
      });
    });

    it('should ignore local track unmute when source is not microphone', async () => {
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(result.current.isMicrophoneEnabled).toBe(true);
      });

      // Externally mute to make state false
      act(() => {
        roomEventHandlers['trackMuted']?.(
          { kind: 'audio', source: 'microphone' },
          { isLocal: true },
        );
      });

      await waitFor(() => {
        expect(result.current.isMicrophoneEnabled).toBe(false);
      });

      // Unmute a non-microphone local source — should NOT flip mic state
      act(() => {
        roomEventHandlers['trackUnmuted']?.(
          { kind: 'video', source: 'camera' },
          { isLocal: true },
        );
      });

      expect(result.current.isMicrophoneEnabled).toBe(false);
    });
  });

  describe('toggleMicrophone', () => {
    it('should toggle microphone off when currently enabled', async () => {
      mockIsMicrophoneEnabled = true;
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      mockSetMicrophoneEnabled.mockClear();

      await act(async () => {
        await result.current.toggleMicrophone();
      });

      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(false);
      expect(result.current.isMicrophoneEnabled).toBe(false);
    });

    it('should toggle microphone on when currently disabled', async () => {
      mockIsMicrophoneEnabled = false;
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      mockSetMicrophoneEnabled.mockClear();

      await act(async () => {
        await result.current.toggleMicrophone();
      });

      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(true);
      expect(result.current.isMicrophoneEnabled).toBe(true);
    });

    it('should log error when toggleMicrophone fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockIsMicrophoneEnabled = true;
      const { result } = renderHook(() => useScreenSharing(defaultProps));

      await waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      mockSetMicrophoneEnabled.mockRejectedValueOnce(new Error('toggle fail'));

      await act(async () => {
        await result.current.toggleMicrophone();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to toggle microphone:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
