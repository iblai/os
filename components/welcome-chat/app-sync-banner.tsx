import Link from 'next/link';

import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { config } from '@/lib/config';

export function AppSyncBanner() {
  return (
    <div className="mx-auto mb-8 w-full max-w-md">
      <div className="flex items-center justify-between rounded-lg border border-[#D0E0FF] bg-[#F5F8FF] p-2">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#D0E0FF] px-2 py-0.5 text-xs font-medium text-[#666768]">
            {config.appBannerBadge()}
          </span>
          <span className="text-sm font-medium text-gray-900">
            {config.appBannerText()}
          </span>
        </div>
        <Link
          href={config.appBannerLink()}
          target="_blank"
          className={cn(
            buttonVariants({
              variant: 'ghost',
              size: 'sm',
              className: 'h-auto p-1 text-sm text-blue-600 hover:text-blue-700',
            }),
          )}
        >
          {config.appBannerLinkText()}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
