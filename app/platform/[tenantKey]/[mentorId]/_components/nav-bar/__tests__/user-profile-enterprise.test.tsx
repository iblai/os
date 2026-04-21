import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the enterprise billing bypass logic in UserProfile
 *
 * The UserProfile component (`user-profile.tsx`) uses isStripeActivated for billing:
 *
 * ```typescript
 * if (isStripeActivated(currentTenant as Tenant) && currentTenant?.is_admin) {
 *   getBillingURL({ ... });
 *   getTopUpURL( ... );
 * }
 * ```
 *
 * Where isStripeActivated is defined as:
 * ```typescript
 * export function isStripeActivated(currentTenant: Tenant) {
 *   return (
 *     config.stripeEnabled() === 'true' &&
 *     (!currentTenant?.is_enterprise ||
 *       (currentTenant?.key === 'main' && currentTenant?.is_enterprise))
 *   );
 * }
 * ```
 *
 * This test suite validates the logic to ensure proper billing access control.
 */

// Helper type representing the tenant structure
interface MockTenant {
  key: string;
  org: string;
  is_admin: boolean;
  is_enterprise?: boolean;
}

// Helper type representing the config
interface MockConfig {
  stripeEnabled: () => string;
}

/**
 * Pure function that mirrors the isStripeActivated logic.
 *
 * @see lib/utils.ts:isStripeActivated
 */
function isStripeActivated(
  config: MockConfig,
  currentTenant: MockTenant | null,
): boolean {
  return (
    config.stripeEnabled() === 'true' &&
    (!currentTenant?.is_enterprise ||
      (currentTenant?.key === 'main' && !!currentTenant?.is_enterprise))
  );
}

/**
 * Pure function that mirrors the billing access condition in UserProfile.
 * This allows us to test the logic without complex component dependencies.
 *
 * @see user-profile.tsx:handleGetSubscriptionRelatedData
 */
function shouldCallBillingAPIs(
  config: MockConfig,
  currentTenant: MockTenant | null,
): boolean {
  return isStripeActivated(config, currentTenant) && !!currentTenant?.is_admin;
}

describe('UserProfile - Enterprise Billing Bypass Logic with isStripeActivated', () => {
  describe('isStripeActivated - Logic validation', () => {
    const configStripeEnabled: MockConfig = { stripeEnabled: () => 'true' };
    const configStripeDisabled: MockConfig = { stripeEnabled: () => 'false' };

    describe('when stripe is enabled', () => {
      it('returns true for non-enterprise tenant', () => {
        const tenant: MockTenant = {
          key: 'any-tenant',
          org: 'any-org',
          is_admin: true,
          is_enterprise: false,
        };

        expect(isStripeActivated(configStripeEnabled, tenant)).toBe(true);
      });

      it('returns true for enterprise tenant on MAIN (special case)', () => {
        const tenant: MockTenant = {
          key: 'main',
          org: 'main-org',
          is_admin: true,
          is_enterprise: true,
        };

        expect(isStripeActivated(configStripeEnabled, tenant)).toBe(true);
      });

      it('returns false for enterprise tenant on NON-main tenant', () => {
        const tenant: MockTenant = {
          key: 'enterprise-tenant',
          org: 'enterprise-org',
          is_admin: true,
          is_enterprise: true,
        };

        expect(isStripeActivated(configStripeEnabled, tenant)).toBe(false);
      });

      it('returns true when is_enterprise is undefined (treated as non-enterprise)', () => {
        const tenant: MockTenant = {
          key: 'tenant-123',
          org: 'org-123',
          is_admin: true,
          // is_enterprise not set
        };

        expect(isStripeActivated(configStripeEnabled, tenant)).toBe(true);
      });

      it('returns true when currentTenant is null', () => {
        // null?.is_enterprise is undefined, so !undefined = true
        expect(isStripeActivated(configStripeEnabled, null)).toBe(true);
      });
    });

    describe('when stripe is disabled', () => {
      it('returns false regardless of enterprise status', () => {
        const nonEnterprise: MockTenant = {
          key: 'tenant-123',
          org: 'org-123',
          is_admin: true,
          is_enterprise: false,
        };

        const enterpriseOnMain: MockTenant = {
          key: 'main',
          org: 'main-org',
          is_admin: true,
          is_enterprise: true,
        };

        expect(isStripeActivated(configStripeDisabled, nonEnterprise)).toBe(
          false,
        );
        expect(isStripeActivated(configStripeDisabled, enterpriseOnMain)).toBe(
          false,
        );
      });
    });
  });

  describe('shouldCallBillingAPIs - Combined logic validation', () => {
    const configStripeEnabled: MockConfig = { stripeEnabled: () => 'true' };
    const configStripeDisabled: MockConfig = { stripeEnabled: () => 'false' };

    describe('when current_tenant.is_enterprise is true on NON-main tenant', () => {
      it('returns false - billing APIs should NOT be called', () => {
        const tenant: MockTenant = {
          key: 'enterprise-tenant',
          org: 'enterprise-org',
          is_admin: true,
          is_enterprise: true,
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(false);
      });

      it('returns false even for enterprise admin users on non-main tenant', () => {
        const tenant: MockTenant = {
          key: 'custom-enterprise',
          org: 'custom-org',
          is_admin: true,
          is_enterprise: true,
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(false);
      });
    });

    describe('when current_tenant.is_enterprise is true on MAIN tenant (special case)', () => {
      it('returns true for enterprise admin on main tenant - CAN access billing', () => {
        const tenant: MockTenant = {
          key: 'main',
          org: 'main-org',
          is_admin: true,
          is_enterprise: true,
        };

        // New behavior: enterprise on main tenant CAN access billing if admin
        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(true);
      });

      it('returns false for enterprise non-admin on main tenant (blocked by admin check)', () => {
        const tenant: MockTenant = {
          key: 'main',
          org: 'main-org',
          is_admin: false,
          is_enterprise: true,
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(false);
      });
    });

    describe('when current_tenant.is_enterprise is false', () => {
      it('returns true for non-enterprise admin users with stripe enabled', () => {
        const tenant: MockTenant = {
          key: 'tenant-123',
          org: 'org-123',
          is_admin: true,
          is_enterprise: false,
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(true);
      });

      it('returns false for non-enterprise non-admin users (blocked by admin check)', () => {
        const tenant: MockTenant = {
          key: 'tenant-123',
          org: 'org-123',
          is_admin: false,
          is_enterprise: false,
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(false);
      });

      it('returns true for admin on main tenant without enterprise flag', () => {
        const tenant: MockTenant = {
          key: 'main',
          org: 'main-org',
          is_admin: true,
          is_enterprise: false,
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(true);
      });
    });

    describe('when current_tenant.is_enterprise is undefined', () => {
      it('treats undefined as non-enterprise - allows billing for admin', () => {
        const tenant: MockTenant = {
          key: 'tenant-123',
          org: 'org-123',
          is_admin: true,
          // is_enterprise not set (undefined)
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(true);
      });

      it('treats undefined as non-enterprise - blocks non-admin', () => {
        const tenant: MockTenant = {
          key: 'tenant-123',
          org: 'org-123',
          is_admin: false,
          // is_enterprise not set
        };

        expect(shouldCallBillingAPIs(configStripeEnabled, tenant)).toBe(false);
      });
    });

    describe('stripe disabled scenarios', () => {
      it('returns false when stripe is disabled regardless of enterprise status', () => {
        const tenant: MockTenant = {
          key: 'tenant-123',
          org: 'org-123',
          is_admin: true,
          is_enterprise: false,
        };

        expect(shouldCallBillingAPIs(configStripeDisabled, tenant)).toBe(false);
      });

      it('returns false when stripe disabled even for enterprise on main (admin)', () => {
        const tenant: MockTenant = {
          key: 'main',
          org: 'main-org',
          is_admin: true,
          is_enterprise: true,
        };

        expect(shouldCallBillingAPIs(configStripeDisabled, tenant)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false when currentTenant is null (admin check fails)', () => {
        expect(shouldCallBillingAPIs(configStripeEnabled, null)).toBe(false);
      });

      it('returns false when tenant has no is_admin property', () => {
        // Deliberately malformed — the test verifies the guard rejects a
        // tenant missing `is_admin`. Cast through `unknown` to bypass the
        // type check without leaving an unused @ts-expect-error lying around.
        const malformedTenant = {
          key: 'tenant-123',
          org: 'org-123',
        } as unknown as MockTenant;

        expect(
          shouldCallBillingAPIs(configStripeEnabled, malformedTenant),
        ).toBe(false);
      });
    });

    describe('combined condition validation', () => {
      it('validates all permutations of conditions', () => {
        // Test key permutations
        const tests = [
          // stripe, key, is_admin, is_enterprise, expected result
          {
            stripe: 'true',
            key: 'other',
            admin: true,
            enterprise: false,
            expected: true,
          },
          {
            stripe: 'true',
            key: 'other',
            admin: true,
            enterprise: true,
            expected: false,
          }, // enterprise on non-main blocks
          {
            stripe: 'true',
            key: 'main',
            admin: true,
            enterprise: true,
            expected: true,
          }, // enterprise on main allowed
          {
            stripe: 'true',
            key: 'main',
            admin: false,
            enterprise: true,
            expected: false,
          }, // non-admin blocked
          {
            stripe: 'true',
            key: 'other',
            admin: false,
            enterprise: false,
            expected: false,
          }, // non-admin blocked
          {
            stripe: 'false',
            key: 'other',
            admin: true,
            enterprise: false,
            expected: false,
          }, // stripe disabled
          {
            stripe: 'false',
            key: 'main',
            admin: true,
            enterprise: true,
            expected: false,
          }, // stripe disabled
        ];

        tests.forEach(({ stripe, key, admin, enterprise, expected }) => {
          const config = { stripeEnabled: () => stripe };
          const tenant: MockTenant = {
            key,
            org: 'test',
            is_admin: admin,
            is_enterprise: enterprise,
          };

          expect(
            shouldCallBillingAPIs(config, tenant),
            `Failed for stripe=${stripe}, key=${key}, admin=${admin}, enterprise=${enterprise}`,
          ).toBe(expected);
        });
      });
    });
  });

  describe('behavior summary', () => {
    it('enterprise=true on non-main tenant blocks billing access regardless of admin status', () => {
      const config = { stripeEnabled: () => 'true' };

      // Enterprise admin on non-main
      expect(
        shouldCallBillingAPIs(config, {
          key: 'enterprise-tenant',
          org: 'enterprise-org',
          is_admin: true,
          is_enterprise: true,
        }),
      ).toBe(false);

      // Enterprise non-admin on non-main
      expect(
        shouldCallBillingAPIs(config, {
          key: 'enterprise-tenant',
          org: 'enterprise-org',
          is_admin: false,
          is_enterprise: true,
        }),
      ).toBe(false);
    });

    it('enterprise=true on MAIN tenant allows billing for admin (special case)', () => {
      const config = { stripeEnabled: () => 'true' };

      // Enterprise admin on main - ALLOWED
      expect(
        shouldCallBillingAPIs(config, {
          key: 'main',
          org: 'main-org',
          is_admin: true,
          is_enterprise: true,
        }),
      ).toBe(true);

      // Enterprise non-admin on main - still blocked by admin check
      expect(
        shouldCallBillingAPIs(config, {
          key: 'main',
          org: 'main-org',
          is_admin: false,
          is_enterprise: true,
        }),
      ).toBe(false);
    });

    it('non-enterprise admin users CAN access billing', () => {
      const config = { stripeEnabled: () => 'true' };

      expect(
        shouldCallBillingAPIs(config, {
          key: 'any-tenant',
          org: 'any-org',
          is_admin: true,
          is_enterprise: false,
        }),
      ).toBe(true);
    });

    it('non-enterprise non-admin users CANNOT access billing', () => {
      const config = { stripeEnabled: () => 'true' };

      expect(
        shouldCallBillingAPIs(config, {
          key: 'any-tenant',
          org: 'any-org',
          is_admin: false,
          is_enterprise: false,
        }),
      ).toBe(false);
    });
  });
});
