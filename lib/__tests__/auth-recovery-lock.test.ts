import { describe, it, expect, beforeEach } from 'vitest';

import {
  AUTH_RECOVERY_TTL_MS,
  clearAuthRecovery,
  isAuthRecoveryInProgress,
  markAuthRecovery,
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
