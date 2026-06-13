'use client';

import React, { useState } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ToolCallInfo } from '@iblai/iblai-js/web-utils';
import {
  getFriendlyToolName,
  getQueryLabel,
  formatResult,
} from './tool-call-utils';

interface ToolCallItemProps {
  toolCall: ToolCallInfo;
  shouldPulse: boolean;
  isCurrentlyStreaming: boolean;
}

export function ToolCallItem({
  toolCall,
  shouldPulse,
  isCurrentlyStreaming,
}: ToolCallItemProps) {
  const [isOpen, setIsOpen] = useState(() => isCurrentlyStreaming);

  // Auto-collapse when streaming ends
  React.useEffect(() => {
    if (!isCurrentlyStreaming) {
      setIsOpen(false);
    }
  }, [isCurrentlyStreaming]);

  const query = getQueryLabel(toolCall);
  const result = toolCall.result ? formatResult(toolCall.result) : null;
  const hasDetails = !!(query || result);

  if (!hasDetails) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
        <Wrench className="h-3 w-3 shrink-0" />
        <span className="whitespace-nowrap">
          {getFriendlyToolName(toolCall.name)}
        </span>
        {shouldPulse && (
          <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40">
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
        <Wrench className="h-3 w-3 shrink-0" />
        <span className="whitespace-nowrap">
          {getFriendlyToolName(toolCall.name)}
        </span>
        {query && !isOpen && (
          <span className="min-w-0 truncate text-blue-500 dark:text-blue-400">
            — {query}
          </span>
        )}
        {shouldPulse && (
          <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-blue-500" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 ml-1">
        <div className="overflow-hidden rounded-md border border-blue-100 bg-white text-xs dark:border-blue-900 dark:bg-gray-900">
          {query && (
            <div className="flex items-start gap-2 bg-blue-50/60 px-3 py-2 dark:bg-blue-950/20">
              <span className="mt-0.5 shrink-0 text-[10px] font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
                Query
              </span>
              <span className="text-gray-700 dark:text-gray-300">{query}</span>
            </div>
          )}
          {result && (
            <div className="border-t border-blue-100 px-3 py-2 dark:border-blue-900">
              <span className="mb-1.5 block text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                Result
              </span>
              <div className="max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                {result}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
