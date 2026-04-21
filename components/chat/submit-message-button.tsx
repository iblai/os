import { ArrowUp, Loader2 } from 'lucide-react';

import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CSS_CLASS_NAMES } from '@/lib/constants';

type Props = {
  isPreviewMode?: boolean;
  allowAnonymousAccess?: boolean;
  isUploading?: boolean;
  disabled?: boolean;
  isConnecting?: boolean;
};

export function SubmitMessageButton({
  isPreviewMode,
  allowAnonymousAccess,
  isUploading,
  disabled = false,
  isConnecting = false,
}: Props) {
  const isDisabled =
    disabled ||
    (isPreviewMode && !allowAnonymousAccess) ||
    isUploading ||
    isConnecting;

  const getTooltipText = () => {
    if (isConnecting) return 'Connecting...';
    if (isUploading) return 'Uploading Files';
    return 'Send Message';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Button
            type="submit"
            size="icon"
            className={cn(
              'h-9 w-9 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] hover:opacity-90',
              CSS_CLASS_NAMES.CHAT.SUBMIT_MESSAGE_BUTTON,
              (isUploading || isConnecting) && 'cursor-not-allowed opacity-50',
            )}
            disabled={isDisabled}
            aria-label={isConnecting ? 'Connecting' : 'Send message'}
          >
            {isConnecting ? (
              <Loader2
                className="h-5 w-5 animate-spin text-white"
                aria-hidden="true"
              />
            ) : (
              <ArrowUp className="h-5 w-5 text-white" aria-hidden="true" />
            )}
            <span className="sr-only">
              {isConnecting ? 'Connecting' : 'Send message'}
            </span>
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content capitalize">
        {getTooltipText()}
      </TooltipContent>
    </Tooltip>
  );
}
