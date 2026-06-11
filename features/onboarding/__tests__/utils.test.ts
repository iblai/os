import { describe, it, expect, beforeEach } from 'vitest';

import {
  ONBOARDING_METADATA_KEY,
  ONBOARDING_METADATA_VERSION,
} from '../constants';
import type { PlatformUser } from '@/features/tenants/types';
import {
  buildOnboardingMetadata,
  countPlatformAdmins,
  isOnboardingDoneLocally,
  isUserMetadataEmpty,
  markOnboardingDoneLocally,
} from '../utils';

const admin = (is_admin: boolean) => ({ is_admin }) as PlatformUser;

describe('onboarding/utils', () => {
  describe('isUserMetadataEmpty', () => {
    it('treats null / undefined / empty object as empty', () => {
      expect(isUserMetadataEmpty(null)).toBe(true);
      expect(isUserMetadataEmpty(undefined)).toBe(true);
      expect(isUserMetadataEmpty({})).toBe(true);
    });

    it('treats a populated object as not empty', () => {
      expect(isUserMetadataEmpty({ onboarding: { completed: true } })).toBe(
        false,
      );
    });
  });

  describe('countPlatformAdmins', () => {
    it('counts only admins', () => {
      expect(
        countPlatformAdmins([admin(true), admin(false), admin(true)]),
      ).toBe(2);
    });

    it('returns 0 for undefined or no admins', () => {
      expect(countPlatformAdmins(undefined)).toBe(0);
      expect(countPlatformAdmins([admin(false)])).toBe(0);
    });
  });

  describe('buildOnboardingMetadata', () => {
    it('wraps trimmed answers under the onboarding key with version + completed', () => {
      const metadata = buildOnboardingMetadata(
        { organizationName: '  Acme  ', sector: 'universities' },
        '2026-01-01T00:00:00.000Z',
      );

      expect(metadata).toEqual({
        [ONBOARDING_METADATA_KEY]: {
          version: ONBOARDING_METADATA_VERSION,
          completed: true,
          organization_name: 'Acme',
          sector: 'universities',
          completed_at: '2026-01-01T00:00:00.000Z',
        },
      });
    });
  });

  describe('local "done" flag', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('round-trips per tenant', () => {
      expect(isOnboardingDoneLocally('acme')).toBe(false);
      markOnboardingDoneLocally('acme');
      expect(isOnboardingDoneLocally('acme')).toBe(true);
      // Namespaced per platform — a different tenant is unaffected.
      expect(isOnboardingDoneLocally('other')).toBe(false);
    });
  });
});
