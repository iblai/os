'use client';

import { Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/**
 * Jumps from this agent's analytics to the tenant-wide section
 * (`/platform/{tenantKey}/analytics`), keeping whatever tab is open.
 *
 * Retracted to an icon so it can float over the centre of the tab strip
 * without stealing room from it, and prolongs to reveal its label on hover or
 * keyboard focus. The label animates through a 0fr→1fr grid column rather than
 * a width, so it never needs a hard-coded pixel size per translation.
 */
export function AnalyticsScopeSwitch({
  tenantKey,
  tab = '',
  className,
}: {
  tenantKey: string;
  /** Analytics tab to stay on, e.g. `users`. Empty for the overview. */
  tab?: string;
  className?: string;
}) {
  const router = useRouter();
  const t = useTranslations('analyticsScopeSwitch');

  const label = t('platformAnalytics');
  const description = t('switchToPlatformAnalytics');

  return (
    <button
      type="button"
      onClick={() =>
        router.push(`/platform/${tenantKey}/analytics${tab ? `/${tab}` : ''}`)
      }
      aria-label={description}
      title={description}
      className={cn(
        'group flex h-9 max-w-full items-center rounded-full border border-gray-200 bg-white px-2.5',
        'text-sm font-medium text-gray-600 shadow-sm transition-colors',
        'hover:border-blue-200 hover:text-blue-600',
        'focus-visible:ring-ring focus-visible:ring-offset-background cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span
        className={cn(
          'grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out',
          'group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr]',
        )}
      >
        <span className="overflow-hidden">
          <span className="block pl-1.5 whitespace-nowrap">{label}</span>
        </span>
      </span>
    </button>
  );
}
