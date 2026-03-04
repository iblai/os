import Link from 'next/link';

import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { config } from '@/lib/config';

export function AppSyncBanner() {
  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="bg-[#F5F8FF] border border-[#D0E0FF] rounded-lg p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-[#D0E0FF] text-[#666768] text-xs font-medium px-2 py-0.5 rounded-md">
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
              className: 'text-blue-600 hover:text-blue-700 text-sm p-1 h-auto',
            })
          )}
        >
          {config.appBannerLinkText()}
          <ExternalLink className="h-3 w-3 ml-1" />
        </Link>
      </div>
    </div>
  );
}
