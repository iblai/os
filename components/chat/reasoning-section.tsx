"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Markdown from "@/components/markdown";
import { cn } from "@/lib/utils";

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

  // Auto-open when reasoning starts, auto-collapse when it completes
  useEffect(() => {
    if (reasoningContent) {
      setIsOpen(isReasoning);
    }
  }, [isReasoning, reasoningContent]);

  if (!reasoningContent) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-1 py-1 text-xs text-gray-500 hover:text-gray-600 transition-colors">
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-90",
          )}
        />
        <span>{isReasoning ? "Thinking" : "Thought"}</span>
        {isReasoning && isCurrentlyStreaming && (
          <span className="inline-flex gap-0.5">
            <span className="inline-block h-1 w-1 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
            <span className="inline-block h-1 w-1 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
            <span className="inline-block h-1 w-1 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 pb-2">
        <div className="max-h-[200px] overflow-y-auto border-l-2 border-gray-200 pl-3 text-xs text-gray-500 leading-relaxed">
          <Markdown className="prose prose-xs max-w-none [&_*]:text-gray-500 [&_strong]:font-normal [&_em]:font-normal [&_*]:text-xs">
            {reasoningContent}
          </Markdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
