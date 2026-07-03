import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Tauri core `invoke` before importing the hook so the call is
// intercepted instead of hitting the throwing test-environment mock aliased
// in vitest.config.ts. `vi.hoisted` keeps the spy defined before the hoisted
// `vi.mock` factory runs.
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

import { useInAppPurchase } from '../use-in-app-purchase';
import { TAURI_COMMANDS } from '@/types/tauri';

describe('useInAppPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes the allow_in_app_purchase Tauri command', async () => {
    mockInvoke.mockResolvedValue(true);

    await useInAppPurchase();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      TAURI_COMMANDS.ALLOW_IN_APP_PURCHASE,
    );
  });

  it('returns allowed: true when the command resolves true', async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await useInAppPurchase();

    expect(result).toEqual({ allowed: true });
  });

  it('returns allowed: false when the command resolves false', async () => {
    mockInvoke.mockResolvedValue(false);

    const result = await useInAppPurchase();

    expect(result).toEqual({ allowed: false });
  });

  it('passes through the exact boolean returned by the command', async () => {
    mockInvoke.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(useInAppPurchase()).resolves.toEqual({ allowed: false });
    await expect(useInAppPurchase()).resolves.toEqual({ allowed: true });
  });

  it('propagates errors thrown by the Tauri command', async () => {
    const error = new Error('Tauri command failed');
    mockInvoke.mockRejectedValue(error);

    await expect(useInAppPurchase()).rejects.toThrow('Tauri command failed');
  });
});
