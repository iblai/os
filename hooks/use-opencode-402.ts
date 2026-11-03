'use client';

import { useCallback, useEffect } from 'react';
import { useLazyGetAccountBillingInfoQuery } from '@iblai/iblai-js/data-layer';
import type { Error402MessageData } from '@iblai/iblai-js/web-utils';
import { getAuthItem } from '@/lib/auth-storage';
import { use402ErrorCheck } from '@/hooks/subscription/use-402-error-check';
import { isTauriApp } from '@/types/tauri';

/**
 * How long after a Code-turn 402 the generic chat error toast stays suppressed,
 * and repeat 402 events are treated as the same burst. The turn's own failure
 * (which fires the generic errorHandler, twice) arrives within moments of the
 * proxy's 402 event; opencode's model-call retries land within seconds.
 */
// ponytail: one flat window covers both dedupe and suppression; split them if a
// slow turn ever outlives it.
const RECENT_402_WINDOW_MS = 10_000;

let last402At = 0;

/**
 * True when a Code-turn 402 was handled moments ago. The chat's generic
 * errorHandler consults this to skip its support toast for the same failure —
 * mirroring normal chat, which returns before its errorHandler on 402.
 */
export function wasRecent402(): boolean {
  return Date.now() - last402At < RECENT_402_WINDOW_MS;
}

/**
 * Desktop only: react to `opencode:payment-required` from the Rust model proxy
 * (upstream answered 402 on a Code-mode model call) with the SAME UX as normal
 * chat — insufficient-balance toast, then upgrade dialog / billing redirect /
 * contact-admin banner via handle402Error. The compat endpoint's 402 body may
 * lack the Stripe pricing table the dialog needs, so it is backfilled from the
 * account-billing query (cache-first — CreditBalance keeps that cache warm).
 */
export function useOpencode402() {
  const { handle402Error } = use402ErrorCheck();
  const [fetchBilling] = useLazyGetAccountBillingInfoQuery();

  const onPaymentRequired = useCallback(
    async (payload: Partial<Error402MessageData> | null) => {
      if (wasRecent402()) return; // opencode retries → one UX per burst
      last402At = Date.now();

      let data = payload ?? {};
      if (
        !data.pricing_table?.pricing_table_id ||
        !data.pricing_table?.publishable_key
      ) {
        try {
          const tenant = getAuthItem('tenant') || '';
          if (tenant) {
            const billing = await fetchBilling(
              { platform_key: tenant },
              true,
            ).unwrap();
            if (billing?.pricing_table) {
              data = { ...data, pricing_table: billing.pricing_table };
            }
          }
        } catch {
          // No billing info → handle402Error's non-dialog branches still apply.
        }
      }
      void handle402Error(data as Error402MessageData);
    },
    [fetchBilling, handle402Error],
  );

  useEffect(() => {
    if (!isTauriApp()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const un = await listen<Partial<Error402MessageData>>(
          'opencode:payment-required',
          (evt) => void onPaymentRequired(evt.payload),
        );
        if (cancelled) un();
        else unlisten = un;
      } catch (e) {
        console.error('[opencode] payment-required listener failed', e);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [onPaymentRequired]);
}
