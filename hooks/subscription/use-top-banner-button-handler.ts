'use client';

import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  SUBSCRIPTION_V2_TRIGGERS,
  SUBSCRIPTION_MESSAGES,
  useTenantMetadata,
} from '@iblai/iblai-js/web-utils';
import { useCurrentTenant } from '@/hooks/use-user';
import { getUserEmail } from '@/features/utils';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

/**
 * Maps a banner trigger string (the `onUpgrade` payload stored on the
 * top-banner slice) to the matching button handler. New trigger types should
 * be added here so the wrapper component stays a thin pass-through.
 */
export function useTopBannerButtonHandler() {
  const { currentTenant } = useCurrentTenant();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const { metadata } = useTenantMetadata({ org: tenantKey || '' });

  return useCallback(
    (trigger?: string): (() => void) => {
      switch (trigger) {
        case SUBSCRIPTION_V2_TRIGGERS.CONTACT_ADMIN:
          return () => {
            const supportEmail =
              metadata?.support_email || config.supportEmail();
            const currentTenantOrg = currentTenant?.org || '';
            const userEmail = getUserEmail() || '';
            const subject =
              SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.STUDENT_UNDER_PAID_PACKAGE_EMAIL_SUBJECT(
                { currentTenantOrg },
              );
            const body =
              SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.STUDENT_UNDER_PAID_PACKAGE_EMAIL_BODY(
                { currentTenantOrg, userEmail },
              );
            const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(
              subject,
            )}&body=${encodeURIComponent(body)}`;
            window.open(mailto, '_blank');
          };
        default:
          return () => {};
      }
    },
    [metadata?.support_email, currentTenant?.org],
  );
}
