import { forwardRef } from 'react';
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

export const StopStreamingButton = forwardRef<HTMLButtonElement, Props>(
  function StopStreamingButton({ stopGenerating }, ref) {
    return (
      <Tooltip>
        <TooltipTrigger
          asChild
          // Only suppress the tooltip when focus is NOT from the keyboard —
          // i.e. the submit button swaps into the stop button mid-typing and
          // this element inherits focus, or JS calls .focus(). Keyboard Tab
          // navigation (:focus-visible) still opens the tooltip normally.
          // See issue #576.
          onFocus={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.matches(':focus-visible') === false) {
              e.preventDefault();
            }
          }}
        >
          <div>
            <Button
              ref={ref}
              type="button"
              size="icon"
              className={cn(
                'h-9 w-9 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] hover:opacity-90',
                CSS_CLASS_NAMES.CHAT.STOP_STREAMING_BUTTON,
              )}
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
  },
);
