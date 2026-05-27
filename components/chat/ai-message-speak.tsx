'use client';

import { CircleStop, Loader2, Volume2 } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSpeech } from '@/hooks/use-speech';
import { type Message } from '@iblai/iblai-js/web-utils';

type Props = {
  message: Message;
  mentorId: string;
  tenantKey: string;
};

export function AIMessageSpeak({ message, mentorId, tenantKey }: Props) {
  const { currentMessageId, isSpeaking, isLoading, isSupported, toggle } =
    useSpeech({ mentorId, tenantKey });

  if (!isSupported) {
    return null;
  }

  const isActive = currentMessageId === message.id;
  const isThisSpeaking = isActive && isSpeaking;
  const isThisLoading = isActive && isLoading;

  const label = isThisLoading
    ? 'Loading audio'
    : isThisSpeaking
      ? 'Stop Reading Aloud'
      : 'Read Aloud';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => toggle(message)}
          aria-label={label}
          aria-busy={isThisLoading}
          aria-pressed={isThisSpeaking}
          disabled={isThisLoading}
          className="-ml-1 text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="sr-only">{label}</span>
          {isThisLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isThisSpeaking ? (
            <CircleStop className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content">{label}</TooltipContent>
    </Tooltip>
  );
}
