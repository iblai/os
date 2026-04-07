import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Test-controlled mock state ----
let mockCurrentTenant: any;
let mockUserTenants: any[];
let mockStripeEnabled: string;

// Mock the config with all required functions
vi.mock('@/lib/config', () => ({
  config: {
    stripeEnabled: () => mockStripeEnabled,
    iblTemplateMentor: () => 'ai-mentor',
    environment: () => 'development',
    authUrl: () => 'https://auth.example.com',
    lmsUrl: () => 'https://learn.example.com',
    dmUrl: () => 'https://dm.example.com',
    axdUrl: () => 'https://axd.example.com',
    mainTenantKey: () => 'main',
    iblPlatform: () => 'mentor',
    mentorUrl: () => 'https://mentor.example.com',
    baseWsUrl: () => 'https://ws.example.com',
    liveKitServerUrl: () => 'wss://livekit.example.com',
    sentryDsn: () => '',
    helpCenterUrl: () => 'https://help.example.com',
    supportEmail: () => 'support@example.com',
    enableGravatarOnProfilePic: () => 'true',
    enableRBAC: () => false,
    advertisingEnabled: () => false,
    showBaseMentor: () => false,
  },
}));

// Mock the localStorage hook dependency with dynamic return values
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: vi.fn((key: string, defaultValue: any) => {
    if (key === 'current_tenant') {
      return [mockCurrentTenant, vi.fn()];
    }
    if (key === 'tenants') {
      return [mockUserTenants, vi.fn()];
    }
    return [defaultValue, vi.fn()];
  }),
}));

// Mock the utils - isStripeActivated
vi.mock('@/lib/utils', () => ({
  isStripeActivated: (tenant: any) => {
    // Mirrors the actual isStripeActivated logic:
    // config.stripeEnabled() === 'true' &&
    // (!currentTenant?.is_enterprise || (currentTenant?.key === 'main' && currentTenant?.is_enterprise))
    return (
      mockStripeEnabled === 'true' &&
      (!tenant?.is_enterprise ||
        (tenant?.key === 'main' && tenant?.is_enterprise))
    );
  },
}));

// Import after mocks are set up
import { useUserIsOnTrial } from '@/hooks/use-user';
import { renderHook } from '@testing-library/react';

beforeEach(() => {
  vi.clearAllMocks();
  mockCurrentTenant = null;
  mockUserTenants = [];
  mockStripeEnabled = 'true';
});

describe('useUserIsOnTrial - with isStripeActivated', () => {
  /**
   * The updated useUserIsOnTrial logic:
   *
   * if (currentTenant && isStripeActivated(currentTenant) && userTenants.length === 1) {
   *   return currentTenant?.key === 'main' && currentTenant?.is_admin === false;
   * }
   * return false;
   *
   * Where isStripeActivated returns:
   * config.stripeEnabled() === 'true' &&
   * (!tenant?.is_enterprise || (tenant?.key === 'main' && tenant?.is_enterprise))
   */

  describe('when current_tenant.is_enterprise is true on NON-main tenant', () => {
    it('returns false - isStripeActivated returns false for enterprise on non-main', () => {
      mockCurrentTenant = {
        key: 'enterprise-tenant', // NOT main
        org: 'enterprise-org',
        is_admin: false,
        is_enterprise: true,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      // isStripeActivated returns false for enterprise on non-main tenant
      expect(result.current).toBe(false);
    });

    it('returns false for enterprise admin users on non-main tenant', () => {
      mockCurrentTenant = {
        key: 'enterprise-tenant',
        org: 'enterprise-org',
        is_admin: true,
        is_enterprise: true,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });
  });

  describe('when current_tenant.is_enterprise is true on MAIN tenant (special case)', () => {
    it('returns true for enterprise non-admin on main tenant with single tenant', () => {
      // isStripeActivated returns true for enterprise on main
      // And the condition: key === 'main' && is_admin === false is met
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false, // Non-admin
        is_enterprise: true,
      };
      mockUserTenants = [mockCurrentTenant]; // Single tenant
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      // Now returns true because isStripeActivated allows enterprise on main
      expect(result.current).toBe(true);
    });

    it('returns false for enterprise admin on main tenant', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: true, // Admin - fails the is_admin === false check
        is_enterprise: true,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      // isStripeActivated is true, but is_admin === true fails the trial condition
      expect(result.current).toBe(false);
    });

    it('returns false for enterprise non-admin on main with multiple tenants', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: true,
      };
      mockUserTenants = [
        mockCurrentTenant,
        { key: 'other', org: 'other', is_admin: false },
      ]; // Multiple tenants
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      // Fails because userTenants.length !== 1
      expect(result.current).toBe(false);
    });
  });

  describe('when current_tenant.is_enterprise is false', () => {
    it('returns true for non-admin user on main tenant with single tenant and stripe enabled', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(true);
    });

    it('returns false for admin user on main tenant', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: true,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });

    it('returns false for user with multiple tenants', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [
        mockCurrentTenant,
        { key: 'other-tenant', org: 'other-org', is_admin: false },
      ];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });

    it('returns false when stripe is disabled', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'false';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });

    it('returns false for non-main tenant', () => {
      mockCurrentTenant = {
        key: 'custom-tenant',
        org: 'custom-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });
  });

  describe('when current_tenant.is_enterprise is undefined', () => {
    it('behaves as if is_enterprise is false - allows trial for eligible users', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        // is_enterprise not set
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns false when currentTenant is null', () => {
      mockCurrentTenant = null;
      mockUserTenants = [];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });

    it('returns false when currentTenant is undefined', () => {
      mockCurrentTenant = undefined;
      mockUserTenants = [];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });

    it('returns false when userTenants is empty', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = []; // Empty - length !== 1
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });
  });

  describe('isStripeActivated integration', () => {
    it('stripe enabled + non-enterprise + main + non-admin + single tenant = on trial', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(true);
    });

    it('stripe enabled + enterprise on main + non-admin + single tenant = on trial (NEW behavior)', () => {
      // This is the key change - enterprise on main is now treated the same
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: true, // Enterprise on main is now allowed
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      // Now returns true because isStripeActivated allows enterprise on main
      expect(result.current).toBe(true);
    });

    it('stripe enabled + enterprise on non-main = NOT on trial', () => {
      mockCurrentTenant = {
        key: 'other',
        org: 'other',
        is_admin: false,
        is_enterprise: true,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });

    it('stripe disabled = NOT on trial regardless of other conditions', () => {
      mockCurrentTenant = {
        key: 'main',
        org: 'main-org',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'false';

      const { result } = renderHook(() => useUserIsOnTrial());

      expect(result.current).toBe(false);
    });
  });

  describe('trial condition requirements', () => {
    it('requires ALL conditions: currentTenant + isStripeActivated + single tenant + main + non-admin', () => {
      // Test each condition failing

      // Missing currentTenant
      mockCurrentTenant = null;
      mockUserTenants = [{ key: 'main', org: 'main', is_admin: false }];
      mockStripeEnabled = 'true';
      expect(renderHook(() => useUserIsOnTrial()).result.current).toBe(false);

      // isStripeActivated false (stripe disabled)
      mockCurrentTenant = {
        key: 'main',
        org: 'main',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'false';
      expect(renderHook(() => useUserIsOnTrial()).result.current).toBe(false);

      // Multiple tenants
      mockCurrentTenant = {
        key: 'main',
        org: 'main',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [
        mockCurrentTenant,
        { key: 'other', org: 'other', is_admin: false },
      ];
      mockStripeEnabled = 'true';
      expect(renderHook(() => useUserIsOnTrial()).result.current).toBe(false);

      // Not main tenant
      mockCurrentTenant = {
        key: 'other',
        org: 'other',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';
      expect(renderHook(() => useUserIsOnTrial()).result.current).toBe(false);

      // Is admin
      mockCurrentTenant = {
        key: 'main',
        org: 'main',
        is_admin: true,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';
      expect(renderHook(() => useUserIsOnTrial()).result.current).toBe(false);

      // All conditions met = on trial
      mockCurrentTenant = {
        key: 'main',
        org: 'main',
        is_admin: false,
        is_enterprise: false,
      };
      mockUserTenants = [mockCurrentTenant];
      mockStripeEnabled = 'true';
      expect(renderHook(() => useUserIsOnTrial()).result.current).toBe(true);
    });
  });
});
