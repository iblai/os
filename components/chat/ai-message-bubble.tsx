'use client';

import { useTranslations } from 'next-intl';
import { RefreshCcw } from 'lucide-react';

import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AIMessageCopy } from './ai-message-copy';
import { AIMessageShare } from './ai-message-share';
import { AIMessageSpeak } from './ai-message-speak';
import {
  selectShowingSharedChat,
  useTenantMetadata as useTenantMetadataHook,
  type ChatPhase,
  type Message,
  type ToolCallInfo,
} from '@iblai/iblai-js/web-utils';
import { AIMessageRating } from './ai-message-rating';
import { AIMessageReportInappropriateContent } from './ai-message-report-inappropriate-content';
import { cn, isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';
import { CSS_CLASS_NAMES } from '@/lib/constants';
import { Button } from '../ui/button';
import { useAppSelector } from '@/lib/hooks';
import { MessagePreview } from './chat-messages/message-preview';
import type { CanvasOpenPayload } from './chat-messages/types';
import { ReasoningSection } from './reasoning-section';
import { ToolCallIndicator } from './tool-call-indicator';
import {
  CodePermissionCards,
  useCodePermissionRequests,
} from './code-permission-card';
import { AgentTodoList } from './agent-todo-list';
import {
  AIMessageFrame,
  bubbleTodos,
  hasArtifactVersions,
  hasGenericToolCalls,
  hasVisibleBubbleContent,
} from './ai-message-frame';
import { WorkingIndicator } from './working-indicator';
import { config } from '@/lib/config';
import { useChatPrivacy } from '@iblai/iblai-js/web-containers';
import { useUsername } from '@/hooks/use-user';

export function getLastUserMessage(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i];
    }
  }
  return null;
}

const mapActionToCallback = (key: string) =>
  ({
    redirectToAuthSpaJoinTenant: () => redirectToAuthSpaJoinTenant(),
  })[key];

interface AIMessageBubbleProps {
  content: string;
  profileImage: string;
  mentorName: string;
  timestamp: string;
  sessionId: string;
  messages: Message[];
  tenantKey: string;
  mentorId: string;
  message: Message;
  onRetry: (content: string) => void;
  onReply?: () => void;
  onOpenCanvas?: (payload: CanvasOpenPayload) => void;
  streamingArtifactId?: number;
  reasoningContent?: string;
  toolCalls?: ToolCallInfo[];
  isCurrentlyStreaming?: boolean;
  showReasoning?: boolean;
  /**
   * Phase of the in-flight turn, supplied only for the message that is
   * currently streaming. Drives the shimmering working line at the foot of the
   * bubble; `undefined` on every other message.
   */
  workingPhase?: ChatPhase;
}

export function AIMessageBubble({
  content,
  profileImage,
  mentorName,
  timestamp,
  sessionId,
  mentorId,
  onRetry,
  messages,
  message,
  tenantKey,
  onOpenCanvas,
  streamingArtifactId,
  reasoningContent,
  toolCalls,
  isCurrentlyStreaming,
  showReasoning,
  workingPhase,
}: AIMessageBubbleProps) {
  const t = useTranslations('chatAiMessageBubble');
  const showingSharedChat = useAppSelector(selectShowingSharedChat);
  // Code's permission prompts belong to the turn that raised them. A streaming
  // assistant message's id IS the generation id (`onStart` seeds it), so matching on it
  // keeps another chat's prompt out of this bubble — chats now run their own opencode
  // process and can be waiting concurrently. Shared store, so every bubble reads the
  // same list through one pair of Tauri listeners.
  const permissionRequests = useCodePermissionRequests();
  const hasPermissionPrompts =
    !!isCurrentlyStreaming &&
    permissionRequests.some((r) => r.generation_id === message?.id);

  // Chat private mode signal — same source as the nav-bar toggle and the
  // chat-input Memory gate. A private session is a temporary chat that is not
  // persisted, so the "Share this chat" action is hidden while it is active
  // (there is no durable session to share). Gate on `isEffectiveReady` so the
  // button doesn't flash before the effective query resolves.
  const username = useUsername();
  const {
    effective: chatPrivacyEffective,
    isEffectiveReady: chatPrivacyReady,
  } = useChatPrivacy({
    org: tenantKey,
    userId: username ?? undefined,
    mentor: mentorId,
  });
  const chatPrivacyActive =
    chatPrivacyReady && chatPrivacyEffective?.mode === 'disabled';

  const { metadata: tenantMetadata } = useTenantMetadataHook({
    org: tenantKey,
  });
  const isMentorInappropriateContentEnabled =
    tenantMetadata?.mentor_report_inappropriate_content !== false;
  const supportEmail = tenantMetadata?.support_email || config.supportEmail();

  // A Code turn is identifiable by its id: `streamOpencodeChat` mints
  // `opencode-<ts>` generation ids and the chat slice persists them as the
  // message id (see the SDK's opencode-client). The collapsed activity
  // surfaces are forced on for those turns regardless of the mentor's
  // show_reasoning setting: Code is told to keep its visible text terse, and in
  // automatic-approval mode there are no permission cards either, so a turn
  // that spends minutes running commands would otherwise look frozen.
  const isCodeTurn =
    typeof message?.id === 'string' && message.id.startsWith('opencode-');
  const showAgentActivity = showReasoning || isCodeTurn;

  // The reasoning section and tool-call indicator are gated by that flag.
  // While that's off, an assistant message that is still streaming has no text
  // yet — without the verbose surfaces there would be nothing to show, so the
  // bubble would render as an empty gray box. Skip rendering entirely until the
  // bubble has something visible (text, a visible verbose surface, a waiting
  // permission prompt, actions, or an artifact preview); the standalone working
  // placeholder covers the interim. The chat container asks the very same
  // predicate before it mounts that placeholder, which is what keeps it to one
  // agent frame per turn.
  const hasVisibleContent = hasVisibleBubbleContent({
    content,
    message,
    reasoningContent,
    toolCalls,
    showReasoning: showAgentActivity,
    hasPermissionPrompts,
  });

  if (!hasVisibleContent) {
    return null;
  }

  const showReasoningSection = Boolean(showAgentActivity && reasoningContent);
  const showToolCalls = hasGenericToolCalls(toolCalls, showAgentActivity);
  const todos = bubbleTodos(toolCalls, showAgentActivity);
  const hasTodosToShow = !!todos?.length;

  // A disclosure row is "active" when the phase it depicts is the live one AND
  // the row is actually on screen. These two booleans do double duty, and the
  // symmetry is the point: the active row gets its bouncing dots (it is now the
  // thing conveying progress), and the same fact stands the working line down,
  // because repeating "Thinking…" under a row that says "Thought" puts the same
  // statement on screen twice. Exactly one of them animates.
  const isReasoningRowActive =
    workingPhase?.kind === 'thinking' && showReasoningSection;
  const isToolRowActive = workingPhase?.kind === 'tool' && showToolCalls;
  const isRestatedByVisibleRow = isReasoningRowActive || isToolRowActive;

  return (
    <TooltipProvider>
      <AIMessageFrame
        profileImage={profileImage}
        mentorName={mentorName}
        timestamp={timestamp}
      >
        <>
          <div
            className={cn(
              'mb-1.5 rounded-2xl bg-gray-100 p-3 wrap-anywhere',
              CSS_CLASS_NAMES.CHAT.AI_MESSAGE_RESPONSE,
              hasArtifactVersions(message) && 'bg-white p-0',
            )}
          >
            {showReasoningSection && (
              <ReasoningSection
                reasoningContent={reasoningContent!}
                isActive={isReasoningRowActive}
              />
            )}
            {showToolCalls && (
              <ToolCallIndicator
                toolCalls={toolCalls!}
                isActive={isToolRowActive}
              />
            )}
            {hasTodosToShow && (
              <AgentTodoList
                todos={todos}
                isCurrentlyStreaming={isCurrentlyStreaming}
              />
            )}
            {hasPermissionPrompts && (
              <CodePermissionCards generationId={message.id} />
            )}
            <div className="overflow-x-auto text-sm/6 text-gray-800 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_code]:rounded [&_code]:bg-gray-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_em]:italic [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-gray-200 [&_pre]:p-2 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-4">
              <MessagePreview
                content={content}
                artifactVersions={message?.artifactVersions}
                onOpenCanvas={onOpenCanvas}
                streamingArtifactId={streamingArtifactId}
              />
            </div>
            {message?.actions && (
              <div className="flex flex-wrap">
                {message.actions.map((action, index) => (
                  <Button
                    key={index}
                    onClick={mapActionToCallback(action.actionType)}
                    className="ibl-button-primary cursor-pointer"
                  >
                    {action.text}
                  </Button>
                ))}
              </div>
            )}
            {/* Working line for the turn that is still running, sitting under
                  whatever has streamed so far. Mounted for the whole turn and
                  never conditionally unmounted: it decides for itself when to
                  render nothing, and its stall clock has to keep ticking while
                  it is invisible. We only hand it the facts it cannot see —
                  which rows are speaking for it, and the streamed text whose
                  changes mark token arrival. */}
            {workingPhase && (
              <WorkingIndicator
                phase={workingPhase}
                restatedByVisibleRow={isRestatedByVisibleRow}
                content={content}
                className="mt-2"
              />
            )}
          </div>
          {/* Action toolbar (copy, rating, share, report, retry) — hidden
                while this message is still streaming; only meaningful once the
                response is complete. */}
          <div
            className={cn(
              'flex items-center space-x-4',
              isCurrentlyStreaming && 'hidden',
            )}
          >
            <AIMessageCopy content={content} />

            {isLoggedIn() && !showingSharedChat && (
              <AIMessageRating
                content={content}
                messages={messages}
                sessionId={sessionId}
                mentorId={mentorId}
                tenantKey={tenantKey}
              />
            )}

            {!showingSharedChat && !chatPrivacyActive && (
              <AIMessageShare sessionId={sessionId} tenantKey={tenantKey} />
            )}

            {isLoggedIn() &&
              !showingSharedChat &&
              isMentorInappropriateContentEnabled && (
                <AIMessageReportInappropriateContent
                  mentorName={mentorName}
                  messages={messages}
                  supportEmail={supportEmail}
                />
              )}

            <AIMessageSpeak
              message={message}
              mentorId={mentorId}
              tenantKey={tenantKey}
            />

            {isLoggedIn() && !showingSharedChat && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      const lastUserMessage = getLastUserMessage(messages);
                      if (lastUserMessage) {
                        onRetry(lastUserMessage.content);
                      }
                    }}
                    className="-ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <span className="sr-only">{t('retryScreenReader')}</span>
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="ibl-tooltip-content">
                  {t('retryTooltip')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </>
      </AIMessageFrame>
    </TooltipProvider>
  );
}
