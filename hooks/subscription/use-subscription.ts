'use client';

import { useEffect } from 'react';
import { useSubscriptionHandler } from '@iblai/iblai-js/web-utils';
import { mentorSubscriptionFlow } from './subscription-flow';
import { getUserName } from '@/features/utils';
import { config } from '@/lib/config';
import { useCurrentTenant, useUserTenants } from '../use-user';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
export const useSubscription = () => {
  const { currentTenant } = useCurrentTenant();
  const { userTenants } = useUserTenants();
  const dispatch = useAppDispatch();
  const topBannerOptions = useAppSelector(
    (state) => state.topBanner.topBannerOptions,
  );
  const subscriptionFlow = new mentorSubscriptionFlow({
    platformName: config.iblPlatform(),
    currentTenantKey: currentTenant?.key || '',
    username: getUserName(),
    currentTenantOrg: currentTenant?.org || '',
    userTenants,
    isAdmin: currentTenant?.is_admin || false,
    mainTenantKey: currentTenant?.key || '',
    dispatch,
    topBannerOptions,
  });
  const { handleIntervalSubscriptionCheck, trialCounterStarted } =
    useSubscriptionHandler(subscriptionFlow);

  useEffect(() => {
    handleIntervalSubscriptionCheck();
  }, [trialCounterStarted]);
};
