import React from 'react';
import {
  formatChatMessageLinks,
  RoomContext,
  VideoConference,
  useRoomContext,
} from '@livekit/components-react';
import {
  RoomEvent,
  type TranscriptionSegment,
  type Participant,
} from 'livekit-client';

import {
  useScreenSharing,
  type ScreenSharingConnectionState,
} from '@/hooks/use-screen-sharing';
import { usePipOnBlur } from '@/hooks/use-pip-on-blur';

// LiveKit Agents 1.0 uses the 'lk.chat' topic for text streams
const LK_CHAT_TOPIC = 'lk.chat';

interface ChatMessage {
  id: string;
  message: string;
  timestamp: number;
  from?: {
    identity?: string;
    name?: string;
  };
}

type Props = {
  tenantKey: string;
  mentorUniqueId: string;
  sessionId: string;
  username: string;
  onClose: () => void;
  isOpen: boolean;
  mentorName?: string;
};

/**
 * Post room status to the window opener (parent window that opened this popup)
 */
function postRoomStatusToOpener(
  status: ScreenSharingConnectionState,
  action: 'screen-share',
) {
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

/**
 * Post screen sharing started message to the window opener
 */
function postScreenSharingStartedToOpener() {
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(
        {
          type: 'MENTOR:SCREENSHARING_STARTED',
        },
        '*',
      );
    } catch (error) {
      console.error('Failed to post screen sharing started to opener:', error);
    }
  }
}

/**
 * Component that relays chat messages between PIP window and LiveKit room
 * Uses text streams (lk.chat topic) to communicate with LiveKit Agents 1.0
 * Must be used inside RoomContext.Provider
 */
function ChatRelay() {
  const room = useRoomContext();
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const lastMessageCountRef = React.useRef(0);
  const messageIdCounterRef = React.useRef(0);

  // Log when chatMessages changes
  React.useEffect(() => {
    console.log(
      '[ChatRelay] chatMessages updated:',
      chatMessages.length,
      'messages',
    );
    if (chatMessages.length > 0) {
      console.log(
        '[ChatRelay] Latest message:',
        chatMessages[chatMessages.length - 1],
      );
    }
  }, [chatMessages]);

  // Log sending state
  React.useEffect(() => {
    console.log('[ChatRelay] isSending:', isSending);
  }, [isSending]);

  // Register text stream handler for lk.chat topic to receive agent responses
  React.useEffect(() => {
    if (!room) return;

    console.log(
      '[ChatRelay] Registering text stream handler for',
      LK_CHAT_TOPIC,
    );

    // Handle incoming text streams from the agent
    const textStreamHandler = async (
      reader: { readAll: () => Promise<string>; info?: { id?: string } },
      participantInfo?: { identity?: string },
    ) => {
      try {
        console.log(
          '[ChatRelay] Received text stream from:',
          participantInfo?.identity,
        );

        // Read the full text from the stream
        const text = await reader.readAll();
        console.log('[ChatRelay] Text stream content:', text);

        // Create a chat message from the text stream
        // participantInfo only has identity, we can look up name from room participants
        const participant = room.remoteParticipants.get(
          participantInfo?.identity ?? '',
        );
        const newMessage: ChatMessage = {
          id: reader.info?.id || `agent-${Date.now()}-${Math.random()}`,
          message: text,
          timestamp: Date.now(),
          from: {
            identity: participantInfo?.identity,
            name: participant?.name,
          },
        };

        setChatMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === newMessage.id)) {
            console.log(
              '[ChatRelay] Duplicate message, skipping:',
              newMessage.id,
            );
            return prev;
          }
          return [...prev, newMessage];
        });
      } catch (error) {
        console.error('[ChatRelay] Error reading text stream:', error);
      }
    };

    try {
      room.registerTextStreamHandler(LK_CHAT_TOPIC, textStreamHandler);
    } catch (error) {
      // This can happen in React strict mode when the effect runs twice
      // The handler is already registered, which is fine
      console.log(
        '[ChatRelay] Text stream handler already registered (this is expected in dev mode)',
      );
    }

    return () => {
      // Note: LiveKit SDK doesn't have an unregister method, the handler is replaced on re-register
      console.log('[ChatRelay] Text stream handler cleanup');
    };
  }, [room]);

  // Also listen for RoomEvent.ChatMessage for backward compatibility with data packet approach
  React.useEffect(() => {
    if (!room) return;

    const handleChatMessage = (msg: unknown) => {
      console.log(
        '[ChatRelay] RoomEvent.ChatMessage received (data packet):',
        msg,
      );
    };

    room.on(RoomEvent.ChatMessage, handleChatMessage);
    console.log(
      '[ChatRelay] Listening for RoomEvent.ChatMessage (data packets)',
    );

    return () => {
      room.off(RoomEvent.ChatMessage, handleChatMessage);
    };
  }, [room]);

  // Listen for messages from PIP window
  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only log PIP-related messages to avoid noise
      if (event.data?.type?.startsWith('PIP:')) {
        console.log(
          '[ChatRelay] Received message from PIP:',
          event.data?.type,
          event.data,
        );
      }

      if (event.data?.type === 'PIP:SEND_CHAT_MESSAGE') {
        const messageText = event.data.message;
        console.log(
          '[ChatRelay] Sending message to LiveKit room via text stream:',
          messageText,
        );

        if (!room?.localParticipant) {
          console.error('[ChatRelay] No room or local participant available');
          window.documentPictureInPicture?.window?.postMessage(
            { type: 'PIP:SEND_COMPLETE' },
            '*',
          );
          return;
        }

        setIsSending(true);

        try {
          // Send message using text stream (lk.chat topic) for LiveKit Agents 1.0
          const info = await room.localParticipant.sendText(messageText, {
            topic: LK_CHAT_TOPIC,
          });
          console.log(
            '[ChatRelay] Message sent successfully via text stream, id:',
            info.id,
          );

          // Add our own message to the chat history
          const localMessage: ChatMessage = {
            id:
              info.id || `local-${Date.now()}-${messageIdCounterRef.current++}`,
            message: messageText,
            timestamp: Date.now(),
            from: {
              identity: room.localParticipant.identity,
              name: room.localParticipant.name,
            },
          };

          setChatMessages((prev) => [...prev, localMessage]);

          window.documentPictureInPicture?.window?.postMessage(
            { type: 'PIP:SEND_COMPLETE' },
            '*',
          );
        } catch (error) {
          console.error('[ChatRelay] Failed to send text stream:', error);
          window.documentPictureInPicture?.window?.postMessage(
            { type: 'PIP:SEND_COMPLETE' },
            '*',
          );
        } finally {
          setIsSending(false);
        }
      } else if (event.data?.type === 'PIP:REQUEST_MESSAGES_SYNC') {
        console.log(
          '[ChatRelay] Syncing messages to PIP:',
          chatMessages.length,
          'messages',
        );
        window.documentPictureInPicture?.window?.postMessage(
          { type: 'PIP:CHAT_MESSAGES_SYNC', messages: chatMessages },
          '*',
        );
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('[ChatRelay] Message listener registered');
    return () => {
      console.log('[ChatRelay] Message listener removed');
      window.removeEventListener('message', handleMessage);
    };
  }, [chatMessages, room]);

  // Relay new chat messages to PIP window
  React.useEffect(() => {
    console.log('[ChatRelay] Checking for new messages to relay:', {
      currentCount: chatMessages.length,
      lastCount: lastMessageCountRef.current,
      hasPipWindow: !!window.documentPictureInPicture?.window,
    });

    // Only send new messages (skip on initial load)
    if (chatMessages.length > lastMessageCountRef.current) {
      const newMessages = chatMessages.slice(lastMessageCountRef.current);
      console.log(
        '[ChatRelay] Relaying',
        newMessages.length,
        'new messages to PIP',
      );

      newMessages.forEach((msg) => {
        if (window.documentPictureInPicture?.window) {
          console.log('[ChatRelay] Posting message to PIP window:', {
            id: msg.id,
            message: msg.message,
            from: msg.from,
          });

          window.documentPictureInPicture.window.postMessage(
            {
              type: 'PIP:CHAT_MESSAGE',
              id: msg.id,
              message: msg.message,
              timestamp: msg.timestamp,
              from: msg.from,
            },
            '*',
          );
        } else {
          console.warn('[ChatRelay] No PIP window available to relay message');
        }
      });
    }
    lastMessageCountRef.current = chatMessages.length;
  }, [chatMessages]);

  return null;
}

/**
 * Component that relays transcriptions to the PIP window
 * Listens to RoomEvent.TranscriptionReceived from the LiveKit room
 * Must be used inside RoomContext.Provider
 */
function TranscriptionRelay() {
  const room = useRoomContext();

  React.useEffect(() => {
    if (!room) return;

    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
    ) => {
      console.log(
        '[TranscriptionRelay] Received transcription segments:',
        segments.length,
      );

      if (!window.documentPictureInPicture?.window) {
        console.warn('[TranscriptionRelay] No PIP window available');
        return;
      }

      // Combine all segment texts into one transcription
      const fullText = segments.map((s) => s.text).join(' ');
      const lastSegment = segments[segments.length - 1];

      const serializableTranscription = {
        id: lastSegment?.id || `transcription-${Date.now()}-${Math.random()}`,
        text: fullText,
        participantIdentity: participant?.identity,
        participantName: participant?.name,
        isFinal: lastSegment?.final ?? false,
        timestamp: Date.now(),
      };

      console.log(
        '[TranscriptionRelay] Posting transcription to PIP:',
        serializableTranscription,
      );

      window.documentPictureInPicture.window.postMessage(
        {
          type: 'PIP:TRANSCRIPTION',
          ...serializableTranscription,
        },
        '*',
      );
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    console.log('[TranscriptionRelay] Listening for transcriptions');

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
      console.log('[TranscriptionRelay] Stopped listening for transcriptions');
    };
  }, [room]);

  return null;
}

export function LiveKitScreenSharing({
  tenantKey,
  mentorUniqueId,
  sessionId,
  username,
  onClose,
  mentorName,
}: Props) {
  // Stable reference to the window that sent us a MENTOR:SCREENSHARING_MUTED status request
  const parentSourceRef = React.useRef<MessageEventSource | null>(null);

  const handleConnectionStateChange = React.useCallback(
    (state: ScreenSharingConnectionState) => {
      postRoomStatusToOpener(state, 'screen-share');
    },
    [],
  );

  // Handle when screen share is stopped via browser's "Stop sharing" button
  const handleScreenShareStopped = React.useCallback(() => {
    console.log('[LiveKitScreenSharing] Screen share stopped, closing modal');
    onClose();
  }, [onClose]);

  // Handle stop screen share from PIP window
  const handleStopScreenShareFromPip = React.useCallback(() => {
    console.log('[LiveKitScreenSharing] Stop screen share requested from PIP');
    // Notify the opener that screen sharing was stopped
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          { type: 'MENTOR:SCREENSHARING_STOPPED' },
          '*',
        );
      } catch (error) {
        console.error(
          'Failed to post screen sharing stopped to opener:',
          error,
        );
      }
    }
    // Close the screen sharing modal
    onClose();
    // Close the popup window if opened from another window
    if (window.opener) {
      window.close();
    }
  }, [onClose]);

  const {
    room,
    connectionState,
    isScreenShareActive,
    isMicrophoneEnabled,
    isMentorAudioEnabled,
    toggleMicrophone,
    setMentorAudioEnabled,
  } = useScreenSharing({
    tenantKey,
    mentorUniqueId,
    sessionId,
    username,
    onError: onClose,
    onConnectionStateChange: handleConnectionStateChange,
    onScreenShareStopped: handleScreenShareStopped,
  });

  // Post initial state when component mounts
  React.useEffect(() => {
    postRoomStatusToOpener(connectionState, 'screen-share');
  }, []);

  // Post disconnected state when component unmounts
  React.useEffect(() => {
    return () => {
      postRoomStatusToOpener('disconnected', 'screen-share');
    };
  }, []);

  // Notify opener when screen sharing has truly started (after user selected a screen)
  React.useEffect(() => {
    if (isScreenShareActive) {
      postScreenSharingStartedToOpener();
    }
  }, [isScreenShareActive]);

  // Listen for MENTOR:SCREENSHARING_STATUS — capture event source and push current status
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msgType = event.data?.type;
      if (msgType === 'MENTOR:SCREENSHARING_STATUS') {
        // Capture event source for future status pushes
        if (event.source) {
          parentSourceRef.current = event.source;
        }
        // Immediately push all current status to the source
        const target = event.source as Window | null;
        if (target) {
          try {
            target.postMessage(
              {
                type: 'MENTOR:ROOM_STATUS',
                action: 'screen-share',
                status: connectionState,
              },
              '*',
            );
            target.postMessage(
              {
                type: 'MENTOR:SCREENSHARING_MUTED',
                muted: !isMicrophoneEnabled,
              },
              '*',
            );
            target.postMessage(
              {
                type: 'MENTOR:SCREENSHARING_MENTOR_MUTED',
                muted: !isMentorAudioEnabled,
              },
              '*',
            );
            if (isScreenShareActive) {
              target.postMessage({ type: 'MENTOR:SCREENSHARING_STARTED' }, '*');
            }
          } catch (error) {
            console.error('Failed to post status to parent:', error);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    toggleMicrophone,
    connectionState,
    isMicrophoneEnabled,
    isMentorAudioEnabled,
    isScreenShareActive,
  ]);

  // Push connection state updates to captured parent source
  React.useEffect(() => {
    if (!parentSourceRef.current) return;
    try {
      (parentSourceRef.current as Window).postMessage(
        {
          type: 'MENTOR:ROOM_STATUS',
          action: 'screen-share',
          status: connectionState,
        },
        '*',
      );
    } catch (error) {
      console.error('Failed to post room status to parent:', error);
    }
  }, [connectionState]);

  // Push microphone mute state updates to captured parent source
  React.useEffect(() => {
    if (!parentSourceRef.current) return;
    try {
      (parentSourceRef.current as Window).postMessage(
        { type: 'MENTOR:SCREENSHARING_MUTED', muted: !isMicrophoneEnabled },
        '*',
      );
    } catch (error) {
      console.error('Failed to post microphone mute status to parent:', error);
    }
  }, [isMicrophoneEnabled]);

  // Push mentor audio mute state updates to captured parent source
  React.useEffect(() => {
    if (!parentSourceRef.current) return;
    try {
      (parentSourceRef.current as Window).postMessage(
        {
          type: 'MENTOR:SCREENSHARING_MENTOR_MUTED',
          muted: !isMentorAudioEnabled,
        },
        '*',
      );
    } catch (error) {
      console.error('Failed to post mentor mute status to parent:', error);
    }
  }, [isMentorAudioEnabled]);

  const handleSpeakingChange = React.useCallback((speaking: boolean) => {
    if (!parentSourceRef.current) return;
    try {
      (parentSourceRef.current as Window).postMessage(
        { type: 'MENTOR:SCREENSHARING_SPEAKING', speaking },
        '*',
      );
    } catch (error) {
      console.error('Failed to post speaking status to parent:', error);
    }
  }, []);

  const handleMentorSpeakingChange = React.useCallback((speaking: boolean) => {
    if (!parentSourceRef.current) return;
    try {
      (parentSourceRef.current as Window).postMessage(
        { type: 'MENTOR:SCREENSHARING_MENTOR_SPEAKING', speaking },
        '*',
      );
    } catch (error) {
      console.error('Failed to post mentor speaking status to parent:', error);
    }
  }, []);

  const handleMentorAudioToggled = React.useCallback(
    (enabled: boolean) => {
      setMentorAudioEnabled(enabled);
    },
    [setMentorAudioEnabled],
  );

  // Open PIP when screen sharing is truly active (after user selected a screen)
  usePipOnBlur({
    enabled: isScreenShareActive,
    width: 320,
    height: 680,
    room,
    screenSharePreviewHeight: 35,
    mentorName,
    onStopScreenShare: handleStopScreenShareFromPip,
    onSpeakingChange: handleSpeakingChange,
    onMentorSpeakingChange: handleMentorSpeakingChange,
    onMentorAudioToggled: handleMentorAudioToggled,
  });

  return (
    <RoomContext.Provider value={room}>
      <VideoConference
        className="hidden"
        chatMessageFormatter={formatChatMessageLinks}
      />
      <ChatRelay />
      <TranscriptionRelay />
    </RoomContext.Provider>
  );
}
