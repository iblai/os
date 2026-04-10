/**
 * Global chunk load error recovery for Next.js.
 *
 * Two layers of defense:
 *
 * 1. **Webpack-level retry** – patches the webpack chunk loader so that
 *    every failed `import()` / `next/dynamic` call is retried up to
 *    MAX_CHUNK_RETRIES times with exponential back-off *before* the
 *    error surfaces to React error boundaries.
 *
 * 2. **Page-reload fallback** – if a ChunkLoadError still reaches
 *    the global `unhandledrejection` / `error` handlers (e.g. a <script>
 *    tag that fails), the page is reloaded up to MAX_RELOADS times
 *    to fetch fresh HTML with correct chunk hashes.
 *
 * Call `setupChunkErrorRecovery()` early in the app lifecycle.
 */

const RELOAD_KEY = '__chunk_reload';
const MAX_RELOADS = 2;
const MAX_CHUNK_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Layer 1: Webpack chunk-loader monkey-patch
// ---------------------------------------------------------------------------

/**
 * Patch webpack's internal chunk loading so that each chunk fetch is
 * retried transparently.  Works with both webpack 4 (`__webpack_require__.e`)
 * and webpack 5 / Next.js (`__webpack_chunk_load__`).
 *
 * Returns a cleanup function that restores the originals.
 */
function patchWebpackChunkLoading(): () => void {
  if (typeof window === 'undefined') return () => {};

  const g = window as any;
  const cleanups: Array<() => void> = [];

  // Wrap a chunk-loader function with retry logic
  function wrapWithRetry(
    original: (chunkId: string) => Promise<unknown>,
    label: string,
  ): (chunkId: string) => Promise<unknown> {
    return function loadChunkWithRetry(chunkId: string): Promise<unknown> {
      return retryPromise(
        () => original(chunkId),
        MAX_CHUNK_RETRIES,
        (attempt) => {
          console.warn(
            `[ChunkRetry] ${label} retry ${attempt}/${MAX_CHUNK_RETRIES} for chunk "${chunkId}"`,
          );
        },
      );
    };
  }

  // Patch __webpack_chunk_load__ (Next.js / webpack 5)
  if (typeof g.__webpack_chunk_load__ === 'function') {
    const orig = g.__webpack_chunk_load__;
    g.__webpack_chunk_load__ = wrapWithRetry(orig, '__webpack_chunk_load__');
    cleanups.push(() => {
      g.__webpack_chunk_load__ = orig;
    });
  }

  // Patch __webpack_require__.e (webpack 4 / 5 ensure-chunk)
  if (
    g.__webpack_require__?.e &&
    typeof g.__webpack_require__.e === 'function'
  ) {
    const orig = g.__webpack_require__.e;
    g.__webpack_require__.e = wrapWithRetry(orig, '__webpack_require__.e');
    cleanups.push(() => {
      g.__webpack_require__.e = orig;
    });
  }

  return () => cleanups.forEach((fn) => fn());
}

/**
 * Retry a promise-returning function with exponential back-off.
 * Only retries on ChunkLoadError / network-style failures.
 */
function retryPromise(
  fn: () => Promise<unknown>,
  maxRetries: number,
  onRetry?: (attempt: number) => void,
): Promise<unknown> {
  return fn().catch((error: unknown) => {
    if (!isChunkLoadError(error) || maxRetries <= 0) {
      throw error;
    }
    onRetry?.(MAX_CHUNK_RETRIES - maxRetries + 1);
    const delay =
      RETRY_BASE_DELAY_MS * Math.pow(2, MAX_CHUNK_RETRIES - maxRetries);
    return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
      retryPromise(fn, maxRetries - 1, onRetry),
    );
  });
}

// ---------------------------------------------------------------------------
// Layer 2: Global error handlers → page reload
// ---------------------------------------------------------------------------

/**
 * Install both layers of chunk error recovery.
 * Returns a cleanup function.
 */
export function setupChunkErrorRecovery(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Layer 1 — webpack-level retry
  const restoreWebpack = patchWebpackChunkLoading();

  // Layer 2 — global handlers → page reload as last resort
  const handler = (event: PromiseRejectionEvent) => {
    const error = event.reason;
    if (!isChunkLoadError(error)) return;

    console.warn(
      '[ChunkRetry] ChunkLoadError reached global handler, attempting page reload…',
      error,
    );

    const reloadCount = getReloadCount();
    if (reloadCount < MAX_RELOADS) {
      setReloadCount(reloadCount + 1);
      event.preventDefault();
      window.location.reload();
    } else {
      console.error(
        '[ChunkRetry] Max reload attempts reached. The chunk may be permanently unavailable.',
      );
      clearReloadCount();
    }
  };

  const errorHandler = (event: ErrorEvent) => {
    if (!isChunkLoadError(event.error)) return;

    console.warn(
      '[ChunkRetry] ChunkLoadError (sync) reached global handler, attempting page reload…',
    );

    const reloadCount = getReloadCount();
    if (reloadCount < MAX_RELOADS) {
      setReloadCount(reloadCount + 1);
      event.preventDefault();
      window.location.reload();
    } else {
      clearReloadCount();
    }
  };

  window.addEventListener('unhandledrejection', handler);
  window.addEventListener('error', errorHandler);

  // Clear reload counter on successful page load (chunks loaded fine)
  const loadHandler = () => {
    setTimeout(() => clearReloadCount(), 5000);
  };

  if (document.readyState === 'complete') {
    setTimeout(() => clearReloadCount(), 5000);
  } else {
    window.addEventListener('load', loadHandler, { once: true });
  }

  return () => {
    restoreWebpack();
    window.removeEventListener('unhandledrejection', handler);
    window.removeEventListener('error', errorHandler);
    window.removeEventListener('load', loadHandler);
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string };
  return (
    e.name === 'ChunkLoadError' ||
    (typeof e.message === 'string' && e.message.includes('ChunkLoadError')) ||
    (typeof e.message === 'string' && e.message.includes('Loading chunk'))
  );
}

function getReloadCount(): number {
  try {
    return parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function setReloadCount(count: number): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(count));
  } catch {
    // sessionStorage may not be available
  }
}

function clearReloadCount(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // sessionStorage may not be available
  }
}
