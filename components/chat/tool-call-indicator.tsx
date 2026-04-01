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
import type { ToolCallInfo } from '@iblai/iblai-js/web-utils';
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

  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  const lastTool = toolCalls[toolCalls.length - 1];
  const isStreaming = isCurrentlyStreaming;

  const headerLabel = `Used ${toolCalls.length} tool${toolCalls.length === 1 ? '' : 's'}`;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 pt-1 text-xs text-gray-500 transition-colors hover:text-gray-600">
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
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:0ms]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:150ms]" />
            <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-gray-500 [animation-delay:300ms]" />
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2 pl-4">
        <div className="space-y-1.5 border-l-2 border-gray-200 pt-1.5 pl-3 text-xs leading-relaxed text-gray-500">
          {toolCalls.map((toolCall, index) => {
            const query = getQueryLabel(toolCall);
            const Icon = getToolIcon(toolCall?.name);
            const isLast = index === toolCalls.length - 1;

            return (
              <div key={toolCall?.id || index}>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <Icon className="h-3 w-3 shrink-0 text-gray-400" />
                  <span className="font-medium">
                    {getFriendlyToolName(toolCall?.name ?? '')}
                  </span>
                  {isLast && isStreaming && (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-gray-400" />
                  )}
                </div>
                {query && (
                  <div className="mt-0.5 ml-[18px] text-gray-400 dark:text-gray-500">
                    <Markdown className="prose prose-xs max-w-none [&_*]:text-xs [&_*]:text-gray-400 dark:[&_*]:text-gray-500 [&_p]:m-0">
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
