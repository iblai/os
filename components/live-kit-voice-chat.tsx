import React from 'react';

import { toast } from 'sonner';
import { Room, RoomEvent, ConnectionState as LiveKitConnectionState } from 'livekit-client';
import { useCreateCallCredentialsMutation } from '@iblai/iblai-js/data-layer';
import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';

import { VoiceChatModal } from './modals/voice-chat-modal';

const VOICE_DEBUG_PREFIX = '[VoiceChat:LiveKit]';

function voiceLog(...args: unknown[]) {
  console.log(VOICE_DEBUG_PREFIX, ...args);
}

function voiceWarn(...args: unknown[]) {
  console.warn(VOICE_DEBUG_PREFIX, ...args);
}

function voiceError(...args: unknown[]) {
  console.error(VOICE_DEBUG_PREFIX, ...args);
}

type Props = {
  tenantKey: string;
  mentorUniqueId: string;
  sessionId: string;
  username: string;
  onClose: () => void;
  isOpen: boolean;
};

type ConnectionState =
  | 'requesting-permission'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/**
 * Post room status to the window opener (parent window that opened this popup)
 */
function postRoomStatusToOpener(status: ConnectionState, action: 'voice-call') {
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(
        {
          type: 'MENTOR:ROOM_STATUS',
          action,
          status,
        },
        '*',
      );
    } catch (error) {
      console.error('Failed to post room status to opener:', error);
    }
  }
}

export function LiveKitChat({
  tenantKey,
  mentorUniqueId,
  sessionId,
  username,
  onClose,
  isOpen,
}: Props) {
  const [initiateCall] = useCreateCallCredentialsMutation();

  const [room] = React.useState(() => {
    voiceLog('Creating new Room instance');
    return new Room({});
  });
  const [isMuted, setIsMuted] = React.useState(true);
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>('requesting-permission');
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const permissionStreamRef = React.useRef<MediaStream | null>(null);

  function stopPermissionStream() {
    voiceLog('Stopping permission stream', {
      hasTracks: !!permissionStreamRef.current,
      trackCount: permissionStreamRef.current?.getTracks().length,
    });
    permissionStreamRef.current?.getTracks().forEach((t) => {
      voiceLog('Stopping permission track', {
        kind: t.kind,
        label: t.label,
        readyState: t.readyState,
      });
      t.stop();
    });
    permissionStreamRef.current = null;
  }

  async function connectRoom() {
    voiceLog('connectRoom() called', { tenantKey, mentorUniqueId, sessionId, username });

    // Request microphone permission first
    setConnectionState('requesting-permission');
    postRoomStatusToOpener('requesting-permission', 'voice-call');

    try {
      voiceLog('Requesting microphone permission via getUserMedia...');
      // Request microphone access early to check permission.
      // Store the stream so we can stop its tracks during cleanup.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStreamRef.current = stream;
      voiceLog('Microphone permission granted', {
        streamId: stream.id,
        tracks: stream.getTracks().map((t) => ({
          kind: t.kind,
          label: t.label,
          readyState: t.readyState,
          enabled: t.enabled,
          muted: t.muted,
        })),
      });
    } catch (error) {
      voiceError('Microphone permission denied', error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      toast.error(
        'Microphone permission denied. Please enable microphone in your browser settings.',
      );
      setConnectionState('error');
      postRoomStatusToOpener('error', 'voice-call');
      return;
    }

    // Now connect to LiveKit
    setConnectionState('connecting');
    postRoomStatusToOpener('connecting', 'voice-call');
    let response;

    try {
      voiceLog('Initiating call credentials request...', {
        mentor: mentorUniqueId,
        org: tenantKey,
        sessionId,
      });
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
      voiceLog('Call credentials received', {
        hasToken: !!response?.participant_token,
        wsUrl: response?.ws_url,
        tokenLength: response?.participant_token?.length,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : (error as any)?.data?.error ||
            (error as any)?.error?.error ||
            'Failed to initiate call. Please try again.';

      voiceError('Failed to get call credentials', { errorMessage, error });
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      toast.error(errorMessage);
      stopPermissionStream();
      setConnectionState('error');
      postRoomStatusToOpener('error', 'voice-call');
      return;
    }

    if (response?.participant_token) {
      try {
        voiceLog('Connecting to LiveKit room...', { wsUrl: response.ws_url });
        const connectStart = performance.now();
        await room.connect(response?.ws_url, response.participant_token);
        const connectDuration = performance.now() - connectStart;
        voiceLog('Connected to LiveKit room', {
          durationMs: Math.round(connectDuration),
          roomSid: (room as any).sid,
          roomName: room.name,
          roomState: room.state,
          localParticipant: room.localParticipant?.identity,
          remoteParticipants: Array.from(room.remoteParticipants.values()).map((p) => ({
            identity: p.identity,
            sid: p.sid,
            trackCount: p.trackPublications.size,
          })),
        });
      } catch (error) {
        voiceError('Failed to connect to LiveKit room', error);
        console.error(JSON.stringify({ tenant: tenantKey, error }));
        toast.error('Failed to connect to room. Please try again.');
        stopPermissionStream();
        setConnectionState('error');
        postRoomStatusToOpener('error', 'voice-call');
        return;
      }

      try {
        voiceLog('Enabling local microphone...');
        await room.localParticipant.setMicrophoneEnabled(true);
        voiceLog('Microphone enabled successfully', {
          audioTracks: Array.from(room.localParticipant.audioTrackPublications.values()).map(
            (pub) => ({
              trackSid: pub.trackSid,
              trackName: pub.trackName,
              source: pub.source,
              isMuted: pub.isMuted,
              isSubscribed: pub.isSubscribed,
              kind: pub.kind,
            }),
          ),
        });
        setIsMuted(false); // Auto-unmute when successfully connected
        setConnectionState('connected');
        postRoomStatusToOpener('connected', 'voice-call');
      } catch (error) {
        voiceError('Failed to enable microphone', error);
        console.error(JSON.stringify({ tenant: tenantKey, error }));
        toast.error(
          'Microphone is not enabled. Please enable microphone in your browser settings.',
        );
        stopPermissionStream();
        setConnectionState('error');
        postRoomStatusToOpener('error', 'voice-call');
      }
    } else {
      voiceWarn('No participant_token in response', { response });
    }
  }

  // Monitor audio activity for speaking animation
  React.useEffect(() => {
    if (connectionState !== 'connected' || !room.localParticipant) {
      voiceLog('Speaking monitor: skipping (not connected or no local participant)', {
        connectionState,
        hasLocalParticipant: !!room.localParticipant,
      });
      return;
    }

    voiceLog('Speaking monitor: attaching listeners to local participant');

    const handleIsSpeakingChanged = (speaking: boolean) => {
      voiceLog('Local participant speaking changed', {
        speaking,
        isMuted,
        effectiveSpeaking: speaking && !isMuted,
      });
      setIsSpeaking(speaking && !isMuted);
    };

    const handleTrackMuted = () => {
      voiceLog('Local participant track muted');
      setIsSpeaking(false);
    };

    // Listen to speaking state changes
    room.localParticipant.on('isSpeakingChanged', handleIsSpeakingChanged);
    room.localParticipant.on('trackMuted', handleTrackMuted);

    return () => {
      voiceLog('Speaking monitor: detaching listeners');
      room.localParticipant.off('isSpeakingChanged', handleIsSpeakingChanged);
      room.localParticipant.off('trackMuted', handleTrackMuted);
    };
  }, [connectionState, room, isMuted]);

  // Listen to room connection state changes from LiveKit
  React.useEffect(() => {
    voiceLog('Attaching room event listeners');

    const handleConnectionStateChange = (state: LiveKitConnectionState) => {
      voiceLog('Room ConnectionStateChanged event', { livekitState: state });
      let mappedState: ConnectionState;
      switch (state) {
        case LiveKitConnectionState.Connected:
          mappedState = 'connected';
          break;
        case LiveKitConnectionState.Disconnected:
          mappedState = 'disconnected';
          break;
        case LiveKitConnectionState.Connecting:
          mappedState = 'connecting';
          break;
        case LiveKitConnectionState.Reconnecting:
          mappedState = 'reconnecting';
          break;
        default:
          voiceWarn('Unknown LiveKit connection state', { state });
          return;
      }
      voiceLog('Connection state mapped', { from: state, to: mappedState });
      setConnectionState(mappedState);
      postRoomStatusToOpener(mappedState, 'voice-call');
    };

    const handleDisconnected = (reason?: unknown) => {
      voiceLog('Room Disconnected event', { reason });
      setConnectionState('disconnected');
      postRoomStatusToOpener('disconnected', 'voice-call');
    };

    const handleReconnecting = () => {
      voiceWarn('Room Reconnecting event');
      setConnectionState('reconnecting');
      postRoomStatusToOpener('reconnecting', 'voice-call');
    };

    const handleReconnected = () => {
      voiceLog('Room Reconnected event');
      setConnectionState('connected');
      postRoomStatusToOpener('connected', 'voice-call');
    };

    // Additional diagnostic events
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      voiceLog('TrackSubscribed', {
        trackSid: track?.sid,
        trackKind: track?.kind,
        trackSource: publication?.source,
        participantIdentity: participant?.identity,
        participantSid: participant?.sid,
      });
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      voiceLog('TrackUnsubscribed', {
        trackSid: track?.sid,
        trackKind: track?.kind,
        trackSource: publication?.source,
        participantIdentity: participant?.identity,
      });
    };

    const handleTrackPublished = (publication: any, participant: any) => {
      voiceLog('TrackPublished (remote)', {
        trackSid: publication?.trackSid,
        trackName: publication?.trackName,
        source: publication?.source,
        kind: publication?.kind,
        participantIdentity: participant?.identity,
      });
    };

    const handleLocalTrackPublished = (publication: any) => {
      voiceLog('LocalTrackPublished', {
        trackSid: publication?.trackSid,
        trackName: publication?.trackName,
        source: publication?.source,
        kind: publication?.kind,
      });
    };

    const handleLocalTrackUnpublished = (publication: any) => {
      voiceLog('LocalTrackUnpublished', {
        trackSid: publication?.trackSid,
        trackName: publication?.trackName,
        source: publication?.source,
      });
    };

    const handleParticipantConnected = (participant: any) => {
      voiceLog('ParticipantConnected', {
        identity: participant?.identity,
        sid: participant?.sid,
        trackCount: participant?.trackPublications?.size,
      });
    };

    const handleParticipantDisconnected = (participant: any) => {
      voiceLog('ParticipantDisconnected', {
        identity: participant?.identity,
        sid: participant?.sid,
      });
    };

    const handleActiveSpeakersChanged = (speakers: any[]) => {
      voiceLog('ActiveSpeakersChanged', {
        count: speakers.length,
        speakers: speakers.map((s) => ({ identity: s.identity, sid: s.sid })),
      });
    };

    const handleMediaDevicesError = (error: any) => {
      voiceError('MediaDevicesError', error);
    };

    const handleSignalConnected = () => {
      voiceLog('SignalConnected - WebSocket signal connection established');
    };

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
    room.on(RoomEvent.MediaDevicesError, handleMediaDevicesError);
    room.on(RoomEvent.SignalConnected, handleSignalConnected);

    return () => {
      voiceLog('Detaching room event listeners');
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChange);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
      room.off(RoomEvent.MediaDevicesError, handleMediaDevicesError);
      room.off(RoomEvent.SignalConnected, handleSignalConnected);
    };
  }, [room]);

  // You can manage room connection lifecycle here
  React.useEffect(() => {
    voiceLog('Lifecycle effect: starting connectRoom');
    connectRoom();

    return () => {
      voiceLog('Lifecycle effect: cleanup - disconnecting', {
        roomState: room.state,
        localAudioTracks: room.localParticipant?.audioTrackPublications.size,
        remoteParticipants: room.remoteParticipants?.size,
      });
      // Stop all local audio tracks published via LiveKit
      room.localParticipant?.audioTrackPublications.forEach((pub) => {
        voiceLog('Stopping local audio track', {
          trackSid: pub.trackSid,
          trackName: pub.trackName,
          source: pub.source,
        });
        pub.track?.stop();
      });
      room.disconnect();
      voiceLog('Room disconnected');

      // Stop the permission-check stream acquired by getUserMedia
      stopPermissionStream();

      postRoomStatusToOpener('disconnected', 'voice-call');
    };
  }, []);

  const handleToggleMute = () => {
    const newMutedState = !isMuted;
    voiceLog('Toggle mute', {
      currentMuted: isMuted,
      newMuted: newMutedState,
      roomState: room.state,
    });
    setIsMuted(newMutedState);
    room.localParticipant.setMicrophoneEnabled(!newMutedState);
  };

  // Periodic room state dump (every 5 seconds while connected)
  React.useEffect(() => {
    if (connectionState !== 'connected') return;

    const dumpRoomState = () => {
      const localPub = Array.from(room.localParticipant?.audioTrackPublications.values() ?? []);
      const remoteParticipants = Array.from(room.remoteParticipants.values());

      voiceLog('Room state dump', {
        roomSid: (room as any).sid,
        roomName: room.name,
        roomState: room.state,
        localParticipant: {
          identity: room.localParticipant?.identity,
          sid: room.localParticipant?.sid,
          isSpeaking: room.localParticipant?.isSpeaking,
          audioLevel: room.localParticipant?.audioLevel,
          audioTracks: localPub.map((pub) => ({
            trackSid: pub.trackSid,
            source: pub.source,
            isMuted: pub.isMuted,
            isSubscribed: pub.isSubscribed,
            trackEnabled: pub.track?.mediaStreamTrack?.enabled,
            trackReadyState: pub.track?.mediaStreamTrack?.readyState,
          })),
        },
        remoteParticipants: remoteParticipants.map((p) => ({
          identity: p.identity,
          sid: p.sid,
          isSpeaking: p.isSpeaking,
          audioLevel: p.audioLevel,
          tracks: Array.from(p.trackPublications.values()).map((pub) => ({
            trackSid: pub.trackSid,
            source: pub.source,
            kind: pub.kind,
            isMuted: pub.isMuted,
            isSubscribed: pub.isSubscribed,
            isEnabled: pub.isEnabled,
          })),
        })),
      });
    };

    // Dump immediately on connect
    dumpRoomState();
    const interval = setInterval(dumpRoomState, 5000);
    return () => clearInterval(interval);
  }, [connectionState, room]);

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer muted={isMuted} />
      <VoiceChatModal
        isOpen={isOpen}
        onClose={onClose}
        toggleMute={handleToggleMute}
        isMuted={isMuted}
        connectionState={connectionState}
        isSpeaking={isSpeaking}
      />
    </RoomContext.Provider>
  );
}
