'use client';

import { forwardRef } from 'react';
import { RefreshCcw } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AIMessageCopy } from './ai-message-copy';
import { AIMessageShare } from './ai-message-share';
import { selectShowingSharedChat, type Message } from '@iblai/iblai-js/web-utils';
import { AIMessageRating } from './ai-message-rating';
import { cn, isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';
import { CSS_CLASS_NAMES } from '@/lib/constants';
import { Button } from '../ui/button';
import { useAppSelector } from '@/lib/hooks';
import { MessagePreview } from './chat-messages/message-preview';
import type { CanvasOpenPayload } from './chat-messages/types';

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
  message?: Message;
  onRetry: (content: string) => void;
  onSpeak?: (content: string) => void;
  onReply?: () => void;
  onOpenCanvas?: (payload: CanvasOpenPayload) => void;
  streamingArtifactId?: number;
}

export const AIMessageBubble = forwardRef<HTMLButtonElement, AIMessageBubbleProps>(
  function AIMessageBubble(
    {
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
    },
    ref,
  ) {
    const showingSharedChat = useAppSelector(selectShowingSharedChat);
    return (
      <TooltipProvider>
        <div className="mb-4">
          <div className="flex items-start ml-0">
            <div className="flex-shrink-0 mr-2 sm:mr-3">
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-gray-200 p-[1px] rounded-full">
                <AvatarImage src={profileImage} alt={mentorName} />
                <AvatarFallback>{mentorName.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0 max-w-full md:max-w-[75%]">
              <div className="flex items-center mb-1">
                <span className="font-medium text-gray-900 mr-2 text-sm">{mentorName}</span>
                <span className="text-gray-500 text-xs">{timestamp}</span>
              </div>
              <div
                className={cn(
                  'bg-gray-100 rounded-lg p-3 mb-1.5 wrap-anywhere',
                  CSS_CLASS_NAMES.CHAT.AI_MESSAGE_RESPONSE,
                  hasArtifactVersions(message) && 'p-0 bg-white',
                )}
              >
                <div className="text-gray-800 text-sm/6 [&_strong]:font-bold [&_em]:italic [&_code]:bg-gray-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_pre]:bg-gray-200 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1">
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
                <AIMessageCopy ref={ref} content={content} />

                {isLoggedIn() && !showingSharedChat && (
                  <AIMessageRating
                    content={content}
                    messages={messages}
                    sessionId={sessionId}
                    mentorId={mentorId}
                    tenantKey={tenantKey}
                  />
                )}

                {isLoggedIn() && !showingSharedChat && (
                  <AIMessageShare sessionId={sessionId} tenantKey={tenantKey} />
                )}

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
                        className="text-gray-500 hover:text-gray-700 -ml-1"
                      >
                        <span className="sr-only">Retry for a new response</span>
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="ibl-tooltip-content">Retry</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  },
);
