import React from 'react';

import {
  Room,
  RoomEvent,
  VideoPresets,
  ConnectionState,
  LocalTrackPublication,
  Track,
} from 'livekit-client';
import { toast } from 'sonner';
import { useCreateCallCredentialsMutation } from '@iblai/iblai-js/data-layer';

type Props = {
  tenantKey: string;
  mentorUniqueId: string;
  sessionId: string;
  username: string;
  onError?: () => void;
  onConnectionStateChange?: (state: ScreenSharingConnectionState) => void;
  /** Called when screen sharing is stopped (e.g., via browser's stop button) */
  onScreenShareStopped?: () => void;
};

export type ScreenSharingConnectionState =
  | 'idle'
  | 'requesting-permission'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export function useScreenSharing({
  tenantKey,
  mentorUniqueId,
  sessionId,
  username,
  onError,
  onConnectionStateChange,
  onScreenShareStopped,
}: Props) {
  const [initiateCall] = useCreateCallCredentialsMutation();
  const [connectionState, setConnectionState] =
    React.useState<ScreenSharingConnectionState>('idle');
  // Track when screen sharing is truly active (after user selects screen)
  const [isScreenShareActive, setIsScreenShareActive] = React.useState(false);
  // Track microphone enabled state
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = React.useState(false);
  // Track remote mentor/AI agent audio state
  const [isMentorAudioEnabled, setIsMentorAudioEnabled] = React.useState(true);

  const updateConnectionState = React.useCallback(
    (state: ScreenSharingConnectionState) => {
      setConnectionState(state);
      onConnectionStateChange?.(state);
    },
    [onConnectionStateChange],
  );

  const [room] = React.useState(
    () =>
      new Room({
        publishDefaults: {
          videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
          videoCodec: 'vp8',
        },
        adaptiveStream: { pixelDensity: 'screen' },
        dynacast: true,
      }),
  );

  async function connectRoom() {
    updateConnectionState('requesting-permission');
    let response;

    try {
      response = await initiateCall({
        mentor: mentorUniqueId,
        org: tenantKey,
        requestBody: {
          session_id: sessionId,
          pathway: mentorUniqueId,
        },
        // @ts-ignore
        userId: username,
      }).unwrap();
    } catch (error) {
      console.error(JSON.stringify(error));
      // @ts-ignore error is unknown at the catch binding
      const errorMessage =
        error?.error?.error || 'Failed to initiate call. Please try again.';
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      toast.error(errorMessage);
      updateConnectionState('error');
      onError?.();
      return;
    }

    if (response?.participant_token) {
      updateConnectionState('connecting');
      try {
        await room.connect(response?.ws_url, response.participant_token);
      } catch (error) {
        console.error('failed to connect to room', error);
        console.error(JSON.stringify({ tenant: tenantKey, error }));
        toast.error('Failed to connect to room. Please try again.');
        updateConnectionState('error');
        onError?.();
        return;
      }

      // Check if screen sharing is supported before attempting
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error(
          'Screen sharing is not supported on this device. Please use a desktop browser.',
        );
        updateConnectionState('error');
        onError?.();
        return;
      }

      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicrophoneEnabled(true);
      } catch (error) {
        console.error('failed to enable microphone', error);
        console.error(JSON.stringify({ tenant: tenantKey, error }));
        toast.error(
          'Microphone is not enabled. Please enable microphone in your browser settings.',
        );
        updateConnectionState('error');
        onError?.();
        return;
      }

      try {
        await room.localParticipant.setScreenShareEnabled(true);
        // Screen sharing is now truly active (user selected a screen)
        setIsScreenShareActive(true);
        updateConnectionState('connected');
      } catch (error) {
        console.error('failed to enable screen sharing', error);
        console.error(JSON.stringify({ tenant: tenantKey, error }));
        toast.error(
          'Screen sharing could not be started. Please ensure your browser supports screen sharing and that you have granted the necessary permissions.',
        );
        updateConnectionState('error');
        onError?.();
        return;
      }
    }
  }

  // Listen to room connection state changes from LiveKit
  React.useEffect(() => {
    const handleConnectionStateChange = (state: ConnectionState) => {
      switch (state) {
        case ConnectionState.Connected:
          updateConnectionState('connected');
          break;
        case ConnectionState.Disconnected:
          updateConnectionState('disconnected');
          break;
        case ConnectionState.Connecting:
          updateConnectionState('connecting');
          break;
        case ConnectionState.Reconnecting:
          updateConnectionState('reconnecting');
          break;
      }
    };

    const handleDisconnected = () => {
      updateConnectionState('disconnected');
    };

    const handleReconnecting = () => {
      updateConnectionState('reconnecting');
    };

    const handleReconnected = () => {
      updateConnectionState('connected');
    };

    // Detect when screen share is stopped (e.g., via browser's "Stop sharing" button)
    const handleLocalTrackUnpublished = (
      publication: LocalTrackPublication,
    ) => {
      if (
        publication.source === Track.Source.ScreenShare ||
        publication.source === Track.Source.ScreenShareAudio
      ) {
        console.log('[useScreenSharing] Screen share track unpublished');
        setIsScreenShareActive(false);
        onScreenShareStopped?.();
      }
    };

    // Track remote mentor/AI agent audio mute state
    const handleTrackMuted = (publication: any, participant: any) => {
      if (!participant.isLocal && publication.kind === 'audio') {
        setIsMentorAudioEnabled(false);
      }
      // Sync local mic state when toggled externally (e.g., from PIP window)
      if (
        participant.isLocal &&
        publication.source === Track.Source.Microphone
      ) {
        setIsMicrophoneEnabled(false);
      }
    };

    const handleTrackUnmuted = (publication: any, participant: any) => {
      if (!participant.isLocal && publication.kind === 'audio') {
        setIsMentorAudioEnabled(true);
      }
      // Sync local mic state when toggled externally (e.g., from PIP window)
      if (
        participant.isLocal &&
        publication.source === Track.Source.Microphone
      ) {
        setIsMicrophoneEnabled(true);
      }
    };

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    };
  }, [room, updateConnectionState, onScreenShareStopped]);

  // Toggle microphone and sync state — called by the component which owns the event.source reference
  const toggleMicrophone = React.useCallback(async () => {
    if (!room?.localParticipant) return;
    // Read from room directly to avoid stale React state when toggled from PIP
    const newEnabled = !room.localParticipant.isMicrophoneEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(newEnabled);
      setIsMicrophoneEnabled(newEnabled);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  }, [room]);

  // Manage room connection lifecycle
  React.useEffect(() => {
    connectRoom();

    return () => {
      room.disconnect();
    };
  }, []);

  return {
    room,
    connectionState,
    isScreenShareActive,
    isMicrophoneEnabled,
    isMentorAudioEnabled,
    toggleMicrophone,
    setMentorAudioEnabled: setIsMentorAudioEnabled,
  };
}
