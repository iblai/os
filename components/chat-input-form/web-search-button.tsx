import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TOOLS } from '@iblai/iblai-js/web-utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  enableWebBrowsing: boolean;
  activeTools: string[];
  isPreviewMode?: boolean;
  updateSessionTools: (tool: string) => Promise<void>;
};

export function WebSearchButton({
  enableWebBrowsing,
  activeTools,
  isPreviewMode,
  updateSessionTools,
}: Props) {
  const t = useTranslations('chatInputFormWebSearchButton');
  const userHasActivatedWebSearch = activeTools.includes(TOOLS.WEB_SEARCH);

  function dynamicTooltipContent() {
    if (!enableWebBrowsing) {
      return t('webSearchDisabled');
    }
    if (userHasActivatedWebSearch) {
      return t('webSearchEnabled');
    }
    return t('webSearchDisabled');
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 text-gray-400', {
              'cursor-not-allowed text-gray-300 opacity-50': !enableWebBrowsing,
              'ibl-button-primary': userHasActivatedWebSearch,
            })}
            type="button"
            disabled={!enableWebBrowsing || isPreviewMode}
            onClick={async () => {
              await updateSessionTools(TOOLS.WEB_SEARCH);
            }}
          >
            <Globe
              className={cn('h-6 w-6 text-gray-400', {
                'text-white': userHasActivatedWebSearch,
              })}
            />
            <span className="sr-only">{dynamicTooltipContent()}</span>
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content capitalize">
        {dynamicTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}
