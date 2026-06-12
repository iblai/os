'use client';

import { RefreshCcw } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  type Message,
} from '@iblai/iblai-js/web-utils';
import { AIMessageRating } from './ai-message-rating';
import { AIMessageReportInappropriateContent } from './ai-message-report-inappropriate-content';
import { cn, isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';
import { CSS_CLASS_NAMES } from '@/lib/constants';
import { Button } from '../ui/button';
import { useAppSelector } from '@/lib/hooks';
import { MessagePreview } from './chat-messages/message-preview';
import type { CanvasOpenPayload } from './chat-messages/types';
import { config } from '@/lib/config';

// Check if message has artifact versions
const hasArtifactVersions = (message?: Message): boolean => {
  return !!(message?.artifactVersions && message.artifactVersions.length > 0);
};

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
}: AIMessageBubbleProps) {
  const showingSharedChat = useAppSelector(selectShowingSharedChat);
  const { metadata: tenantMetadata } = useTenantMetadataHook({
    org: tenantKey,
  });
  const isMentorInappropriateContentEnabled =
    tenantMetadata?.mentor_report_inappropriate_content !== false;
  const supportEmail = tenantMetadata?.support_email || config.supportEmail();
  return (
    <TooltipProvider>
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
            <div
              className={cn(
                'mb-1.5 rounded-2xl bg-gray-100 p-3 wrap-anywhere',
                CSS_CLASS_NAMES.CHAT.AI_MESSAGE_RESPONSE,
                hasArtifactVersions(message) && 'bg-white p-0',
              )}
            >
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
            </div>
            <div className="flex items-center space-x-4">
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

              {!showingSharedChat && (
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
                      <span className="sr-only">Retry for a new response</span>
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="ibl-tooltip-content">
                    Retry
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
