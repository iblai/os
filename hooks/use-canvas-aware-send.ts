import { useCallback, useEffect, useState } from 'react';

/**
 * Hook that wraps sendMessage to include artifact context when canvas is open
 * This should be used in the chat component
 */
export function useCanvasAwareSend(originalSendMessage: (text: string, options?: any) => void) {
  const [canvasArtifact, setCanvasArtifact] = useState<{
    id: string;
    title: string;
    file_extension: string;
  } | null>(null);

  // Listen for canvas state changes
  useEffect(() => {
    const handleCanvasActive = (event: CustomEvent) => {
      const { artifactId, title, file_extension } = event.detail || {};
      if (artifactId) {
        setCanvasArtifact({
          id: String(artifactId),
          title: title || 'Untitled Artifact',
          file_extension: file_extension || 'txt',
        });
        console.log('[Chat] Canvas is active with artifact:', artifactId);
      }
    };

    const handleCanvasInactive = () => {
      setCanvasArtifact(null);
      console.log('[Chat] Canvas is inactive');
    };

    window.addEventListener('canvas-active' as any, handleCanvasActive as any);
    window.addEventListener('canvas-inactive' as any, handleCanvasInactive as any);

    return () => {
      window.removeEventListener('canvas-active' as any, handleCanvasActive as any);
      window.removeEventListener('canvas-inactive' as any, handleCanvasInactive as any);
    };
  }, []);

  // Enhanced send message that includes artifact when canvas is open
  const sendMessage = useCallback(
    (text: string, options?: any) => {
      // If canvas is open and no artifact is explicitly provided, add it
      if (canvasArtifact && !options?.artifact) {
        const artifactPayload = {
          title: canvasArtifact.title,
          file_extension: canvasArtifact.file_extension,
          id: canvasArtifact.id,
          is_partial: false, // Full artifact reference for normal messages
        };

        console.log('[Chat] Sending with canvas artifact:', {
          text,
          artifact: artifactPayload,
        });

        return originalSendMessage(text, {
          ...options,
          visible: options?.visible !== false,
          artifact: artifactPayload,
        });
      }

      // Otherwise send as normal
      return originalSendMessage(text, options);
    },
    [originalSendMessage, canvasArtifact],
  );

  return {
    sendMessage,
    isCanvasActive: !!canvasArtifact,
    canvasArtifact,
  };
}
