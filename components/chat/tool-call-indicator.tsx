'use client';

import React, { useState } from 'react';
import {
  ChevronRight,
  Globe,
  Search,
  Code,
  FileText,
  Wrench,
  BookOpen,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import Markdown from '@/components/markdown';
import { WRITE_TODOS_TOOL, type ToolCallInfo } from '@iblai/iblai-js/web-utils';
import { getFriendlyToolName, getQueryLabel } from './tool-call-utils';

interface ToolCallIndicatorProps {
  toolCalls: ToolCallInfo[];
  isCurrentlyStreaming?: boolean;
}

const TOOL_ICONS: Record<string, typeof Globe> = {
  web_search_call: Globe,
  vector_search: Search,
  code_executor: Code,
  file_reader: FileText,
  wikipedia: BookOpen,
};

function getToolIcon(toolName?: string) {
  return (toolName && TOOL_ICONS[toolName]) || Wrench;
}

export function ToolCallIndicator({
  toolCalls,
  isCurrentlyStreaming = false,
}: ToolCallIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // `write_todos` has a dedicated renderer (`AgentTodoList`), so it must never
  // appear as a generic tool card nor be counted in "Used N tools".
  const visibleToolCalls = (toolCalls ?? []).filter(
    (tc) => tc?.name !== WRITE_TODOS_TOOL,
  );

  if (visibleToolCalls.length === 0) {
    return null;
  }

  const isStreaming = isCurrentlyStreaming;

  const uniqueToolCount = new Set(visibleToolCalls.map((tc) => tc.name)).size;
  const headerLabel = `Used ${uniqueToolCount} tool${uniqueToolCount === 1 ? '' : 's'}`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 pt-1 text-xs text-gray-600 transition-colors hover:text-gray-800">
        <ChevronRight
          className={cn(
            'h-3 w-3 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
        <Wrench className="h-3 w-3" />
        <span>{headerLabel}</span>
        {isStreaming && (
          <span className="inline-flex gap-0.5">
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-600 [animation-delay:0ms]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-600 [animation-delay:150ms]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-600 [animation-delay:300ms]" />
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2 pl-4">
        {/* `pt-2.5` matches `space-y-2.5` so the first tool sits the same
            distance from the header as the gap between consecutive tools. */}
        <div className="space-y-2.5 border-l-2 border-gray-300 pt-2.5 pl-3 text-xs leading-relaxed text-gray-600">
          {visibleToolCalls.map((toolCall, index) => {
            const query = getQueryLabel(toolCall);
            const Icon = getToolIcon(toolCall?.name);
            const isLast = index === visibleToolCalls.length - 1;

            return (
              <div key={toolCall?.id || index}>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Icon className="h-3 w-3 shrink-0 text-gray-500" />
                  <span className="font-medium">
                    {getFriendlyToolName(toolCall?.name ?? '')}
                  </span>
                  {isLast && isStreaming && (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-gray-500" />
                  )}
                </div>
                {/* The tool description/query renders through <Markdown>, which
                    brings its own prose colours — they have to be overridden on
                    every descendant or the query falls back to a washed-out
                    grey. gray-600 on the bubble's bg-gray-100 is 6.87:1, well
                    clear of the 4.5:1 AA floor for this 12px text.
                    No `dark:` variant here on purpose: the enclosing message
                    bubble is `bg-gray-100` unconditionally (see
                    ai-message-bubble.tsx), so a dark-mode override would put
                    light grey text on a light grey bubble. */}
                {query && (
                  <div className="mt-0.5 ml-[18px] text-gray-600">
                    <Markdown className="prose prose-xs max-w-none [&_*]:text-xs [&_*]:text-gray-600 [&_p]:m-0">
                      {query}
                    </Markdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
