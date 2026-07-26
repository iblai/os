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
  identity: 'testuser',
  setMicrophoneEnabled: mockSetMicrophoneEnabled,
  audioTrackPublications: mockAudioTrackPublications,
  on: vi.fn((event: string, handler: (...args: any[]) => void) => {
    participantEventHandlers[event] = handler;
  }),
  off: vi.fn(),
};

// A remote (mentor) participant so the diagnostic dumps that iterate
// `room.remoteParticipants` are exercised.
const makeRemoteParticipants = () =>
  new Map<string, any>([
    [
      'p1',
      {
        identity: 'mentor-agent',
        sid: 'p1',
        isSpeaking: false,
        audioLevel: 0,
        isLocal: false,
        trackPublications: new Map([
          [
            't1',
            {
              trackSid: 't1',
              source: 'microphone',
              kind: 'audio',
              isMuted: false,
              isSubscribed: true,
              isEnabled: true,
            },
          ],
        ]),
      },
    ],
  ]);

vi.mock('livekit-client', () => ({
  Room: vi.fn(() => ({
    connect: mockRoomConnect,
    disconnect: mockRoomDisconnect,
    localParticipant: mockLocalParticipant,
    remoteParticipants: makeRemoteParticipants(),
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
    TranscriptionReceived: 'transcriptionReceived',
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
          toggleMicMute: expect.any(Function),
          isMicMuted: expect.any(Boolean),
          toggleMentorAudio: expect.any(Function),
          isMentorAudioMuted: expect.any(Boolean),
          connectionState: expect.any(String),
          isSpeaking: false,
          isMentorSpeaking: false,
        }),
      );
    });

    it('should start with mentor audio unmuted', async () => {
      const { getByTestId } = render(<LiveKitChat {...defaultProps} />);
      expect(getByTestId('room-audio-renderer')).toHaveAttribute(
        'data-muted',
        'false',
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

    it('should pass isMicMuted=false to modal after successful connection', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isMicMuted).toBe(false);
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

  describe('mute toggles', () => {
    const latestModalProps = () =>
      mockVoiceChatModal.mock.calls[
        mockVoiceChatModal.mock.calls.length - 1
      ][0];

    const renderConnected = async () => {
      const utils = render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(latestModalProps().isMicMuted).toBe(false);
      });
      return utils;
    };

    it('should toggle mic mute state when toggleMicMute is called', async () => {
      await renderConnected();

      act(() => {
        (latestModalProps().toggleMicMute as () => void)();
      });

      await vi.waitFor(() => {
        expect(latestModalProps().isMicMuted).toBe(true);
      });
      expect(mockSetMicrophoneEnabled).toHaveBeenCalledWith(false);
    });

    it('should re-enable the microphone when toggled back on', async () => {
      await renderConnected();

      act(() => {
        (latestModalProps().toggleMicMute as () => void)();
      });
      await vi.waitFor(() => {
        expect(latestModalProps().isMicMuted).toBe(true);
      });

      act(() => {
        (latestModalProps().toggleMicMute as () => void)();
      });
      await vi.waitFor(() => {
        expect(latestModalProps().isMicMuted).toBe(false);
      });
      expect(mockSetMicrophoneEnabled).toHaveBeenLastCalledWith(true);
    });

    // ── Regression test for the bug this change fixes ──
    // A single `isMuted` flag used to drive BOTH `setMicrophoneEnabled` and
    // `<RoomAudioRenderer muted>`, so muting your own mic silently silenced the
    // mentor too. Muting the mic must leave mentor audio playing.
    it('should NOT mute mentor audio when the microphone is muted', async () => {
      const { getByTestId } = await renderConnected();

      expect(getByTestId('room-audio-renderer')).toHaveAttribute(
        'data-muted',
        'false',
      );

      act(() => {
        (latestModalProps().toggleMicMute as () => void)();
      });

      await vi.waitFor(() => {
        expect(latestModalProps().isMicMuted).toBe(true);
      });

      // The whole point: mentor audio playback is untouched.
      expect(getByTestId('room-audio-renderer')).toHaveAttribute(
        'data-muted',
        'false',
      );
      expect(latestModalProps().isMentorAudioMuted).toBe(false);
    });

    it('should mute mentor audio playback when toggleMentorAudio is called', async () => {
      const { getByTestId } = await renderConnected();

      act(() => {
        (latestModalProps().toggleMentorAudio as () => void)();
      });

      await vi.waitFor(() => {
        expect(latestModalProps().isMentorAudioMuted).toBe(true);
      });
      expect(getByTestId('room-audio-renderer')).toHaveAttribute(
        'data-muted',
        'true',
      );
    });

    it('should NOT touch the microphone when mentor audio is toggled', async () => {
      await renderConnected();

      mockSetMicrophoneEnabled.mockClear();

      act(() => {
        (latestModalProps().toggleMentorAudio as () => void)();
      });

      await vi.waitFor(() => {
        expect(latestModalProps().isMentorAudioMuted).toBe(true);
      });
      expect(mockSetMicrophoneEnabled).not.toHaveBeenCalled();
      expect(latestModalProps().isMicMuted).toBe(false);
    });

    it('should unmute mentor audio when toggled back on', async () => {
      const { getByTestId } = await renderConnected();

      act(() => {
        (latestModalProps().toggleMentorAudio as () => void)();
      });
      await vi.waitFor(() => {
        expect(latestModalProps().isMentorAudioMuted).toBe(true);
      });

      act(() => {
        (latestModalProps().toggleMentorAudio as () => void)();
      });
      await vi.waitFor(() => {
        expect(latestModalProps().isMentorAudioMuted).toBe(false);
      });
      expect(getByTestId('room-audio-renderer')).toHaveAttribute(
        'data-muted',
        'false',
      );
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

    it('should keep isSpeaking false while the mic is muted', async () => {
      render(<LiveKitChat {...defaultProps} />);

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.connectionState).toBe('connected');
      });

      const beforeMute =
        mockVoiceChatModal.mock.calls[
          mockVoiceChatModal.mock.calls.length - 1
        ][0];
      act(() => {
        (beforeMute.toggleMicMute as () => void)();
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isMicMuted).toBe(true);
      });

      act(() => {
        participantEventHandlers['isSpeakingChanged']?.(true);
      });

      const lastCall =
        mockVoiceChatModal.mock.calls[
          mockVoiceChatModal.mock.calls.length - 1
        ][0];
      expect(lastCall.isSpeaking).toBe(false);
    });

    it('should set isMentorSpeaking when a remote participant speaks', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['activeSpeakersChanged']?.([
          { identity: 'mentor-agent', sid: 's1', isLocal: false },
        ]);
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isMentorSpeaking).toBe(true);
      });
    });

    it('should not set isMentorSpeaking when only the local participant speaks', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['activeSpeakersChanged']?.([
          { identity: 'testuser', sid: 's0', isLocal: true },
        ]);
      });

      const lastCall =
        mockVoiceChatModal.mock.calls[
          mockVoiceChatModal.mock.calls.length - 1
        ][0];
      expect(lastCall.isMentorSpeaking).toBe(false);
    });

    it('should clear isMentorSpeaking when the active speaker list empties', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(mockRoomConnect).toHaveBeenCalled();
      });

      act(() => {
        roomEventHandlers['activeSpeakersChanged']?.([
          { identity: 'mentor-agent', sid: 's1', isLocal: false },
        ]);
      });
      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isMentorSpeaking).toBe(true);
      });

      act(() => {
        roomEventHandlers['activeSpeakersChanged']?.([]);
      });

      await vi.waitFor(() => {
        const lastCall =
          mockVoiceChatModal.mock.calls[
            mockVoiceChatModal.mock.calls.length - 1
          ][0];
        expect(lastCall.isMentorSpeaking).toBe(false);
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

  describe('live transcription', () => {
    const lastProps = (): any =>
      mockVoiceChatModal.mock.calls[
        mockVoiceChatModal.mock.calls.length - 1
      ][0];

    const emitTranscription = (
      segments: Record<string, unknown>[],
      participant?: Record<string, unknown>,
    ) => {
      act(() => {
        roomEventHandlers['transcriptionReceived']?.(segments, participant);
      });
    };

    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('subscribes to transcription events for the call', async () => {
      render(<LiveKitChat {...defaultProps} />);

      await vi.waitFor(() => {
        expect(roomEventHandlers['transcriptionReceived']).toBeTypeOf(
          'function',
        );
      });
    });

    it('starts with an empty transcript', () => {
      render(<LiveKitChat {...defaultProps} />);

      expect(lastProps().transcript).toEqual([]);
      expect(lastProps().isTranscriptLive).toBe(false);
    });

    it('forwards the mentor name for transcript labelling', () => {
      render(<LiveKitChat {...defaultProps} mentorName="Ada" />);

      expect(lastProps().mentorName).toBe('Ada');
    });

    it('accumulates transcript entries and attributes the speaker', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(roomEventHandlers['transcriptionReceived']).toBeDefined();
      });

      emitTranscription([{ id: 's1', text: 'Hello', final: true }], {
        identity: 'mentor-agent',
        name: 'Ada',
      });
      emitTranscription([{ id: 's2', text: 'Hi back', final: true }], {
        identity: 'testuser',
      });

      expect(
        lastProps().transcript.map((e: { speaker: string; text: string }) => [
          e.speaker,
          e.text,
        ]),
      ).toEqual([
        ['agent', 'Hello'],
        ['user', 'Hi back'],
      ]);
    });

    it('reports a partial line as live and settles once it finalises', async () => {
      render(<LiveKitChat {...defaultProps} />);
      await vi.waitFor(() => {
        expect(roomEventHandlers['transcriptionReceived']).toBeDefined();
      });

      emitTranscription([{ id: 's1', text: 'Hel', final: false }], {
        identity: 'mentor-agent',
      });
      expect(lastProps().isTranscriptLive).toBe(true);

      emitTranscription([{ id: 's1', text: 'Hello', final: true }], {
        identity: 'mentor-agent',
      });
      expect(lastProps().isTranscriptLive).toBe(false);
      expect(lastProps().transcript).toHaveLength(1);
    });
  });
});
