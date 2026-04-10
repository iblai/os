'use client';

import React from 'react';
import { z } from 'zod';
import {
  useLazyGetTenantMetadataQuery,
  useLazyGetUserTenantsQuery,
} from '@/features/tenants/api-slice';
import { tenantSchema } from '@/lib/types';

type UseTenantProviderProps = {
  onAuthSuccess?: () => void;
  onAuthFailure?: (reason: string) => void;
  redirectToAuthSpa: () => void;
  tenantKey: string;
  saveCurrentTenant: (tenant: z.infer<typeof tenantSchema>) => void;
  saveUserTenants: (tenants: z.infer<typeof tenantSchema>[]) => void;
};

type UseTenantProviderReturn = {
  isLoading: boolean;
};

export function useTenantProvider({
  onAuthSuccess,
  onAuthFailure,
  redirectToAuthSpa,
  tenantKey,
  saveCurrentTenant,
  saveUserTenants,
}: UseTenantProviderProps): UseTenantProviderReturn {
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchUserTenants] = useLazyGetUserTenantsQuery();
  const [fetchTenantMetadata] = useLazyGetTenantMetadataQuery();

  const determineWhichTenantToUse = React.useCallback(async () => {
    setIsLoading(true);

    try {
      // get the user's tenants
      const { data: tenants } = await fetchUserTenants();

      if (!tenants || tenants.length === 0) {
        console.log('[auth-redirect] No tenants found for user');
        redirectToAuthSpa();
        return;
      }

      const tenant = tenants.find((tenant) => tenant.key === tenantKey);

      if (!tenant) {
        console.log("[auth-redirect] Tenant not found in user's tenants", {
          tenantKey,
        });
        redirectToAuthSpa();
        return;
      }

      saveUserTenants(tenants || []);

      // get the user's tenant metadata
      const { data: tenantMetadata } = await fetchTenantMetadata({
        tenantKey,
      });

      // check if the tenant is active
      if (tenantMetadata?.metadata?.spa_domains?.mentor?.active) {
        window.location.href =
          tenantMetadata?.metadata?.spa_domains?.mentor?.domain;
        onAuthSuccess?.();
        return;
      }

      saveCurrentTenant({
        key: tenant.key,
        is_admin: tenant.is_admin,
        org: tenant.org,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      onAuthFailure?.(`Unexpected error: ${errorMessage}`);
      console.log('[auth-redirect] Unexpected error in tenant redirect', {
        error: errorMessage,
      });
      redirectToAuthSpa();
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchUserTenants,
    fetchTenantMetadata,
    tenantKey,
    redirectToAuthSpa,
    onAuthSuccess,
    onAuthFailure,
    saveUserTenants,
    saveCurrentTenant,
  ]);

  React.useEffect(() => {
    determineWhichTenantToUse();
  }, []);

  return {
    isLoading,
  };
}
