'use client';

import { useCurrentTenant, useUserTenants } from '@/hooks/use-user';

/** Free-form per-tenant metadata blob (support/help/chat/onboarding/etc.). */
export type TenantObjectMetadata = Record<string, any>;

/**
 * The current (or given) tenant's metadata, read from the tenants list the app
 * already fetched — `/api/core/users/platforms/` now embeds `metadata` on each
 * tenant object — instead of the per-org `/metadata/` API call.
 *
 * No network request: the tenants list only holds tenants the user belongs to,
 * so a key that isn't in it (or a not-yet-loaded list) yields empty metadata.
 */
export function useTenantObjectMetadata(
  tenantKey?: string,
): TenantObjectMetadata {
  const { userTenants } = useUserTenants();
  const { currentTenant } = useCurrentTenant();

  const key = tenantKey || currentTenant?.key;
  const tenant = (userTenants ?? []).find((candidate) => candidate.key === key);

  return (
    (tenant as { metadata?: TenantObjectMetadata } | undefined)?.metadata ?? {}
  );
}
