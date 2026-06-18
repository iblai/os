import { CircleStop } from 'lucide-react';

import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CSS_CLASS_NAMES } from '@/lib/constants';

type Props = {
  stopGenerating: () => void;
};

export function StopStreamingButton({ stopGenerating }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Button
            type="button"
            size="icon"
            className={cn(
              'h-9 w-9 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] hover:opacity-90',
              CSS_CLASS_NAMES.CHAT.STOP_STREAMING_BUTTON,
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={stopGenerating}
          >
            <CircleStop className="h-5 w-5 text-white" />
            <span className="sr-only">Stop streaming</span>
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content capitalize">
        Stop Streaming
      </TooltipContent>
    </Tooltip>
  );
}
