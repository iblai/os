/**
 * Global chunk load error recovery for Next.js.
 *
 * WebKit/Safari can fail to load dynamically-imported chunks when
 * a service worker is registering concurrently or when network timing
 * is tight. This module installs a global error handler that detects
 * ChunkLoadError and retries by reloading the page once.
 *
 * Call `setupChunkErrorRecovery()` early in the app lifecycle (e.g. in
 * a root layout or _app component).
 */

const RELOAD_KEY = "__chunk_reload";
const MAX_RELOADS = 2;

/**
 * Install a global handler that catches unhandled ChunkLoadError rejections
 * and reloads the page (up to MAX_RELOADS times) to recover.
 */
export function setupChunkErrorRecovery(): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: PromiseRejectionEvent) => {
    const error = event.reason;
    if (!isChunkLoadError(error)) return;

    console.warn(
      "[ChunkRetry] ChunkLoadError detected, attempting recovery…",
      error,
    );

    const reloadCount = getReloadCount();
    if (reloadCount < MAX_RELOADS) {
      setReloadCount(reloadCount + 1);
      // Prevent the error from surfacing to the console
      event.preventDefault();
      window.location.reload();
    } else {
      console.error(
        "[ChunkRetry] Max reload attempts reached. The chunk may be permanently unavailable.",
      );
      // Reset so future navigations can retry again
      clearReloadCount();
    }
  };

  // Also handle synchronous script errors (e.g. <script> tags that fail to load)
  const errorHandler = (event: ErrorEvent) => {
    if (!isChunkLoadError(event.error)) return;

    console.warn(
      "[ChunkRetry] ChunkLoadError (sync) detected, attempting recovery…",
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

  window.addEventListener("unhandledrejection", handler);
  window.addEventListener("error", errorHandler);

  // Clear reload counter on successful page load (chunks loaded fine)
  const loadHandler = () => {
    // Give chunks a moment to finish loading after the page 'load' event
    setTimeout(() => clearReloadCount(), 5000);
  };

  if (document.readyState === "complete") {
    setTimeout(() => clearReloadCount(), 5000);
  } else {
    window.addEventListener("load", loadHandler, { once: true });
  }

  return () => {
    window.removeEventListener("unhandledrejection", handler);
    window.removeEventListener("error", errorHandler);
    window.removeEventListener("load", loadHandler);
  };
}

function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; message?: string };
  return (
    e.name === "ChunkLoadError" ||
    (typeof e.message === "string" && e.message.includes("ChunkLoadError")) ||
    (typeof e.message === "string" && e.message.includes("Loading chunk"))
  );
}

function getReloadCount(): number {
  try {
    return parseInt(sessionStorage.getItem(RELOAD_KEY) || "0", 10);
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
