import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  AUTH_RECOVERY_TTL_MS,
  beginAuthRecoveryRoundTrip,
  clearAuthRecovery,
  isAuthRecoveryInProgress,
  isAuthRecoveryPending,
  markAuthRecovery,
  resolveAuthRecovery,
} from '../auth-recovery-lock';

describe('auth-recovery-lock', () => {
  beforeEach(() => clearAuthRecovery());

  it('is not in progress until recovery is marked', () => {
    expect(isAuthRecoveryInProgress()).toBe(false);
  });

  it('suppresses concurrent 401s once marked', () => {
    const t = 1_000;
    expect(isAuthRecoveryInProgress(t)).toBe(false); // first 401 proceeds
    markAuthRecovery(t);
    expect(isAuthRecoveryInProgress(t)).toBe(true); // second 401 suppressed
    expect(isAuthRecoveryInProgress(t + 5_000)).toBe(true); // still within TTL
  });

  it('auto-expires after the TTL so a later 401 can retry', () => {
    markAuthRecovery(1_000);
    expect(isAuthRecoveryInProgress(1_000 + AUTH_RECOVERY_TTL_MS - 1)).toBe(
      true,
    );
    expect(isAuthRecoveryInProgress(1_000 + AUTH_RECOVERY_TTL_MS)).toBe(false);
  });

  it('clears on token receipt so the next expiry can recover again', () => {
    markAuthRecovery(1_000);
    expect(isAuthRecoveryInProgress(1_000)).toBe(true);
    clearAuthRecovery();
    expect(isAuthRecoveryInProgress(1_000)).toBe(false);
  });
});

describe('auth-recovery round-trip', () => {
  beforeEach(() => vi.useRealTimers());

  it('is not pending until a round-trip begins', () => {
    expect(isAuthRecoveryPending()).toBe(false);
  });

  it('resolves true when the host replies with tokens', async () => {
    const trip = beginAuthRecoveryRoundTrip(10_000);
    expect(isAuthRecoveryPending()).toBe(true);
    resolveAuthRecovery(true);
    expect(await trip).toBe(true);
    expect(isAuthRecoveryPending()).toBe(false);
  });

  it('times out to false when the host never replies', async () => {
    vi.useFakeTimers();
    const trip = beginAuthRecoveryRoundTrip(10_000);
    vi.advanceTimersByTime(10_000);
    expect(await trip).toBe(false);
    expect(isAuthRecoveryPending()).toBe(false);
  });

  it('is a no-op to resolve when nothing is pending', () => {
    expect(() => resolveAuthRecovery(true)).not.toThrow();
    expect(isAuthRecoveryPending()).toBe(false);
  });

  it('clears the timeout once resolved, so it cannot settle twice', async () => {
    vi.useFakeTimers();
    const trip = beginAuthRecoveryRoundTrip(10_000);
    resolveAuthRecovery(true);
    expect(await trip).toBe(true);
    vi.advanceTimersByTime(10_000); // the timeout must not fire now
    expect(isAuthRecoveryPending()).toBe(false);
  });
});
