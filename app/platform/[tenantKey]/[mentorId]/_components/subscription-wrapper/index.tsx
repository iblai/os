'use client';

import { isLoggedIn, isStripeActivated } from '@/lib/utils';
import { MentorECommerceWrapper } from './mentor-e-commerce-wrapper';
import { useCurrentTenant } from '@/hooks/use-user';
import { Tenant } from '@iblai/iblai-js/web-utils';

export function SubscriptionWrapper() {
  const { currentTenant } = useCurrentTenant();
  if (isLoggedIn() && isStripeActivated(currentTenant as Tenant))
    return <MentorECommerceWrapper />;

  return null;
}
