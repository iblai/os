"use client";

import { ScreenShare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, isSafariBrowser } from "@/lib/utils";

type Props = {
  onClick: () => void;
  isScreenSharingModalOpen: boolean;
  screenSharing: boolean;
  isPreviewMode?: boolean;
  disabled?: boolean;
};

export function ScreenSharingButton({
  onClick,
  isScreenSharingModalOpen,
  screenSharing,
  isPreviewMode,
  disabled = false,
}: Props) {
  function dynamicTooltipContent() {
    if (isScreenSharingModalOpen) {
      return "Screen Sharing";
    }
    return "Enable Screen Sharing";
  }

  if (
    !screenSharing ||
    !navigator.mediaDevices?.getDisplayMedia ||
    isSafariBrowser()
  ) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className={cn(
              "h-9 w-9 text-gray-400",
              isScreenSharingModalOpen && "ibl-button-primary",
            )}
            disabled={disabled || isPreviewMode}
            onClick={onClick}
            aria-label="Screen Sharing"
          >
            <ScreenShare
              className={cn("h-6 w-6 text-gray-400", {
                "text-white": isScreenSharingModalOpen,
              })}
            />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content capitalize">
        {dynamicTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}
