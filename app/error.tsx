'use client';

import { useEffect } from 'react';

import { config } from '@/lib/config';
import { ErrorPage } from '@iblai/iblai-js/web-containers/next';
import {
  isChunkLoadError,
  chunkReloadsExhausted,
  reloadForChunkError,
} from '@/lib/chunk-retry';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunk = isChunkLoadError(error);

  useEffect(() => {
    if (isChunk) {
      // A chunk that failed to load won't recover via React reset() — only a
      // fresh page load fetches HTML with current chunk hashes. Auto-reload up
      // to the shared budget; when spent, reloadForChunkError() no-ops and we
      // fall through to the recoverable UI below.
      reloadForChunkError();
      return;
    }
    console.error('Root page error:', error);
  }, [isChunk, error]);

  // Chunk error, still within budget → a reload is firing; render nothing to
  // avoid flashing the error page before navigation.
  if (isChunk && !chunkReloadsExhausted()) return null;

  // Chunk error, budget spent → recoverable "please reload" page (reset() is
  // useless here, so the button does a hard reload).
  if (isChunk) {
    return (
      <ErrorPage
        errorCode="503"
        customTitle="Couldn’t finish loading the app"
        customDescription="This is usually a brief network hiccup or an update that just shipped. Reload to get the latest version."
        supportEmail={config.supportEmail()}
        showReset={true}
        reset={() => window.location.reload()}
      />
    );
  }

  // Non-chunk errors → generic error page.
  return (
    <ErrorPage
      errorCode="500"
      customTitle="Something went wrong!"
      customDescription="An unexpected error occurred"
      supportEmail={config.supportEmail()}
      showReset={true}
      reset={reset}
    />
  );
}
