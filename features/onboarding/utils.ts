import type { PlatformUser } from '@/features/tenants/types';

import {
  ONBOARDING_METADATA_KEY,
  ONBOARDING_METADATA_VERSION,
  onboardingDoneStorageKey,
} from './constants';
import type { OnboardingAnswers, OnboardingMetadata } from './types';

/**
 * Whether the user's platform metadata is "empty" — i.e. they have never been
 * onboarded. True when the metadata is null/undefined or an object with no keys.
 */
export function isUserMetadataEmpty(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return true;
  if (typeof metadata !== 'object') return false;
  return Object.keys(metadata).length === 0;
}

/** Count how many of the platform's users are admins. */
export function countPlatformAdmins(users: PlatformUser[] | undefined): number {
  if (!users) return 0;
  return users.reduce((total, user) => total + (user.is_admin ? 1 : 0), 0);
}

/**
 * Build the metadata payload written when onboarding completes. The wizard only
 * runs when metadata is empty, so this becomes the user's whole metadata object.
 */
export function buildOnboardingMetadata(
  answers: OnboardingAnswers,
  completedAt: string,
): Record<string, unknown> {
  const onboarding: OnboardingMetadata = {
    version: ONBOARDING_METADATA_VERSION,
    completed: true,
    organization_name: answers.organizationName.trim(),
    sector: answers.sector,
    completed_at: completedAt,
  };
  return { [ONBOARDING_METADATA_KEY]: onboarding };
}

/** Fast-path: has the current admin already finished onboarding on this device? */
export function isOnboardingDoneLocally(tenantKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(onboardingDoneStorageKey(tenantKey)) ===
      'true'
    );
  } catch {
    return false;
  }
}

/** Record that onboarding is done so the gate short-circuits on next load. */
export function markOnboardingDoneLocally(tenantKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(onboardingDoneStorageKey(tenantKey), 'true');
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
