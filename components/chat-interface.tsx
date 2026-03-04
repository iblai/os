'use client';

import React, { RefObject } from 'react';
import { Chat } from './chat';

interface ChatInterfaceProps {
  containerRef?: RefObject<HTMLDivElement | null>;
  isInCanvasView?: boolean;
}

/**
 * ChatInterface is a wrapper component for the Chat component
 * Used in split-view layouts like CanvasView where chat needs to be
 * displayed alongside other content
 */
export function ChatInterface({ containerRef, isInCanvasView = false }: ChatInterfaceProps) {
  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      <Chat
        mode="default"
        isPreviewMode={false}
        hasBorder={false}
        isInCanvasView={isInCanvasView}
      />
    </div>
  );
}
