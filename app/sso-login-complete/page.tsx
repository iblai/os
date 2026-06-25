'use client';

import React, { Suspense, useEffect } from 'react';
import { SsoLogin as SsoLoginComponent } from '@iblai/iblai-js/web-containers/next';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { hideInitialLoader } from '@/lib/initial-loader';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

function SsoLoginCompleteContent() {
  return (
    <SsoLoginComponent
      localStorageKeys={{
        CURRENT_TENANT: LOCAL_STORAGE_KEYS.CURRENT_TENANT,
        USER_DATA: LOCAL_STORAGE_KEYS.USER_DATA,
        TENANTS: LOCAL_STORAGE_KEYS.TENANTS,
        AXD_TOKEN: LOCAL_STORAGE_KEYS.AXD_TOKEN_KEY,
        AXD_TOKEN_EXPIRES: LOCAL_STORAGE_KEYS.AXD_TOKEN_KEY,
        DM_TOKEN: LOCAL_STORAGE_KEYS.DM_TOKEN_KEY,
        DM_TOKEN_EXPIRES: LOCAL_STORAGE_KEYS.DM_TOKEN_EXPIRY,
        EDX_TOKEN_KEY: LOCAL_STORAGE_KEYS.EDX_TOKEN_KEY,
      }}
      redirectPathKey="redirect-to"
      defaultRedirectPath="/"
      resolveRedirectPath={(
        redirectPath: string,
        parsedData: Record<string, string>,
      ): string => {
        // Check if redirectPath contains a platform key that doesn't match the authenticated tenant
        const platformKeyMatch = redirectPath.match(/^\/platform\/([^/]+)/);
        if (platformKeyMatch) {
          const pathPlatformKey = platformKeyMatch[1];
          const authenticatedTenant = parsedData.tenant;

          if (authenticatedTenant && pathPlatformKey !== authenticatedTenant) {
            // Platform key in path doesn't match authenticated tenant, reset to default
            redirectPath = '/';
          }
        }
        return redirectPath;
      }}
    />
  );
}

export default function SsoLoginComplete() {
  useEffect(() => {
    hideInitialLoader();
    // Notify other tabs/windows that the tenant switch SSO flow is complete
    if (typeof BroadcastChannel !== 'undefined') {
      const tenant = new URLSearchParams(window.location.search).get('tenant');
      const channel = new BroadcastChannel('ibl-tenant-switch');
      channel.postMessage({ type: 'TENANT_SWITCH_COMPLETE', tenant });
      channel.close();
    }
  }, []);

  return (
    <Suspense fallback={null}>
      <SsoLoginCompleteContent />
    </Suspense>
  );
}
