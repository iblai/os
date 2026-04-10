import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';

// --- Mock setup ---

const mockStop = vi.fn();
const mockGetTracks = vi.fn(() => [{ stop: mockStop, kind: 'audio' }]);
const mockGetUserMedia = vi.fn().mockResolvedValue({
  getTracks: mockGetTracks,
});

Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
  configurable: true,
});

const mockUnwrap = vi.fn();
const mockInitiateCall = vi.fn(() => ({ unwrap: mockUnwrap }));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateCallCredentialsMutation: () => [mockInitiateCall],
}));

const mockRoomConnect = vi.fn();
const mockRoomDisconnect = vi.fn();
const mockSetMicrophoneEnabled = vi.fn();

const roomEventHandlers: Record<string, (...args: any[]) => void> = {};
const participantEventHandlers: Record<string, (...args: any[]) => void> = {};

const mockTrackStop = vi.fn();
const mockAudioTrackPublications = new Map([
  ['track1', { track: { stop: mockTrackStop } }],
]);

const mockLocalParticipant = {
  setMicrophoneEnabled: mockSetMicrophoneEnabled,
  audioTrackPublications: mockAudioTrackPublications,
  on: vi.fn((event: string, handler: (...args: any[]) => void) => {
    participantEventHandlers[event] = handler;
  }),
  off: vi.fn(),
};

vi.mock('livekit-client', () => ({
  Room: vi.fn(() => ({
    connect: mockRoomConnect,
    disconnect: mockRoomDisconnect,
    localParticipant: mockLocalParticipant,
    remoteParticipants: new Map(),
    name: 'test-room',
    state: 'disconnected',
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      roomEventHandlers[event] = handler;
    }),
    off: vi.fn(),
  })),
  RoomEvent: {
    ConnectionStateChanged: 'connectionStateChanged',
    Disconnected: 'disconnected',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TrackPublished: 'trackPublished',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    MediaDevicesError: 'mediaDevicesError',
    SignalConnected: 'signalConnected',
  },
  ConnectionState: {
    Connected: 'connected',
    Disconnected: 'disconnected',
    Connecting: 'connecting',
    Reconnecting: 'reconnecting',
  },
}));

const mockVoiceChatModal = vi.fn((_props: Record<string, unknown>) => (
  <div data-testid="voice-chat-modal" />
));

vi.mock('../modals/voice-chat-modal', () => ({
  VoiceChatModal: (props: any) => mockVoiceChatModal(props),
}));

vi.mock('@livekit/components-react', () => ({
  RoomAudioRenderer: ({ muted }: { muted: boolean }) => (
    <div data-testid="room-audio-renderer" data-muted={muted} />
  ),
  RoomContext: {
    Provider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="room-context">{children}</div>
    ),
  },
}));

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: any[]) => mockToastError(...args) },
}));

import { LiveKitChat } from '../live-kit-voice-chat';

describe('LiveKitChat', () => {
  const defaultProps = {
    tenantKey: 'test-tenant',
    mentorUniqueId: 'mentor-123',
    sessionId: 'session-456',
    username: 'testuser',
    onClose: vi.fn(),
    isOpen: true,
  };

  let originalOpener: Window | null;
  let mockPostMessage: Mock;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    originalOpener = window.opener;
    mockPostMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      value: { closed: false, postMessage: mockPostMessage },
      writable: true,
      configurable: true,
    });

    mockGetUserMedia.mockResolvedValue({
      getTracks: mockGetTracks,
    });
    mockGetTracks.mockReturnValue([{ stop: mockStop, kind: 'audio' }]);
    mockUnwrap.mockResolvedValue({
      participant_token: 'test-token',
      ws_url: 'wss://test.livekit.cloud',
    });
    mockRoomConnect.mockResolvedValue(undefined);
    mockSetMicrophoneEnabled.mockResolvedValue(undefined);

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'opener', {
      value: originalOpener,
      writable: true,
      configurable: true,
    });
    consoleErrorSpy.mockRestore();
  });

  describe('rendering', () => {
    it('should render RoomContext.Provider', async () => {
      const { getByTestId } = render(<LiveKitChat {...defaultProps} />);
      expect(getByTestId('room-context')).toBeInTheDocument();
    });

    it('should render RoomAudioRenderer', async () => {
      const { getByTestId } = render(<LiveKitChat {...defaultProps} />);
      expect(getByTestId('room-audio-renderer')).toBeInTheDocument();
    });

    it('should render VoiceChatModal with correct props', async () => {
      render(<LiveKitChat {...defaultProps} />);
      expect(mockVoiceChatModal).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          onClose: defaultProps.onClose,
          toggleMute: expect.any(Function),
          isMuted: expect.any(Boolean),
          connectionState: expect.any(String),
          isSpeaking: false,
        }),
      );
    });
  });

  describe('successful connection flow', () => {
    it('should request microphone permission', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      });
    });

    it('should call initiateCall with correct params', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockInitiateCall).toHaveBeenCalledWith(
          expect.objectContaining({
            mentor: 'mentor-123',
            org: 'test-tenant',
            requestBody: {
              session_id: 'session-456',
              pathway: 'mentor-123',
            },
            userId: 'testuser',
          }),
        );
      });
    });

    it('should connect to the LiveKit room', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalledWith(
          'wss://test.livekit.cloud',
          'test-token',
        );
      });
    });

    it('should enable microphone after connecting', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(true);
      });
    });

    it('should pass isMuted=false to modal after successful connection', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isMuted).toBe(false);
      });
    });

    it('should pass connectionState=connected after successful connection', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('connected');
      });
    });

    it('should post requesting-permission then connecting then connected status', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          {
            type: 'MENTOR:ROOM_STATUS',
            action: 'voice-call',
            status: 'requesting-permission',
          },
          '*',
        );
        expect(mockPostMessage).toHaveBeenCalledWith(
          {
            type: 'MENTOR:ROOM_STATUS',
            action: 'voice-call',
            status: 'connecting',
          },
          '*',
        );
        expect(mockPostMessage).toHaveBeenCalledWith(
          {
            type: 'MENTOR:ROOM_STATUS',
            action: 'voice-call',
            status: 'connected',
          },
          '*',
        );
      });
    });
  });

  describe('microphone permission denied', () => {
    it('should set error state when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('error');
      });
    });

    it('should show toast error when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Microphone permission denied. Please enable microphone in your browser settings.',
        );
      });
    });

    it('should post error status when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          { type: 'MENTOR:ROOM_STATUS', action: 'voice-call', status: 'error' },
          '*',
        );
      });
    });

    it('should not attempt to connect when getUserMedia fails', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
      expect(mockInitiateCall).not.toHaveBeenCalled();
    });
  });

  describe('API call failure', () => {
    it('should set error state when initiateCall fails', async () => {
      mockUnwrap.mockRejectedValueOnce(new Error('API error'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('error');
      });
    });

    it('should show toast with Error message', async () => {
      mockUnwrap.mockRejectedValueOnce(new Error('API error'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('API error');
      });
    });

    it('should show toast with data.error message', async () => {
      mockUnwrap.mockRejectedValueOnce({ data: { error: 'Quota exceeded' } });
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Quota exceeded');
      });
    });

    it('should show toast with error.error message', async () => {
      mockUnwrap.mockRejectedValueOnce({ error: { error: 'Server down' } });
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Server down');
      });
    });

    it('should show default toast message for unknown errors', async () => {
      mockUnwrap.mockRejectedValueOnce(42);
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Failed to initiate call. Please try again.',
        );
      });
    });

    it('should stop permission stream on API failure', async () => {
      mockUnwrap.mockRejectedValueOnce(new Error('API error'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockStop).toHaveBeenCalled();
      });
    });
  });

  describe('room connection failure', () => {
    it('should set error state when room.connect fails', async () => {
      mockRoomConnect.mockRejectedValueOnce(new Error('Connection failed'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('error');
      });
    });

    it('should show toast when room.connect fails', async () => {
      mockRoomConnect.mockRejectedValueOnce(new Error('Connection failed'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Failed to connect to room. Please try again.',
        );
      });
    });

    it('should stop permission stream on room connection failure', async () => {
      mockRoomConnect.mockRejectedValueOnce(new Error('Connection failed'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockStop).toHaveBeenCalled();
      });
    });
  });

  describe('microphone enable failure', () => {
    it('should set error state when setMicrophoneEnabled fails', async () => {
      mockSetMicrophoneEnabled.mockRejectedValueOnce(new Error('Mic error'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('error');
      });
    });

    it('should show toast when setMicrophoneEnabled fails', async () => {
      mockSetMicrophoneEnabled.mockRejectedValueOnce(new Error('Mic error'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Microphone is not enabled. Please enable microphone in your browser settings.',
        );
      });
    });

    it('should stop permission stream on mic enable failure', async () => {
      mockSetMicrophoneEnabled.mockRejectedValueOnce(new Error('Mic error'));
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockStop).toHaveBeenCalled();
      });
    });
  });

  describe('no participant token in response', () => {
    it('should not connect when response has no participant_token', async () => {
      mockUnwrap.mockResolvedValueOnce({});
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockInitiateCall).toHaveBeenCalled();
      });
      expect(mockRoomConnect).not.toHaveBeenCalled();
    });
  });

  describe('mute toggle', () => {
    it('should toggle mute state when toggleMute is called', async () => {
      render(<LiveKitChat {...defaultProps} />);

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isMuted).toBe(false);
      });

      // Get the toggleMute function and call it
      const lastCall =
        mockVoiceChatModal.mock.calls[
          mockVoiceChatModal.mock.calls.length - 1
        ][0];
      act(() => {
        (lastCall.toggleMute as () => void)();
      });

      await vi.waitFor(() => {
        const updatedCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(updatedCall.isMuted).toBe(true);
      });
      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('cleanup on unmount', () => {
    it('should disconnect from room on unmount', async () => {
      const { unmount } = render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      unmount();

      expect(mockRoomDisconnect).toHaveBeenCalled();
    });

    it('should stop published audio tracks on unmount', async () => {
      const { unmount } = render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      unmount();

      expect(mockTrackStop).toHaveBeenCalled();
    });

    it('should stop permission stream on unmount', async () => {
      const { unmount } = render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      mockStop.mockClear();
      unmount();

      expect(mockStop).toHaveBeenCalled();
    });

    it('should post disconnected status on unmount', async () => {
      const { unmount } = render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      mockPostMessage.mockClear();
      unmount();

      expect(mockPostMessage).toHaveBeenCalledWith(
        {
          type: 'MENTOR:ROOM_STATUS',
          action: 'voice-call',
          status: 'disconnected',
        },
        '*',
      );
    });
  });

  describe('room connection state changes', () => {
    it('should update connectionState when room emits Connected', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['connectionStateChanged']?.('connected');
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('connected');
      });
    });

    it('should update connectionState when room emits Disconnected state', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['connectionStateChanged']?.('disconnected');
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('disconnected');
      });
    });

    it('should update connectionState when room emits Connecting', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['connectionStateChanged']?.('connecting');
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('connecting');
      });
    });

    it('should update connectionState when room emits Reconnecting state', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['connectionStateChanged']?.('reconnecting');
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('reconnecting');
      });
    });

    it('should ignore unknown connection states', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      mockPostMessage.mockClear();
      act(() => {
        roomEventHandlers['connectionStateChanged']?.('unknown-state');
      });

      // Should not have posted any status for unknown state
      const statusCalls = mockPostMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as any).status === 'unknown-state',
      );
      expect(statusCalls.length).toBe(0);
    });

    it('should handle Disconnected event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['disconnected']?.();
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('disconnected');
      });
    });

    it('should handle Reconnecting event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['reconnecting']?.();
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('reconnecting');
      });
    });

    it('should handle Reconnected event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['reconnected']?.();
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('connected');
      });
    });
  });

  describe('speaking animation', () => {
    it('should set isSpeaking to true when participant is speaking and unmuted', async () => {
      render(<LiveKitChat {...defaultProps} />);

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('connected');
      });

      act(() => {
        participantEventHandlers['isSpeakingChanged']?.(true);
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isSpeaking).toBe(true);
      });
    });

    it('should set isSpeaking to false on trackMuted event', async () => {
      render(<LiveKitChat {...defaultProps} />);

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('connected');
      });

      act(() => {
        participantEventHandlers['trackMuted']?.();
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isSpeaking).toBe(false);
      });
    });
  });

  describe('diagnostic room events', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    afterEach(() => {
      consoleLogSpy.mockClear();
    });

    it('should handle TrackSubscribed event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['trackSubscribed']?.(
          { sid: 't1', kind: 'audio' },
          { source: 'microphone' },
          { identity: 'remote-user', sid: 'p1' },
        );
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'TrackSubscribed',
        expect.any(Object),
      );
    });

    it('should handle TrackUnsubscribed event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['trackUnsubscribed']?.(
          { sid: 't1', kind: 'audio' },
          { source: 'microphone' },
          { identity: 'remote-user' },
        );
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'TrackUnsubscribed',
        expect.any(Object),
      );
    });

    it('should handle TrackPublished event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['trackPublished']?.(
          {
            trackSid: 't1',
            trackName: 'audio',
            source: 'microphone',
            kind: 'audio',
          },
          { identity: 'remote-user' },
        );
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'TrackPublished (remote)',
        expect.any(Object),
      );
    });

    it('should handle LocalTrackPublished event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['localTrackPublished']?.({
          trackSid: 't1',
          trackName: 'audio',
          source: 'microphone',
          kind: 'audio',
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'LocalTrackPublished',
        expect.any(Object),
      );
    });

    it('should handle LocalTrackUnpublished event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['localTrackUnpublished']?.({
          trackSid: 't1',
          trackName: 'audio',
          source: 'microphone',
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'LocalTrackUnpublished',
        expect.any(Object),
      );
    });

    it('should handle ParticipantConnected event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['participantConnected']?.({
          identity: 'remote-user',
          sid: 'p1',
          trackPublications: new Map(),
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'ParticipantConnected',
        expect.any(Object),
      );
    });

    it('should handle ParticipantDisconnected event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['participantDisconnected']?.({
          identity: 'remote-user',
          sid: 'p1',
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'ParticipantDisconnected',
        expect.any(Object),
      );
    });

    it('should handle ActiveSpeakersChanged event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['activeSpeakersChanged']?.([
          { identity: 'user1', sid: 's1' },
        ]);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'ActiveSpeakersChanged',
        expect.any(Object),
      );
    });

    it('should handle MediaDevicesError event', async () => {
      const consoleErrorSpy2 = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['mediaDevicesError']?.(new Error('device error'));
      });

      expect(consoleErrorSpy2).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'MediaDevicesError',
        expect.any(Error),
      );
      consoleErrorSpy2.mockRestore();
    });

    it('should handle SignalConnected event', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['signalConnected']?.();
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[VoiceChat:LiveKit]'),
        'SignalConnected - WebSocket signal connection established',
      );
    });
  });

  describe('postRoomStatusToOpener', () => {
    it('should not post when opener is null', async () => {
      Object.defineProperty(window, 'opener', {
        value: null,
        writable: true,
        configurable: true,
      });

      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should not post when opener is closed', async () => {
      Object.defineProperty(window, 'opener', {
        value: { closed: true, postMessage: mockPostMessage },
        writable: true,
        configurable: true,
      });

      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should handle postMessage errors gracefully', async () => {
      mockPostMessage.mockImplementation(() => {
        throw new Error('Cross-origin error');
      });

      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to post room status to opener:',
          expect.any(Error),
        );
      });
    });
  });
});
