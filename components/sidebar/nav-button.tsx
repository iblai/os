import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  onClick: () => void;
  isActive?: boolean;
  isNewMentorButton?: boolean;
  sidebarExpanded?: boolean;
  tooltip?: string;
  isNavigationButton?: boolean;
  isVisible?: boolean;
}

export function NavButton({
  icon,
  label,
  expanded,
  onClick,
  isActive,
  tooltip,
  isVisible = true,
}: NavButtonProps) {
  const buttonContent = (
    <Button
      variant="ghost"
      size={expanded ? undefined : "icon"}
      className={cn(
        "flex items-center hover:bg-[#c9d8f8]",
        expanded ? "h-8 w-full justify-start px-3" : "h-8 w-8 justify-center",
        isActive && "bg-blue-50",
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "text-gray-500",
          isActive && "text-blue-600",
          !expanded && "mx-auto", // Center the icon when collapsed
        )}
      >
        {icon}
      </span>
      {expanded && (
        <span
          className={cn(
            "ml-2 text-sm text-gray-700",
            isActive && "font-medium text-blue-600",
          )}
        >
          {label}
        </span>
      )}
    </Button>
  );

  if (!isVisible) return null;

  if (!expanded && tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent className="ibl-tooltip-content" side="right">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonContent;
}
