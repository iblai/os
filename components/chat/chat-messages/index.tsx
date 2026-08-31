'use client';

import dynamic from 'next/dynamic';
import React from 'react';

import { formatRelativeDate } from '@/lib/utils';
import {
  Message as BaseMessage,
  type ChatPhase,
  type ToolCallInfo,
} from '@iblai/iblai-js/web-utils';
import { AIMessageBubble } from '@/components/chat/ai-message-bubble';
import { useSpeech } from '@/hooks/use-speech';
// import { useAppSelector } from '@/lib/hooks';
// import { selectAutoplayLastAiMessage } from '@/features/chat/chatSlice';
import type { CanvasOpenPayload } from './types';
import { UserMessageBubble } from './user-message-bubble';
import { useAppSelector } from '@/lib/hooks';
import { selectAutoplayLastAiMessage } from '@/features/chat/chatSlice';

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
  isStreaming?: boolean;
  streamingReasoningContent?: string;
  streamingToolCalls?: ToolCallInfo[];
  showReasoning?: boolean;
  currentStreamingMessageId?: string;
  /**
   * Phase of the in-flight turn, already derived by the chat container.
   * `undefined` between turns. Forwarded to the streaming bubble only, so the
   * working line renders once, inside the message it belongs to.
   */
  workingPhase?: ChatPhase;
  handleHighlightMessage: (messageId: number) => void;
  handleSubmit: (content: string) => void;
  onReply?: (message: Message) => void;
  onOpenCanvas?: (payload: CanvasOpenPayload) => void;
};
export function ChatMessages({
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
  isStreaming = false,
  streamingReasoningContent,
  streamingToolCalls,
  showReasoning,
  currentStreamingMessageId,
  workingPhase,
}: Props) {
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const { speak, stop } = useSpeech({ mentorId, tenantKey });
  const autoplayEnabled = useAppSelector(selectAutoplayLastAiMessage);

  // Find the index of the last AI message (used for autoplay speech)
  const visibleMessages = messages.filter(
    (message) => message.visible === true,
  );
  const lastAIMessageIndex = visibleMessages.reduce(
    (lastIndex, message, index) => {
      return message.role === 'assistant' ? index : lastIndex;
    },
    -1,
  );

  const lastAIMessage =
    lastAIMessageIndex >= 0 ? visibleMessages[lastAIMessageIndex] : null;
  const lastAIMessageId = lastAIMessage?.id ?? null;
  const lastAIMessageContent = lastAIMessage?.content ?? '';

  // Track the most recent AI message id we already spoke (or skipped on mount)
  // so we never re-speak the same message or retroactively speak history when
  // autoplay is toggled on.
  const lastSpokenIdRef = React.useRef<typeof lastAIMessageId>(lastAIMessageId);
  const prevAutoplayRef = React.useRef(autoplayEnabled);

  React.useEffect(() => {
    if (autoplayEnabled === prevAutoplayRef.current) return;
    prevAutoplayRef.current = autoplayEnabled;
    if (autoplayEnabled) {
      // Don't retroactively read messages that arrived before autoplay was on.
      lastSpokenIdRef.current = lastAIMessageId;
    } else {
      stop();
    }
  }, [autoplayEnabled, lastAIMessageId, stop]);

  React.useEffect(() => {
    if (!autoplayEnabled) return;
    if (isStreaming) return;
    if (!lastAIMessage || !lastAIMessageId || !lastAIMessageContent) return;
    if (lastAIMessageId === lastSpokenIdRef.current) return;
    lastSpokenIdRef.current = lastAIMessageId;
    speak(lastAIMessage);
  }, [
    autoplayEnabled,
    isStreaming,
    lastAIMessage,
    lastAIMessageId,
    lastAIMessageContent,
    speak,
  ]);

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
              showReasoning={showReasoning}
              // Only "currently streaming" while a stream is actually active.
              // currentStreamingMessageId keeps pointing at the last assistant
              // message after the stream ends, so without the isStreaming gate
              // the action toolbar would stay hidden once the response
              // completes.
              isCurrentlyStreaming={
                isStreaming && message.id === currentStreamingMessageId
              }
              // Only the message actually being streamed carries the working
              // line; every other bubble gets `undefined` so a turn can never
              // shimmer in two places.
              workingPhase={
                isStreaming && message.id === currentStreamingMessageId
                  ? workingPhase
                  : undefined
              }
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
}
