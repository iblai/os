'use client';

import type { ReactNode } from 'react';
import {
  WRITE_TODOS_TOOL,
  extractLatestTodos,
  type ChatPhase,
  type Message,
  type ToolCallInfo,
} from '@iblai/iblai-js/web-utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WorkingIndicator } from '@/components/chat/working-indicator';

/** True when the message carries at least one artifact version to preview. */
export function hasArtifactVersions(message?: Message): boolean {
  return !!(message?.artifactVersions && message.artifactVersions.length > 0);
}

/**
 * The tool calls that reach the generic `ToolCallIndicator`.
 *
 * `write_todos` has a dedicated renderer (`AgentTodoList`), so it must never
 * appear as a generic tool card nor be counted in "Used N tools" — and, more
 * importantly here, a turn whose only tool call is `write_todos` must not make
 * the tool row "visible" on its own, or it would reserve an empty gray bubble.
 */
export function hasGenericToolCalls(
  toolCalls?: ToolCallInfo[],
  showReasoning?: boolean,
): boolean {
  return !!(
    showReasoning &&
    toolCalls?.some((toolCall) => toolCall?.name !== WRITE_TODOS_TOOL)
  );
}

/** The task list a turn's `write_todos` calls resolve to, or `undefined`. */
export function bubbleTodos(
  toolCalls?: ToolCallInfo[],
  showReasoning?: boolean,
) {
  return showReasoning ? extractLatestTodos(toolCalls) : undefined;
}

type VisibleContentInput = {
  content?: string;
  message?: Message;
  reasoningContent?: string;
  toolCalls?: ToolCallInfo[];
  showReasoning?: boolean;
  /**
   * Whether a Code permission prompt is waiting on this turn. Sourced from
   * `useCodePermissionRequests`, which is a hook, so it cannot be derived in
   * here — callers read it and hand it over, keeping this predicate pure.
   */
  hasPermissionPrompts?: boolean;
};

/**
 * Whether an assistant message has anything to put inside its bubble.
 *
 * `AIMessageBubble` renders nothing when this is false — a streaming message
 * that has not produced a token yet (and whose reasoning/tool surfaces are
 * hidden) would otherwise be an empty gray box. The chat container mirrors this
 * call to decide whether the standalone working placeholder is still needed, so
 * the two must stay in lockstep: exactly one agent frame per turn, never two.
 */
export function hasVisibleBubbleContent({
  content,
  message,
  reasoningContent,
  toolCalls,
  showReasoning,
  hasPermissionPrompts,
}: VisibleContentInput): boolean {
  const hasReasoningToShow = !!(showReasoning && reasoningContent);
  const hasToolCallsToShow = hasGenericToolCalls(toolCalls, showReasoning);
  const hasTodosToShow = !!bubbleTodos(toolCalls, showReasoning)?.length;

  return (
    (content ?? '').trim().length > 0 ||
    hasReasoningToShow ||
    hasToolCallsToShow ||
    hasTodosToShow ||
    // A permission prompt can be the FIRST thing in a Code turn, before any
    // text. Without this the bubble renders as null and the turn looks
    // silently stalled — and the standalone placeholder would keep its own
    // frame up alongside the prompt.
    !!hasPermissionPrompts ||
    !!message?.actions?.length ||
    hasArtifactVersions(message)
  );
}

type AIMessageFrameProps = {
  profileImage: string;
  mentorName: string;
  timestamp: string;
  children: ReactNode;
};

/**
 * The avatar + mentor name + timestamp chrome around an agent turn. Shared by
 * the real streamed bubble and by the pre-stream working placeholder so both
 * read as the same message rather than two stacked headers.
 */
export function AIMessageFrame({
  profileImage,
  mentorName,
  timestamp,
  children,
}: AIMessageFrameProps) {
  return (
    <div className="mb-4">
      <div className="ml-0 flex items-start">
        <div className="mr-2 flex-shrink-0 sm:mr-3">
          <Avatar className="h-7 w-7 rounded-full border border-gray-200 p-[1px] sm:h-8 sm:w-8">
            <AvatarImage src={profileImage} alt={mentorName} />
            <AvatarFallback>
              {mentorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center">
            <span className="mr-2 text-sm font-medium text-gray-900">
              {mentorName}
            </span>
            <span className="text-xs text-gray-500">{timestamp}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

type AIWorkingMessageProps = {
  phase: ChatPhase;
  profileImage: string;
  mentorName: string;
  timestamp: string;
};

/**
 * Stand-in agent message for the window where the turn is running but no
 * assistant bubble exists yet — between pressing send and the first token,
 * reasoning block or tool call. It deliberately omits
 * `CSS_CLASS_NAMES.CHAT.AI_MESSAGE_RESPONSE`: nothing has been said yet, so
 * consumers targeting real responses must not match it.
 */
export function AIWorkingMessage({
  phase,
  profileImage,
  mentorName,
  timestamp,
}: AIWorkingMessageProps) {
  return (
    <div data-testid="chat-working-message">
      <AIMessageFrame
        profileImage={profileImage}
        mentorName={mentorName}
        timestamp={timestamp}
      >
        <div className="mb-1.5 rounded-2xl bg-gray-100 p-3 wrap-anywhere">
          <WorkingIndicator phase={phase} />
        </div>
      </AIMessageFrame>
    </div>
  );
}
