"use client";

import React, { useState } from "react";
import { ChevronRight, Wrench } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolCallInfo } from "@iblai/iblai-js/web-utils";
import {
  getFriendlyToolName,
  getQueryLabel,
  formatResult,
} from "./tool-call-utils";

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
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 max-w-full">
        <Wrench className="h-3 w-3 shrink-0" />
        <span className="whitespace-nowrap">
          {getFriendlyToolName(toolCall.name)}
        </span>
        {shouldPulse && (
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors max-w-full">
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            isOpen && "rotate-90",
          )}
        />
        <Wrench className="h-3 w-3 shrink-0" />
        <span className="whitespace-nowrap">
          {getFriendlyToolName(toolCall.name)}
        </span>
        {query && !isOpen && (
          <span className="text-blue-500 dark:text-blue-400 truncate min-w-0">
            — {query}
          </span>
        )}
        {shouldPulse && (
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 animate-pulse" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 ml-1">
        <div className="rounded-md border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 overflow-hidden text-xs">
          {query && (
            <div className="flex items-start gap-2 px-3 py-2 bg-blue-50/60 dark:bg-blue-950/20">
              <span className="shrink-0 font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide text-[10px] mt-0.5">
                Query
              </span>
              <span className="text-gray-700 dark:text-gray-300">{query}</span>
            </div>
          )}
          {result && (
            <div className="px-3 py-2 border-t border-blue-100 dark:border-blue-900">
              <span className="block font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px] mb-1.5">
                Result
              </span>
              <div className="max-h-48 overflow-y-auto text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {result}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
