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
    />
  );
}

export default function SsoLoginComplete() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  return (
    <Suspense fallback={null}>
      <SsoLoginCompleteContent />
    </Suspense>
  );
}
