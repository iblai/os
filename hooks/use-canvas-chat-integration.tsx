'use client';

import { useEffect, useCallback } from 'react';
import type { Artifact } from '@iblai/iblai-api';

interface UseCanvasChatIntegrationProps {
  currentArtifact: Artifact | null;
  sendMessage?: (
    text: string,
    options?: { visible?: boolean; artifact?: any },
  ) => void;
  isCanvasOpen: boolean;
}

/**
 * Hook that integrates canvas with chat system
 * Automatically includes full artifact reference when canvas is open
 */
export function useCanvasChatIntegration({
  currentArtifact,
  sendMessage,
  isCanvasOpen,
}: UseCanvasChatIntegrationProps) {
  // Override global sendMessage when canvas is open
  useEffect(() => {
    if (!isCanvasOpen || !currentArtifact || !sendMessage) {
      return;
    }

    // Store the original sendMessage function
    const originalSendMessage =
      (window as any).__originalSendMessage || sendMessage;
    (window as any).__originalSendMessage = originalSendMessage;

    // Create an enhanced sendMessage that includes artifact reference
    const enhancedSendMessage = (text: string, options?: any) => {
      // If artifact is already provided, use it as-is
      if (options?.artifact) {
        return originalSendMessage(text, options);
      }

      // If canvas is open and we have an artifact, add full artifact reference
      if (currentArtifact) {
        const artifactPayload = {
          title: currentArtifact.title || 'Untitled Artifact',
          file_extension: currentArtifact.file_extension || 'txt',
          id: String(currentArtifact.id),
          is_partial: false, // Full artifact reference
        };

        console.log(
          '[Canvas] Enhancing message with full artifact reference:',
          {
            text,
            artifact: artifactPayload,
          },
        );

        return originalSendMessage(text, {
          ...options,
          visible: options?.visible !== false,
          artifact: artifactPayload,
        });
      }

      // Fallback to original
      return originalSendMessage(text, options);
    };

    // Replace the global sendMessage
    (window as any).__canvasEnhancedSendMessage = enhancedSendMessage;

    // Dispatch event to notify chat system
    const event = new CustomEvent('canvas-integration-active', {
      detail: {
        artifactId: currentArtifact.id,
        sendMessage: enhancedSendMessage,
      },
    });
    window.dispatchEvent(event);

    return () => {
      // Restore original sendMessage
      const restoreEvent = new CustomEvent('canvas-integration-inactive');
      window.dispatchEvent(restoreEvent);
      delete (window as any).__canvasEnhancedSendMessage;
    };
  }, [isCanvasOpen, currentArtifact, sendMessage]);
}

/**
 * Hook for chat components to use canvas-enhanced sendMessage
 */
export function useChatWithCanvas() {
  const getEnhancedSendMessage = useCallback(() => {
    return (window as any).__canvasEnhancedSendMessage || null;
  }, []);

  return {
    getEnhancedSendMessage,
    isCanvasActive: () => !!(window as any).__canvasEnhancedSendMessage,
  };
}
