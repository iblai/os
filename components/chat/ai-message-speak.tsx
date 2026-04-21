'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleStop, Volume2 } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  content: string;
};

export function AIMessageSpeak({ content }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isSupported) {
    return null;
  }

  const handleToggle = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const label = isSpeaking ? 'Stop Reading Aloud' : 'Read Aloud';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleToggle}
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
