'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';

import { toast } from 'sonner';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateMessageFeedbackMutation } from '@iblai/iblai-js/data-layer';
import { useUsername } from '@/hooks/use-user';
import type { Message } from '@iblai/iblai-js/web-utils';
import React from 'react';
import { cn } from '@/lib/utils';

function getUserMessageBeforeCurrentId(messages: Message[], currentId: string) {
  // get the position of the current message in the array
  const currentMessageIndex = messages.findIndex((message) => message.id === currentId);
  const newMessages = messages.slice(0, currentMessageIndex);

  for (let i = newMessages.length - 1; i >= 0; i--) {
    if (newMessages[i].role === 'user') {
      return newMessages[i].content;
    }
  }

  return '';

  // get the user message before the current message
}

type Props = {
  content: string;
  messages: Message[];
  sessionId: string;
  mentorId: string;
  tenantKey: string;
};

const RATING = {
  GOOD: 1,
  BAD: -1,
};

export function AIMessageRating({ content, messages, mentorId, sessionId, tenantKey }: Props) {
  const [rating, setRating] = React.useState<number | null>(null);

  const username = useUsername();
  const [updateMessageFeedback, { isLoading }] = useUpdateMessageFeedbackMutation();

  async function handleUpdateMessageFeedback(rating: number) {
    try {
      await updateMessageFeedback({
        org: tenantKey,
        requestBody: {
          rating,
          ai_response: content,
          user_text: getUserMessageBeforeCurrentId(messages, sessionId),
          session: sessionId,
          // @ts-expect-error - API expects number but mentorId prop is string from URL params
          mentor: mentorId,
          username: username ?? '',
          reason: rating === 1 ? 'Good response' : 'Bad response',
          additional_feedback: rating === 1 ? 'Good response' : 'Bad response',
        },
        userId: username ?? '',
      }).unwrap();
      setRating(rating);
    } catch (error) {
      toast.error('Failed to update message feedback');
      console.error(JSON.stringify(error));
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isLoading}
            onClick={async () => {
              await handleUpdateMessageFeedback(RATING.GOOD);
            }}
            className="text-gray-500 hover:text-gray-700 -ml-1"
          >
            <span className="sr-only">Positive Feedback Thumbs Up</span>
            <ThumbsUp
              className={cn('h-4 w-4', {
                'text-gray-400 fill-gray-400 stroke-1': rating === RATING.GOOD,
              })}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent className="ibl-tooltip-content">Positive Feedback</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isLoading}
            onClick={async () => {
              await handleUpdateMessageFeedback(RATING.BAD);
            }}
            className="text-gray-500 hover:text-gray-700 -ml-1"
          >
            <span className="sr-only">Negative Feedback Thumbs Down</span>
            <ThumbsDown
              className={cn('h-4 w-4', {
                'text-gray-400 fill-gray-400 stroke-1': rating === RATING.BAD,
              })}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent className="ibl-tooltip-content">Negative Feedback</TooltipContent>
      </Tooltip>
    </>
  );
}
