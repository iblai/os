'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import Markdown from '@/components/markdown';
import { cn } from '@/lib/utils';

interface ReasoningSectionProps {
  reasoningContent: string;
  isReasoning: boolean;
  isCurrentlyStreaming?: boolean;
}

export function ReasoningSection({
  reasoningContent,
  isReasoning,
  isCurrentlyStreaming = false,
}: ReasoningSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoningContent) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 py-1 text-xs text-gray-500 transition-colors hover:text-gray-600">
        <ChevronRight
          className={cn(
            'h-3 w-3 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
        <span>{isReasoning ? 'Thinking' : 'Thought'}</span>
        {isReasoning && isCurrentlyStreaming && (
          <span className="inline-flex gap-0.5">
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms]" />
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2 pl-4">
        <div className="max-h-[200px] overflow-y-auto border-l-2 border-gray-200 pl-3 text-xs leading-relaxed text-gray-500">
          <Markdown className="prose prose-xs max-w-none [&_*]:text-xs [&_*]:text-gray-500 [&_em]:font-normal [&_strong]:font-normal">
            {reasoningContent}
          </Markdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
