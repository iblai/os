'use client';

import { ArrowUp, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('chatSubmitMessageButton');
  const isDisabled =
    disabled ||
    (isPreviewMode && !allowAnonymousAccess) ||
    isUploading ||
    isConnecting;

  const getTooltipText = () => {
    if (isConnecting) return t('connectingEllipsis');
    if (isUploading) return t('uploadingFiles');
    return t('sendMessageTitle');
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Button
            type="submit"
            size="icon"
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              'h-9 w-9 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] hover:opacity-90',
              CSS_CLASS_NAMES.CHAT.SUBMIT_MESSAGE_BUTTON,
              (isUploading || isConnecting) && 'cursor-not-allowed opacity-50',
            )}
            disabled={isDisabled}
            aria-label={isConnecting ? t('connecting') : t('sendMessage')}
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
              {isConnecting ? t('connecting') : t('sendMessage')}
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
