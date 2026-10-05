'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  useGetUserMetadataQuery,
  useUpdateUserMetadataMutation,
} from '@iblai/iblai-js/data-layer';

import { config } from '@/lib/config';

/** Bump to show a reworked tour again to everyone who saw an older version. */
export const PRODUCT_TOUR_VERSION = 1;

export type TourOutcome = 'finished' | 'skipped';

export type ProductTourRecord = {
  status: TourOutcome;
  version: number;
  completed_at: string;
};

/** One key per SPA, so sibling apps never read or overwrite each other's tour state. */
export function productTourMetadataKey(): string {
  return `${config.appName() || 'os'}-product-tour`;
}

export function readTourRecord(value: unknown): ProductTourRecord | null {
  if (!value || typeof value !== 'object') return null;
  const { status, version, completed_at } = value as Record<string, unknown>;
  if (status !== 'finished' && status !== 'skipped') return null;
  return {
    status,
    version: typeof version === 'number' ? version : 0,
    completed_at: typeof completed_at === 'string' ? completed_at : '',
  };
}

/**
 * Whether the user has seen the product tour, stored on the user's metadata
 * (`public_metadata["<appName>-product-tour"]`) so it follows the account
 * across devices.
 */
export function useTourCompletion(username: string | null | undefined) {
  const { data, isLoading, isError } = useGetUserMetadataQuery(
    { params: { username: username ?? '' } },
    { skip: !username },
  );
  const [updateUserMetadata] = useUpdateUserMetadataMutation();
  type UpdatePayload = Parameters<typeof updateUserMetadata>[0];
  const [localOutcome, setLocalOutcome] = useState<TourOutcome | null>(null);

  const key = productTourMetadataKey();
  const publicMetadata = useMemo(
    () => (data?.public_metadata ?? {}) as Record<string, unknown>,
    [data],
  );
  const record = useMemo(
    () => readTourRecord(publicMetadata[key]),
    [publicMetadata, key],
  );
  const storedOutcome =
    record && record.version >= PRODUCT_TOUR_VERSION ? record.status : null;
  const outcome = localOutcome ?? storedOutcome;

  const markCompleted = useCallback(
    async (status: TourOutcome) => {
      // Optimistic: a failed save must not bring the tour back this session.
      setLocalOutcome(status);
      if (!username) return;
      const next: ProductTourRecord = {
        status,
        version: PRODUCT_TOUR_VERSION,
        completed_at: new Date().toISOString(),
      };
      try {
        // The endpoint replaces public_metadata wholesale; dropping the
        // spread would wipe the user's language, bio, social links, etc.
        await updateUserMetadata({
          username,
          public_metadata: { ...publicMetadata, [key]: next },
        } as unknown as UpdatePayload).unwrap();
      } catch (error) {
        console.error(
          '[product-tour] Could not save the tour outcome to the user metadata',
          error,
        );
      }
    },
    [username, publicMetadata, key, updateUserMetadata],
  );

  return {
    completed: outcome !== null,
    outcome,
    isLoading: !!username && isLoading,
    isError: !!username && isError,
    markCompleted,
  };
}
