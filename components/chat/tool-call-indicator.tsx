"use client";

import type { ToolCallInfo } from "@iblai/iblai-js/web-utils";
import { ToolCallItem } from "./tool-call-item";

interface ToolCallIndicatorProps {
  toolCalls: ToolCallInfo[];
  isCurrentlyStreaming?: boolean;
}

export function ToolCallIndicator({
  toolCalls,
  isCurrentlyStreaming = false,
}: ToolCallIndicatorProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      {toolCalls.map((toolCall, index) => {
        const isLastTool = index === toolCalls.length - 1;
        const shouldPulse = isLastTool && isCurrentlyStreaming;

        return (
          <ToolCallItem
            key={toolCall.id || index}
            toolCall={toolCall}
            shouldPulse={shouldPulse}
            isCurrentlyStreaming={isCurrentlyStreaming}
          />
        );
      })}
    </div>
  );
}
