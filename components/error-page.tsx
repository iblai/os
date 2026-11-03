'use client';

import { cn } from '@/lib/utils';

export interface ErrorPageProps {
  errorCode?: string;
  customTitle?: string;
  customDescription?: string;
  supportEmail?: string | null;
  showReset?: boolean;
  reset?: () => void;
  className?: string;
}

/**
 * Lightweight, self-contained error/404 page.
 *
 * Deliberately avoids the SDK's `ErrorPage` (from `@iblai/iblai-js/web-containers`)
 * because that import pulls the entire ~13 MB web-containers barrel — charts,
 * PDF, editor and all — onto a page whose only job is to say "something broke".
 * It is also the page shown when a chunk fails to load, so it must not itself
 * depend on a heavy chunk that may be the very thing that failed.
 */
export function ErrorPage({
  errorCode,
  customTitle,
  customDescription,
  supportEmail,
  showReset = false,
  reset,
  className,
}: ErrorPageProps) {
  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center',
        className,
      )}
    >
      {errorCode ? (
        <p className="text-muted-foreground text-sm font-semibold tracking-widest">
          {errorCode}
        </p>
      ) : null}
      {customTitle ? (
        <h1 className="text-foreground text-2xl font-semibold">
          {customTitle}
        </h1>
      ) : null}
      {customDescription ? (
        <p className="text-muted-foreground max-w-md text-sm">
          {customDescription}
        </p>
      ) : null}
      {showReset && reset ? (
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-foreground mt-2 rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90"
        >
          Try again
        </button>
      ) : null}
      {supportEmail ? (
        <a
          href={`mailto:${supportEmail}`}
          className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
        >
          Contact support
        </a>
      ) : null}
    </div>
  );
}

export default ErrorPage;
