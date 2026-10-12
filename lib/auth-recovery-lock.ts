// Single-flight guard for auth recovery after a 401.
//
// When several API requests 401 at once, each would otherwise run the 401
// handler — redirecting to the auth SPA, or (when iframed) posting `authExpired`
// to the host — so the host mints a new session once per request and the embed
// recovers N times. This lock lets only the FIRST 401 in a burst start recovery;
// the rest are suppressed until recovery finishes (new tokens arrive, which calls
// `clearAuthRecovery`) or the TTL lapses.
//
// The TTL is a failsafe: if recovery never completes (no tokens come back, no
// reload), the lock auto-expires so a later 401 can try again instead of the
// embed being stuck unauthenticated forever. It is module-level because a 401
// burst happens within one document; cross-tab coordination is not needed.

export const AUTH_RECOVERY_TTL_MS = 15_000;

let startedAt = 0;

/** True while a recovery started within the TTL window is still considered active. */
export function isAuthRecoveryInProgress(now: number = Date.now()): boolean {
  return startedAt > 0 && now - startedAt < AUTH_RECOVERY_TTL_MS;
}

/** Mark recovery as started (call right before triggering the 401 handler's redirect/post). */
export function markAuthRecovery(now: number = Date.now()): void {
  startedAt = now;
}

/** Release the lock — call when new tokens are installed, so a later expiry can recover. */
export function clearAuthRecovery(): void {
  startedAt = 0;
}

// --- Iframe refresh round-trip -----------------------------------------------
//
// When embedded, the data layer's `refreshAuthToken` recovers by asking the host
// for fresh tokens (`authExpired`) and awaiting the reply, instead of reloading.
// The data layer AWAITS the returned promise and replays the failed request, so
// a successful round-trip recovers with no page reload. The caller posts the
// message; this only coordinates the wait (and the timeout failsafe) so the
// module stays dependency-free and unit-testable.

export const AUTH_RECOVERY_ROUND_TRIP_TIMEOUT_MS = 10_000;

let pendingResolve: ((ok: boolean) => void) | null = null;

/** True while an iframe refresh round-trip is awaiting the host's token reply. */
export function isAuthRecoveryPending(): boolean {
  return pendingResolve !== null;
}

/**
 * Await the host's token reply. Resolves `true` when `resolveAuthRecovery(true)`
 * is called (new tokens installed) or `false` after the timeout, so a host that
 * never answers falls back to the redirect rather than hanging the request.
 */
export function beginAuthRecoveryRoundTrip(
  timeoutMs: number = AUTH_RECOVERY_ROUND_TRIP_TIMEOUT_MS,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const settle = (ok: boolean) => {
      if (pendingResolve !== settle) return; // superseded or already settled
      pendingResolve = null;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => settle(false), timeoutMs);
    pendingResolve = settle;
  });
}

/** Settle a pending round-trip — call when tokens arrive (true) from the host. */
export function resolveAuthRecovery(ok: boolean): void {
  pendingResolve?.(ok);
}
