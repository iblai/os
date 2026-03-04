'use client';

import React, { useEffect, useRef } from 'react';
import { CanvasComponent } from '@/components/canvas/canvas-component';
// import { CodeCanvasComponent } from '@/components/canvas/code-canvas-component';

interface CanvasViewProps {
  onClose: () => void;
  canvasTitle?: string;
  canvasContent?: string;
  canvasType: 'document' | 'code';
  artifactId?: number;
  org?: string;
  userId?: string;
  fileExtension?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  tenantKey?: string;
  sendMessage?: (text: string, options?: { visible?: boolean; artifact?: any }) => void;
  refreshTrigger?: number; // Add refresh trigger to force refresh
}

export function CanvasView({
  onClose,
  canvasTitle,
  canvasContent,
  canvasType,
  artifactId,
  org,
  userId,
  // fileExtension,
  metadata,
  sessionId,
  tenantKey,
  sendMessage,
  refreshTrigger,
}: CanvasViewProps) {
  const refreshKeyRef = useRef(0);
  const prevRefreshTriggerRef = useRef(0);
  const prevArtifactIdRef = useRef<number | undefined>(artifactId);

  // Update refresh key when trigger changes OR artifactId changes to force component remount
  useEffect(() => {
    const artifactIdChanged = artifactId !== prevArtifactIdRef.current;
    const triggerChanged =
      refreshTrigger && refreshTrigger > 0 && refreshTrigger !== prevRefreshTriggerRef.current;

    if (triggerChanged || artifactIdChanged) {
      if (triggerChanged) {
        refreshKeyRef.current = refreshTrigger;
        prevRefreshTriggerRef.current = refreshTrigger;
      } else if (artifactIdChanged) {
        // If artifactId changed, increment refresh key to force remount
        refreshKeyRef.current = (refreshKeyRef.current || 0) + 1;
      }
      prevArtifactIdRef.current = artifactId;
    }
  }, [refreshTrigger, artifactId]);

  const renderCanvasComponent = () => {
    // Use artifactId and refresh key in component key to force remount when opening a different artifact
    // This ensures the canvas always loads correctly, even when switching between multiple canvases
    const componentKey = artifactId
      ? `${canvasType}-${artifactId}-${refreshKeyRef.current}`
      : `${canvasType}-${refreshKeyRef.current || Date.now()}`;

    // if (canvasType === 'code') {
    //   return (
    //     <CodeCanvasComponent
    //       key={componentKey}
    //       title={canvasTitle}
    //       content={canvasContent}
    //       onClose={onClose}
    //       artifactId={artifactId}
    //       org={org}
    //       userId={userId}
    //       fileExtension={fileExtension}
    //       metadata={metadata}
    //       sessionId={sessionId}
    //       tenantKey={tenantKey}
    //       sendMessage={sendMessage}
    //     />
    //   );
    // }
    return (
      <CanvasComponent
        key={componentKey}
        title={canvasTitle}
        content={canvasContent}
        onClose={onClose}
        artifactId={artifactId}
        org={org}
        userId={userId}
        metadata={metadata}
        sessionId={sessionId}
        tenantKey={tenantKey}
        sendMessage={sendMessage}
      />
    );
  };

  return (
    <div className="h-full w-full bg-white overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
      {renderCanvasComponent()}
    </div>
  );
}
