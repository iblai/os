import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOpencode402, wasRecent402 } from '../use-opencode-402';

/**
 * A Code-turn 402 must produce normal chat's credit UX: the proxy's
 * `opencode:payment-required` event lands in handle402Error, with the Stripe
 * pricing table backfilled from the billing query when the 402 body lacks it,
 * one UX per retry burst, and the generic-toast suppression flag raised.
 */

const { listen, fireEvent, handle402Error, fetchBilling, inTauri } = vi.hoisted(
  () => {
    let handler: ((evt: { payload: unknown }) => void) | undefined;
    return {
      listen: vi.fn(
        async (_event: string, cb: (evt: { payload: unknown }) => void) => {
          handler = cb;
          return () => {
            handler = undefined;
          };
        },
      ),
      fireEvent: (payload: unknown) => handler?.({ payload }),
      handle402Error: vi.fn(async () => {}),
      fetchBilling: vi.fn(),
      inTauri: { current: true },
    };
  },
);

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) =>
    (listen as (...a: unknown[]) => unknown)(...args),
}));
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => inTauri.current,
}));
vi.mock('@/hooks/subscription/use-402-error-check', () => ({
  use402ErrorCheck: () => ({ handle402Error }),
}));
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetAccountBillingInfoQuery: () => [fetchBilling],
}));

const PRICING_TABLE = {
  pricing_table_id: 'prctbl_1',
  publishable_key: 'pk_live_1',
  client_reference_id: 'ref-1',
  pricing_table_js: 'https://js.stripe.com/v3/pricing-table.js',
};

// The module keeps a shared "recent 402" timestamp; step a mocked clock a
// minute per test so every test starts outside the suppression window.
let now = 1_000_000_000;

describe('useOpencode402', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    inTauri.current = true;
    now += 60_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    fetchBilling.mockReturnValue({
      unwrap: async () => ({ pricing_table: PRICING_TABLE }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('feeds a 402 that already carries the pricing table straight to handle402Error', async () => {
    renderHook(() => useOpencode402());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    const payload = {
      error: 'Payment required',
      status_code: 402,
      pricing_table: PRICING_TABLE,
    };
    fireEvent(payload);

    await waitFor(() => expect(handle402Error).toHaveBeenCalledWith(payload));
    expect(fetchBilling).not.toHaveBeenCalled();
  });

  it('backfills the pricing table from the billing query when the body lacks it', async () => {
    localStorage.setItem('tenant', 'acme');
    renderHook(() => useOpencode402());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    fireEvent({ error: 'Payment required', status_code: 402 });

    await waitFor(() =>
      expect(handle402Error).toHaveBeenCalledWith({
        error: 'Payment required',
        status_code: 402,
        pricing_table: PRICING_TABLE,
      }),
    );
    // Cache-first: the second arg asks RTK to prefer the cached value.
    expect(fetchBilling).toHaveBeenCalledWith({ platform_key: 'acme' }, true);
  });

  it('still shows the credit UX when the billing query fails', async () => {
    localStorage.setItem('tenant', 'acme');
    fetchBilling.mockReturnValue({
      unwrap: async () => {
        throw new Error('billing down');
      },
    });
    renderHook(() => useOpencode402());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    fireEvent({ error: 'Payment required' });

    await waitFor(() =>
      expect(handle402Error).toHaveBeenCalledWith({
        error: 'Payment required',
      }),
    );
  });

  it('skips the billing query without a tenant and handles an empty payload', async () => {
    renderHook(() => useOpencode402());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    fireEvent(null);

    await waitFor(() => expect(handle402Error).toHaveBeenCalledWith({}));
    expect(fetchBilling).not.toHaveBeenCalled();
  });

  it('collapses a retry burst into one credit UX', async () => {
    renderHook(() => useOpencode402());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    fireEvent({ error: 'Payment required', pricing_table: PRICING_TABLE });
    now += 2_000; // opencode retries a moment later
    fireEvent({ error: 'Payment required', pricing_table: PRICING_TABLE });

    await waitFor(() => expect(handle402Error).toHaveBeenCalled());
    expect(handle402Error).toHaveBeenCalledTimes(1);
  });

  it('raises the suppression flag for the turn failure, then lets it lapse', async () => {
    renderHook(() => useOpencode402());
    await waitFor(() => expect(listen).toHaveBeenCalled());
    expect(wasRecent402()).toBe(false);

    fireEvent({ error: 'Payment required', pricing_table: PRICING_TABLE });
    await waitFor(() => expect(handle402Error).toHaveBeenCalled());

    expect(wasRecent402()).toBe(true); // the generic toast stays quiet
    now += 11_000;
    expect(wasRecent402()).toBe(false); // later errors surface normally
  });

  it('registers nothing outside the desktop app', async () => {
    inTauri.current = false;
    renderHook(() => useOpencode402());

    await new Promise((r) => setTimeout(r, 0));
    expect(listen).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useOpencode402());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    unmount();
    fireEvent({ error: 'Payment required', pricing_table: PRICING_TABLE });

    await new Promise((r) => setTimeout(r, 0));
    expect(handle402Error).not.toHaveBeenCalled();
  });
});
