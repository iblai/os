'use client';

import { CircleStop, Volume2 } from 'lucide-react';

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
  sessionId: string;
};

export function AIMessageSpeak({
  message,
  mentorId,
  tenantKey,
  sessionId,
}: Props) {
  const { isSpeaking, isSupported, toggle } = useSpeech({
    mentorId,
    tenantKey,
    sessionId,
  });

  if (!isSupported) {
    return null;
  }

  const label = isSpeaking ? 'Stop Reading Aloud' : 'Read Aloud';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => toggle(message)}
          aria-label={label}
          aria-pressed={isSpeaking}
          className="-ml-1 text-gray-500 hover:text-gray-700"
        >
          <span className="sr-only">{label}</span>
          {isSpeaking ? (
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
