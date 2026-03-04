'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { Artifact } from '@iblai/iblai-api';

interface CanvasSendMessageHandlerProps {
  currentArtifact: Artifact | null;
  sendMessage?: (text: string, options?: { visible?: boolean; artifact?: any }) => void;
  onMessageSent?: () => void;
}

/**
 * Hook that handles sending messages with full artifact context
 */
export function useCanvasSendMessageHandler({
  currentArtifact,
  sendMessage,
  onMessageSent,
}: CanvasSendMessageHandlerProps) {
  const lastMessageRef = useRef<string>('');

  const sendFullArtifactUpdate = useCallback(
    (message: string) => {
      if (!currentArtifact || !sendMessage) {
        return false;
      }

      // Prepare artifact payload for full update
      const artifactPayload = {
        title: currentArtifact.title || 'Untitled Artifact',
        file_extension: currentArtifact.file_extension || 'txt',
        id: String(currentArtifact.id),
        is_partial: false, // Full artifact update
      };

      console.log('[Canvas] Sending message with full artifact:', {
        message,
        artifact: artifactPayload,
      });

      // Send message with full artifact context
      sendMessage(message, {
        visible: true,
        artifact: artifactPayload,
      });

      lastMessageRef.current = message;
      onMessageSent?.();

      return true;
    },
    [currentArtifact, sendMessage, onMessageSent],
  );

  // Listen for external message sends
  useEffect(() => {
    if (!window) return;

    const handleGlobalMessage = (
      event: CustomEvent<{ message: string; withArtifact?: boolean }>,
    ) => {
      if (event.detail.withArtifact && currentArtifact) {
        sendFullArtifactUpdate(event.detail.message);
      }
    };

    window.addEventListener('canvas-send-message' as any, handleGlobalMessage as any);

    return () => {
      window.removeEventListener('canvas-send-message' as any, handleGlobalMessage as any);
    };
  }, [sendFullArtifactUpdate, currentArtifact]);

  return {
    sendFullArtifactUpdate,
    lastMessage: lastMessageRef.current,
  };
}

/**
 * Hook to detect when canvas should be updated from external message
 */
export function useCanvasUpdateDetector(
  currentArtifact: Artifact | null,
  onUpdate: (newContent: string) => void,
) {
  const lastProcessedMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!window || !currentArtifact) return;

    const handleArtifactUpdate = (
      event: CustomEvent<{
        artifactId: number;
        content: string;
        messageId: string;
      }>,
    ) => {
      // Check if this is for our artifact and we haven't processed it yet
      if (
        event.detail.artifactId === currentArtifact.id &&
        event.detail.messageId !== lastProcessedMessageIdRef.current
      ) {
        console.log('[Canvas] Received artifact update from chat:', event.detail);
        lastProcessedMessageIdRef.current = event.detail.messageId;
        onUpdate(event.detail.content);
      }
    };

    window.addEventListener('artifact-updated' as any, handleArtifactUpdate as any);

    return () => {
      window.removeEventListener('artifact-updated' as any, handleArtifactUpdate as any);
    };
  }, [currentArtifact, onUpdate]);
}
