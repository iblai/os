import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useShowVoiceCall } from '@/hooks/use-show-voice-call';
import { Button } from '@/components/ui/button';

type Props = {
  isPreviewMode?: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export function VoiceCallButton({
  isPreviewMode,
  onClick,
  disabled = false,
}: Props) {
  const showVoiceCall = useShowVoiceCall();

  if (!showVoiceCall) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Button
            variant="ghost"
            size="icon"
            className="mr-3 flex h-9 w-9 items-center justify-center text-gray-400"
            onClick={onClick}
            disabled={disabled || isPreviewMode}
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="28"
              viewBox="0 -960 960 960"
              width="28"
              fill="currentColor"
              className="scale-125 text-gray-400"
            >
              <path d="M280-240v-480h80v480h-80ZM440-80v-800h80v800h-80ZM120-400v-160h80v160h-80Zm480 160v-480h80v480h-80Zm160-160v-160h80v160h-80Z" />
            </svg>
            <span className="sr-only">Voice call</span>
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content capitalize">
        Voice Call
      </TooltipContent>
    </Tooltip>
  );
}
