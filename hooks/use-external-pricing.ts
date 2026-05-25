import { config } from '@/lib/config';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { isJSON } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { useFreeTrial } from './use-free-trial';
import { getUserName } from '@/features/utils';

export const useExternalPricing = () => {
  const PRICING_URL = config.externalPricingPageUrl();
  const pricingBoxIframeRef = useRef(null);
  const { userOnFreeTrial } = useFreeTrial();

  const getPaymentSuccessCallbackUrl = () => {
    return `${config.authUrl()}/create-organization?redirect-to=${window.location.origin}`;
  };

  const getIFrameReadyData = () => {
    return {
      token: window.localStorage.getItem(LOCAL_STORAGE_KEYS.DM_TOKEN_KEY),
      success_url: getPaymentSuccessCallbackUrl(),
      cancel_url: window.location.href,
      mode: 'subscription',
      metric_type: 'user_count',
      metered: false,
      ...(userOnFreeTrial()
        ? {
            is_free_trial: true,
            trial_days: 5,
            skip_card: true,
          }
        : {}),
      endpointURL: `${config.dmUrl()}/api/service/orgs/main/users/${getUserName()}/stripe/checkout-session/`,
    };
  };

  const handleIframePostMessageInteractions = (event: { data: string }) => {
    const message = isJSON(event?.data) ? JSON.parse(event.data) : null;
    if (message?.ready) {
      const dataToSend = getIFrameReadyData();
      // Add type assertion to fix TypeScript error
      (
        pricingBoxIframeRef?.current as unknown as HTMLIFrameElement
      )?.contentWindow?.postMessage(
        JSON.stringify({ data: dataToSend }),
        new URL(PRICING_URL).origin,
      );
    }
    if (message?.payment_initialization_launched) {
      if (message?.payment_initialization_successful) {
        const redirectTo = String(message?.redirect_to ?? '');
        try {
          const url = new URL(redirectTo);
          if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            return;
          }
        } catch {
          return;
        }
        window.location.href = redirectTo;
      } else {
        //TODO notify user of error
      }
    }
  };

  useEffect(() => {
    window.addEventListener('message', handleIframePostMessageInteractions);
    return () => {
      window.removeEventListener(
        'message',
        handleIframePostMessageInteractions,
      );
    };
  }, []);

  return {
    PRICING_URL,
    pricingBoxIframeRef,
  };
};
