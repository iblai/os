'use client';

import Image from 'next/image';
import { Download, X, Check, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/**
 * Interaction states for an on-device (local) model row. The row is a single
 * click-toggle whose action depends on state: download → cancel → select.
 */
export type LocalRowStatus =
  | 'not-installed'
  | 'starting'
  | 'downloading'
  | 'installed'
  | 'selected'
  | 'error';

interface LocalModelRowProps {
  name: string;
  size: string;
  logo: string;
  status: LocalRowStatus;
  /** 0–100; meaningful while downloading. */
  progress: number;
  /** Another model is downloading, so this row can't start one. */
  disabled?: boolean;
  disabledReason?: string;
  errorMessage?: string;
  onActivate: () => void;
}

/**
 * A local (on-device) model presented in the same list as cloud models. It uses
 * the same provider logo as the cloud rows; the model name gets its own line and
 * the on-device badge, size, and download/status affordance sit on a subtitle
 * line beneath it. One click toggles download ⇄ cancel; once installed a click
 * selects it.
 */
export function LocalModelRow({
  name,
  size,
  logo,
  status,
  progress,
  disabled = false,
  disabledReason,
  errorMessage,
  onActivate,
}: LocalModelRowProps) {
  const t = useTranslations('modalsLlmProviderModal.localModel');
  const selected = status === 'selected';
  const downloading = status === 'downloading' || status === 'starting';
  // A resting row (nothing downloading) can still be disabled when another
  // model is pulling; a row that is itself downloading stays clickable (cancel).
  const isBusyDisabled = disabled && !downloading && !selected;
  const inert = isBusyDisabled || selected;
  const pct = Math.round(Math.max(0, Math.min(100, progress)));

  const ariaLabel = (() => {
    switch (status) {
      case 'not-installed':
        return t('ariaDownload', { modelName: name, modelSize: size });
      case 'starting':
        return t('ariaStarting', { modelName: name });
      case 'downloading':
        return t('ariaDownloading', { modelName: name, percent: pct });
      case 'installed':
        return t('ariaInstalled', { modelName: name });
      case 'selected':
        return t('ariaSelected', { modelName: name });
      case 'error':
        return errorMessage
          ? t('ariaErrorWithReason', { modelName: name, reason: errorMessage })
          : t('ariaError', { modelName: name });
    }
  })();

  return (
    <button
      type="button"
      disabled={inert}
      aria-label={ariaLabel}
      title={isBusyDisabled ? disabledReason : ariaLabel}
      onClick={() => {
        if (!inert) onActivate();
      }}
      className={cn(
        // `isolate` makes the button its own stacking context so the absolute
        // progress fill (z-0) layers above the button's background and below the
        // content (z-10) — without it the fill can render behind the background.
        'group relative isolate flex items-center gap-3 overflow-hidden rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'cursor-default border-blue-500 bg-blue-50'
          : isBusyDisabled
            ? 'cursor-not-allowed border-gray-200 opacity-60'
            : 'cursor-pointer border-gray-200 hover:border-blue-500 hover:bg-blue-50',
      )}
    >
      {/* Download progress: a card-tall, translucent bar filling left→right
          behind the row content. Static under prefers-reduced-motion. */}
      {downloading && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-blue-500/40 motion-safe:transition-[width] motion-safe:duration-300"
          // Minimum width so the bar is visible the moment a download starts
          // (progress 0 / "starting"), then tracks real progress.
          style={{ width: `${status === 'starting' ? 6 : Math.max(pct, 6)}%` }}
        />
      )}

      {/* Same logo treatment as cloud rows. */}
      <span className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
        <Image
          src={logo}
          alt=""
          aria-hidden="true"
          width={32}
          height={32}
          className={cn('h-full w-full object-contain', {
            grayscale: isBusyDisabled,
          })}
          loading="lazy"
        />
      </span>

      {/* Name on its own line; on-device · size · action sit on a line below. */}
      <span className="relative z-10 flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-sm font-medium text-[#646464] lowercase">
          {name}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
          <span className="flex-shrink-0 rounded bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-500">
            {t('onDevice')}
          </span>
          {status === 'not-installed' && (
            <>
              <span aria-hidden="true">·</span>
              <span>{size}</span>
              <Download className="h-4 w-4" aria-hidden="true" />
            </>
          )}
          {status === 'starting' && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t('starting')}</span>
            </>
          )}
          {status === 'downloading' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums group-hover:hidden group-focus-visible:hidden">
                {pct}%
              </span>
              <span className="hidden items-center gap-1 text-blue-600 group-hover:flex group-focus-visible:flex">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t('cancel')}
              </span>
            </>
          )}
          {/* Installed but not selected: no extra label. The absence of the
              size + download icon (present only on downloadable rows) signals
              the model is ready. */}
          {status === 'selected' && (
            <span className="flex items-center gap-1 text-blue-600">
              <Check className="h-4 w-4" aria-hidden="true" />
              {t('inUse')}
            </span>
          )}
          {status === 'error' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate text-red-500">
                {errorMessage || t('downloadFailedRetry')}
              </span>
              <RotateCcw
                className="h-4 w-4 flex-shrink-0 text-red-500"
                aria-hidden="true"
              />
            </>
          )}
        </span>
      </span>
    </button>
  );
}
