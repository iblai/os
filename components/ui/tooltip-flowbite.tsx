"use client";

import type React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "right" | "bottom" | "left";
  className?: string;
  delay?: number;
}

export function TooltipFlowbite({
  content,
  children,
  position = "top",
  className,
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 -translate-y-2 mb-1",
    right: "left-full top-1/2 -translate-y-1/2 translate-x-2 ml-1",
    bottom: "top-full left-1/2 -translate-x-1/2 translate-y-2 mt-1",
    left: "right-full top-1/2 -translate-y-1/2 -translate-x-2 mr-1",
  };

  const arrowPositionClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-700 border-l-transparent border-r-transparent border-b-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-gray-700 border-t-transparent border-b-transparent border-l-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-gray-700 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-700 border-t-transparent border-b-transparent border-r-transparent",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            "absolute z-50 rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-opacity duration-300",
            positionClasses[position],
            className,
          )}
        >
          {content}
          <div
            className={cn(
              "absolute h-0 w-0 border-4",
              arrowPositionClasses[position],
            )}
          ></div>
        </div>
      )}
    </div>
  );
}
