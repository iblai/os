'use client';

import dynamic from 'next/dynamic';
import React, { forwardRef } from 'react';

import { formatRelativeDate } from '@/lib/utils';
import {
  Message as BaseMessage,
  type ToolCallInfo,
} from '@iblai/iblai-js/web-utils';
import { AIMessageBubble } from '@/components/chat/ai-message-bubble';
import type { CanvasOpenPayload } from './types';
import { UserMessageBubble } from './user-message-bubble';

const ImagePreviewModal = dynamic(
  () => import('./image-preview-modal').then((mod) => mod.ImagePreviewModal),
  {
    ssr: false,
  },
);

interface Message extends BaseMessage {
  replyTo?: Message | null;
}

type Props = {
  messages: Message[];
  highlightedMessageId: number | null;
  profileImage: string;
  mentorName: string;
  sessionId: string;
  mentorId: string;
  tenantKey: string;
  streamingArtifactId?: number;
  streamingReasoningContent?: string;
  streamingToolCalls?: ToolCallInfo[];
  isReasoning?: boolean;
  currentStreamingMessageId?: string;
  handleHighlightMessage: (messageId: number) => void;
  handleSubmit: (content: string) => void;
  onReply?: (message: Message) => void;
  onOpenCanvas?: (payload: CanvasOpenPayload) => void;
};
export const ChatMessages = forwardRef<HTMLButtonElement, Props>(
  function ChatMessages(
    {
      messages,
      highlightedMessageId,
      profileImage,
      mentorName,
      sessionId,
      mentorId,
      tenantKey,
      handleHighlightMessage,
      handleSubmit,
      onReply,
      onOpenCanvas,
      streamingArtifactId,
      streamingReasoningContent,
      streamingToolCalls,
      isReasoning,
      currentStreamingMessageId,
    },
    ref,
  ) {
    const [previewImage, setPreviewImage] = React.useState<string | null>(null);

    // Find the index of the last AI message for focus management
    const visibleMessages = messages.filter(
      (message) => message.visible === true,
    );
    const lastAIMessageIndex = visibleMessages.reduce(
      (lastIndex, message, index) => {
        return message.role === 'assistant' ? index : lastIndex;
      },
      -1,
    );

    // Filter out invisible messages before rendering to prevent flash
    return (
      <>
        {visibleMessages.map((message, i) =>
          message.role === 'user' ? (
            <UserMessageBubble
              key={`message-${message.id}-${i}`}
              message={message}
              isHighlighted={highlightedMessageId === i}
              profileImage={profileImage}
              mentorName={mentorName}
              messages={messages}
              onHighlightMessage={handleHighlightMessage}
              onPreviewImage={setPreviewImage}
            />
          ) : (
            <div
              key={i}
              className={`transition-all duration-300 ${highlightedMessageId === i ? 'rounded-lg bg-blue-100' : ''}`}
            >
              <AIMessageBubble
                ref={i === lastAIMessageIndex ? ref : undefined}
                content={message.content}
                message={message}
                profileImage={profileImage}
                mentorName={mentorName}
                timestamp={formatRelativeDate(message.timestamp)}
                sessionId={sessionId}
                onReply={() => onReply?.(message)}
                onRetry={handleSubmit}
                messages={messages}
                mentorId={mentorId}
                tenantKey={tenantKey}
                onOpenCanvas={onOpenCanvas}
                streamingArtifactId={streamingArtifactId}
                // Use streaming data if this is the active streaming message, otherwise use persisted data
                reasoningContent={
                  message.id === currentStreamingMessageId
                    ? streamingReasoningContent
                    : message.reasoningContent
                }
                toolCalls={
                  message.id === currentStreamingMessageId
                    ? streamingToolCalls
                    : message.toolCalls
                }
                isReasoning={
                  message.id === currentStreamingMessageId ? isReasoning : false
                }
                isCurrentlyStreaming={message.id === currentStreamingMessageId}
              />
            </div>
          ),
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <ImagePreviewModal
            url={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </>
    );
  },
);
