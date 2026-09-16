'use client';

import { useEffect } from 'react';

import {
  isChunkLoadError,
  chunkReloadsExhausted,
  reloadForChunkError,
} from '@/lib/chunk-retry';

/**
 * Root-level error boundary. Catches errors thrown by the root layout itself —
 * including the initial chunk loads for the layout/providers — that `app/error.tsx`
 * cannot. Without this file Next renders its built-in, un-actionable
 * "Application error: a client-side exception has occurred" screen.
 *
 * For a ChunkLoadError we auto-reload up to the shared budget (a fresh page load
 * fetches HTML with current chunk hashes), then fall back to a recoverable page.
 * Kept dependency-minimal (no providers/UI kit) so it works even when the app's
 * own bundles are the thing that failed to load.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunk = isChunkLoadError(error);

  useEffect(() => {
    if (isChunk && reloadForChunkError()) return; // reloading; budget not spent
    console.error('Global error:', error);
  }, [isChunk, error]);

  // While an auto-reload is firing, show a blank-ish page (no error flash).
  const reloading = isChunk && !chunkReloadsExhausted();

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#0b0b0f',
          color: '#e7e7ea',
          padding: '24px',
        }}
      >
        {reloading ? (
          <p style={{ opacity: 0.7 }}>Loading…</p>
        ) : (
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
              {isChunk
                ? 'Couldn’t finish loading the app'
                : 'Something went wrong'}
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                opacity: 0.75,
                margin: '0 0 20px',
              }}
            >
              {isChunk
                ? 'This is usually a brief network hiccup or an update that just shipped. Reload to get the latest version.'
                : 'An unexpected error occurred. Reloading usually fixes it.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                appearance: 'none',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                background: '#2563eb',
                color: '#fff',
              }}
            >
              Reload
            </button>
          </div>
        )}
      </body>
    </html>
  );
}
