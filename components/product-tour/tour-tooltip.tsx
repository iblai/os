'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import type { TooltipRenderProps } from 'react-joyride';

export const TOUR_TOOLTIP_TEST_ID = 'product-tour-tooltip';
export const TOUR_PROGRESS_TEST_ID = 'product-tour-progress';

/**
 * The tour's tooltip. Button labels come from the joyride locale through the
 * button props (`title`), which also carry the accessible names.
 */
export function TourTooltip({
  backProps,
  closeProps,
  controls,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  const t = useTranslations('productTour');

  // Joyride's own ESC handling is off (it would only close the step); make
  // ESC leave the tour, like the close button.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    controls.skip('button_close');
  };

  return (
    <div
      {...tooltipProps}
      onKeyDown={handleKeyDown}
      data-testid={TOUR_TOOLTIP_TEST_ID}
      data-step-id={step.id}
      className="w-[340px] max-w-[calc(100vw-2rem)] rounded-xl bg-white p-4 text-left text-gray-900 shadow-xl ring-1 ring-black/5"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {step.title ? (
            <p className="mb-1 text-sm font-semibold text-gray-900">
              {step.title}
            </p>
          ) : null}
          <div className="text-sm leading-relaxed text-gray-600">
            {step.content}
          </div>
        </div>
        <button
          type="button"
          {...closeProps}
          className="-mt-1 -mr-1 shrink-0 cursor-pointer rounded p-1 text-gray-400 transition-colors hover:text-gray-700 focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className="text-xs text-gray-500"
          data-testid={TOUR_PROGRESS_TEST_ID}
        >
          {t('progress', { current: index + 1, total: size })}
        </span>
        <div className="flex items-center gap-2">
          {!isLastStep && (
            <button
              type="button"
              {...skipProps}
              className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              {skipProps.title}
            </button>
          )}
          {index > 0 && (
            <button
              type="button"
              {...backProps}
              className="cursor-pointer rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              {backProps.title}
            </button>
          )}
          <button
            type="button"
            {...primaryProps}
            className="cursor-pointer rounded-md bg-[#2563EB] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 focus:outline-none"
          >
            {primaryProps.title}
          </button>
        </div>
      </div>
    </div>
  );
}
