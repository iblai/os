import { CircleStop, Loader2, Mic } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useShowVoiceRecorder } from '@/hooks/use-show-voice-recorder';

type IconProps = {
  processing: boolean;
  recording: boolean;
};

function Icon({ processing, recording }: IconProps) {
  if (processing) {
    return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
  }
  if (recording) {
    return <CircleStop className="w- h-6" />;
  }
  return <Mic className="h-6 w-6 text-gray-400" />;
}

type Props = {
  isPreviewMode?: boolean;
  handleMicrophoneBtnClick: () => void;
  disabled?: boolean;
} & IconProps;

export function VoiceChatButton({
  isPreviewMode,
  handleMicrophoneBtnClick,
  processing,
  recording,
  disabled = false,
}: Props) {
  const showVoiceRecorder = useShowVoiceRecorder();

  if (!showVoiceRecorder) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-400"
            disabled={disabled || isPreviewMode || processing}
            type="button"
            aria-label={
              processing
                ? 'Processing voice input'
                : recording
                  ? 'Stop voice input'
                  : 'Voice input'
            }
            onClick={handleMicrophoneBtnClick}
          >
            <Icon processing={processing} recording={recording} />
            <span className="sr-only">Voice input</span>
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content capitalize">
        Voice Record
      </TooltipContent>
    </Tooltip>
  );
}
