'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { hideInitialLoader } from '@/lib/initial-loader';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

const REDIRECT_PATH_LOCAL_STORAGE_KEY = 'redirect-to';

const initializeLocalStorageWithObject = (data: Record<string, string>) => {
  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
};

function SsoLoginContent() {
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const queryParamData = searchParams.get('data');
    let redirectPath = searchParams.get('redirect-path');

    console.log('SSO login page loaded', {
      hasQueryData: !!queryParamData,
      origin: window.location.origin,
    });

    if (queryParamData) {
      console.log('processing SSO login data', {
        dataLength: queryParamData.length,
      });

      initializeLocalStorageWithObject(JSON.parse(queryParamData));

      if (!redirectPath) {
        redirectPath = localStorage.getItem(REDIRECT_PATH_LOCAL_STORAGE_KEY)
          ? localStorage.getItem(REDIRECT_PATH_LOCAL_STORAGE_KEY)
          : '/';
      }

      console.log('SSO login redirecting', {
        redirectPath,
        targetUrl: `${window.location.origin}${redirectPath}`,
      });

      localStorage.removeItem(REDIRECT_PATH_LOCAL_STORAGE_KEY);
      window.location.href = `${window.location.origin}${redirectPath}`;
    }
  }, [searchParams]);

  return null;
}

export default function SsoLogin() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  return (
    <Suspense fallback={null}>
      <SsoLoginContent />
    </Suspense>
  );
}
