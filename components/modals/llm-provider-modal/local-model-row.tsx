'use client';

import React from 'react';
import Image from 'next/image';
import { Download, X, Check, RotateCcw } from 'lucide-react';
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

const RING_SIZE = 32;
const RING_STROKE = 3;

/**
 * Determinate progress ring drawn around the model logo. The fill transition is
 * gated behind `motion-safe` so it stays static under prefers-reduced-motion.
 */
function ProgressRing({
  value,
  children,
}: {
  value: number;
  children: React.ReactNode;
}) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-gray-200"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-blue-500 motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300"
        />
      </svg>
      {/* Slightly inset logo so the ring reads clearly around it. */}
      <span className="relative flex h-6 w-6 items-center justify-center">
        {children}
      </span>
    </span>
  );
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
        return `Download ${name}, ${size}, on-device model`;
      case 'starting':
        return `Starting download of ${name}`;
      case 'downloading':
        return `Cancel download of ${name}, ${pct} percent`;
      case 'installed':
        return `Use ${name}, on-device model`;
      case 'selected':
        return `Selected ${name}, on-device model, in use`;
      case 'error':
        return `Retry download of ${name}${errorMessage ? `, ${errorMessage}` : ''}`;
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
        'group flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'cursor-default border-blue-500 bg-blue-50'
          : isBusyDisabled
            ? 'cursor-not-allowed border-gray-200 opacity-60'
            : 'cursor-pointer border-gray-200 hover:border-blue-500 hover:bg-blue-50',
      )}
    >
      {/* Same logo treatment as cloud rows; ringed with progress while downloading. */}
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {downloading ? (
          <ProgressRing value={status === 'starting' ? 0 : progress}>
            <Image
              src={logo}
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
              loading="lazy"
            />
          </ProgressRing>
        ) : (
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
        )}
      </span>

      {/* Name on its own line; on-device · size · action sit on a line below. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-sm font-medium lowercase text-[#646464]">
          {name}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
          <span className="flex-shrink-0 rounded bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-500">
            On-device
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
              <span>Starting…</span>
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
                Cancel
              </span>
            </>
          )}
          {status === 'installed' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-gray-400">Use</span>
            </>
          )}
          {status === 'selected' && (
            <span className="flex items-center gap-1 text-blue-600">
              <Check className="h-4 w-4" aria-hidden="true" />
              In use
            </span>
          )}
          {status === 'error' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate text-red-500">
                {errorMessage || 'Download failed — retry'}
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
