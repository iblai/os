'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { initializeLocalStorageWithObject } from '@iblai/iblai-js/web-containers/next';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

/**
 * Component that handles the ibl-data query parameter
 * Initializes localStorage with the data and removes the query param from the URL
 */
export function IblDataHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const iblData = searchParams.get('ibl-data');

    if (iblData) {
      try {
        // Parse the ibl-data JSON
        const parsedData = JSON.parse(iblData);

        // Initialize localStorage with the parsed data
        initializeLocalStorageWithObject(parsedData, {
          CURRENT_TENANT: LOCAL_STORAGE_KEYS.CURRENT_TENANT,
          USER_DATA: LOCAL_STORAGE_KEYS.USER_DATA,
          TENANTS: LOCAL_STORAGE_KEYS.TENANTS,
        }).then(() => {
          // Remove the ibl-data query param from the URL
          const params = new URLSearchParams(searchParams.toString());
          params.delete('ibl-data');

          // Build the new URL without the ibl-data param
          const newUrl = params.toString()
            ? `${pathname}?${params.toString()}`
            : pathname;

          // Replace the URL without the ibl-data param
          router.replace(newUrl);
        });
      } catch (error) {
        console.error('[IblDataHandler] Failed to parse ibl-data:', error);
      }
    }
  }, [searchParams, router, pathname]);

  return null;
}
