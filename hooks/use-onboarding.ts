'use client';

import { useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';

import {
  useGetPlatformUsersQuery,
  useGetUserPlatformMetadataQuery,
  useUpdateUserPlatformMetadataMutation,
} from '@/features/tenants/api-slice';
import type { Tenant } from '@/features/tenants/types';
import { useCurrentTenant, useIsAdmin } from '@/hooks/use-user';
import { isTauriApp } from '@/types/tauri';
import { isTauriOfflineMode } from '@/hooks/use-tauri-offline';

import { ONBOARDING_SKIP_ROUTES } from '@/features/onboarding/constants';
import type { OnboardingAnswers } from '@/features/onboarding/types';
import {
  buildOnboardingMetadata,
  countPlatformAdmins,
  isOnboardingDoneLocally,
  isUserMetadataEmpty,
  markOnboardingDoneLocally,
} from '@/features/onboarding/utils';

/** Dedicated full-screen route that hosts the onboarding wizard. */
export const ONBOARDING_ROUTE = '/onboarding';

export interface OnboardingGateState {
  /** Both conditions met: only platform admin + empty user metadata. */
  isEligible: boolean;
  /** Still waiting on the metadata/users lookups (avoid redirecting too early). */
  isResolving: boolean;
  tenantKey: string;
}

/**
 * Decides whether first-run onboarding should run for the current user:
 *  1. the user is a tenant admin, AND
 *  2. they are the ONLY admin of the platform, AND
 *  3. their platform metadata is empty (never onboarded).
 *
 * Skips entirely (no API calls) for non-admins, offline/Tauri, public routes,
 * or once a local "done" flag is set — so it's cheap on every render.
 */
export function useOnboardingGate(): OnboardingGateState {
  const isAdmin = useIsAdmin();
  const { currentTenant } = useCurrentTenant();
  const pathname = usePathname();

  const tenant = currentTenant as unknown as Tenant | null;
  const tenantKey = tenant?.key ?? '';

  const offline = isTauriApp() && isTauriOfflineMode();
  const onSkipRoute = ONBOARDING_SKIP_ROUTES.test(pathname ?? '');
  const doneLocally = tenantKey ? isOnboardingDoneLocally(tenantKey) : false;

  const skip =
    typeof window === 'undefined' ||
    !isAdmin ||
    !tenantKey ||
    offline ||
    onSkipRoute ||
    doneLocally;

  const { data: metadata, isLoading: metaLoading } =
    useGetUserPlatformMetadataQuery({ tenantKey }, { skip });
  const { data: users, isLoading: usersLoading } = useGetPlatformUsersQuery(
    { tenantKey },
    { skip },
  );

  const metadataEmpty = !!metadata && isUserMetadataEmpty(metadata.metadata);
  const onlyAdmin = !!users && countPlatformAdmins(users.results) === 1;

  // Once we've confirmed metadata is NON-empty (already onboarded — possibly on
  // another device), remember it locally so later loads skip the lookups.
  useEffect(() => {
    if (!skip && metadata && !metadataEmpty && tenantKey) {
      markOnboardingDoneLocally(tenantKey);
    }
  }, [skip, metadata, metadataEmpty, tenantKey]);

  return {
    isEligible: !skip && metadataEmpty && onlyAdmin,
    isResolving: !skip && (metaLoading || usersLoading),
    tenantKey,
  };
}

/**
 * Whether the current user may OPEN the onboarding route manually — ANY platform
 * admin, independent of the auto-trigger conditions. This lets existing admins
 * revisit `/onboarding`; it just never auto-launches for them (only
 * `useOnboardingGate` drives the automatic redirect).
 */
export function useOnboardingAccess(): {
  canAccess: boolean;
  tenantKey: string;
} {
  const isAdmin = useIsAdmin();
  const { currentTenant } = useCurrentTenant();
  const tenant = currentTenant as unknown as Tenant | null;
  const tenantKey = tenant?.key ?? '';
  const offline = isTauriApp() && isTauriOfflineMode();

  return { canAccess: !!isAdmin && !!tenantKey && !offline, tenantKey };
}

/** Persist onboarding answers + mark onboarding complete (so it never re-runs). */
export function useCompleteOnboarding() {
  const [updateMetadata, { isLoading }] =
    useUpdateUserPlatformMetadataMutation();

  const completeOnboarding = useCallback(
    async (tenantKey: string, answers: OnboardingAnswers) => {
      const metadata = buildOnboardingMetadata(
        answers,
        new Date().toISOString(),
      );
      await updateMetadata({ tenantKey, metadata }).unwrap();
      markOnboardingDoneLocally(tenantKey);
    },
    [updateMetadata],
  );

  return { completeOnboarding, isSavingMetadata: isLoading };
}
