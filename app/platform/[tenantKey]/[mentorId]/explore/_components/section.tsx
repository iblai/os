'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';

// One grid for every explore section so cards line up across sections.
// Section page sizes are multiples of 6 so rows fill at 2 and 3 columns.
export const MENTOR_GRID_CLASSNAME =
  'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3';

interface SectionHeaderProps {
  /** Heading id, so the enclosing `<section>` can be `aria-labelledby` it. */
  id?: string;
  title: string;
  description?: string;
  count?: number;
  action?: React.ReactNode;
}

export function SectionHeader({
  id,
  title,
  description,
  count,
  action,
}: SectionHeaderProps) {
  const t = useTranslations('exploreSection');

  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2
            id={id}
            className="text-base font-semibold text-gray-900 md:text-lg"
          >
            {title}
          </h2>
          {typeof count === 'number' && count > 0 && (
            <>
              <span
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums"
                aria-hidden="true"
              >
                {count}
              </span>
              <span className="sr-only">{t('countAriaLabel', { count })}</span>
            </>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-gray-600">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function MentorGridSkeleton({
  count = 6,
  label,
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={MENTOR_GRID_CLASSNAME}
      data-testid="mentor-grid-skeleton"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex min-h-[148px] flex-col rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-gray-100" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-2/3 bg-gray-100" />
              <Skeleton className="h-3 w-1/4 bg-gray-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full bg-gray-100" />
            <Skeleton className="h-3 w-4/5 bg-gray-100" />
          </div>
        </div>
      ))}
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
