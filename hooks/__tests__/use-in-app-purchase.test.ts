import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    // Simulate running inside a Tauri webview so the checker takes the invoke path.
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('exposes an isInAppPurchaseAllowed checker function', () => {
    const { isInAppPurchaseAllowed } = useInAppPurchase();

    expect(typeof isInAppPurchaseAllowed).toBe('function');
  });

  it('resolves false without invoking when not in a Tauri app', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

    const { isInAppPurchaseAllowed } = useInAppPurchase();

    await expect(isInAppPurchaseAllowed()).resolves.toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('invokes the allow_in_app_purchase Tauri command', async () => {
    mockInvoke.mockResolvedValue(true);

    const { isInAppPurchaseAllowed } = useInAppPurchase();
    await isInAppPurchaseAllowed();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      TAURI_COMMANDS.ALLOW_IN_APP_PURCHASE,
    );
  });

  it('resolves true when the command resolves true', async () => {
    mockInvoke.mockResolvedValue(true);

    const { isInAppPurchaseAllowed } = useInAppPurchase();

    await expect(isInAppPurchaseAllowed()).resolves.toBe(true);
  });

  it('resolves false when the command resolves false', async () => {
    mockInvoke.mockResolvedValue(false);

    const { isInAppPurchaseAllowed } = useInAppPurchase();

    await expect(isInAppPurchaseAllowed()).resolves.toBe(false);
  });

  it('resolves false when the Tauri command throws', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockInvoke.mockRejectedValue(new Error('Tauri command failed'));

    const { isInAppPurchaseAllowed } = useInAppPurchase();

    await expect(isInAppPurchaseAllowed()).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
