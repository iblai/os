'use client';

import { useEffect } from 'react';
import { useSubscriptionHandlerV2 } from '@iblai/iblai-js/web-utils';
import { MentorSubscriptionFlowV2 } from './subscription-flow-v2';
import { getUserEmail, getUserName } from '@/features/utils';
import { config } from '@/lib/config';
import { useCurrentTenant, useUserTenants } from '../use-user';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
export const useSubscriptionV2 = () => {
  const { currentTenant } = useCurrentTenant();
  const { userTenants } = useUserTenants();
  const dispatch = useAppDispatch();
  const error402Detected = useAppSelector((state) => state.subscription.error402Detected);
  const topBannerOptions = useAppSelector((state) => state.topBanner.topBannerOptions);

  const subscriptionStatus = useAppSelector((state) => state.subscription);
  const subscriptionFlow = new MentorSubscriptionFlowV2({
    platformName: config.iblPlatform(),
    currentTenantKey: currentTenant?.key || '',
    username: getUserName(),
    currentTenantOrg: currentTenant?.org || '',
    userTenants,
    isAdmin: currentTenant?.is_admin || false,
    mainTenantKey: config.mainTenantKey(),
    userEmail: getUserEmail(),
    dispatch,
    topBannerOptions,
    mentorUrl: config.mentorUrl(),
  });

  const { handleSubscriptionCheck, CREDIT_INTERVAL_CHECK_COUNTER } =
    useSubscriptionHandlerV2(subscriptionFlow);

  useEffect(() => {
    // Initial check
    if (error402Detected) {
      handleSubscriptionCheck();
    }

    // Set up interval for periodic checks
    const intervalId = setInterval(() => {
      handleSubscriptionCheck();
    }, CREDIT_INTERVAL_CHECK_COUNTER);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [error402Detected]);

  const { executeWithTrialCheck } = useShowFreeTrialDialog();

  useEffect(() => {
    if (error402Detected && subscriptionStatus.subscriptionStatus.creditExhausted) {
      executeWithTrialCheck(() => {});
    }
  }, [error402Detected, subscriptionStatus.subscriptionStatus.creditExhausted]);
};
