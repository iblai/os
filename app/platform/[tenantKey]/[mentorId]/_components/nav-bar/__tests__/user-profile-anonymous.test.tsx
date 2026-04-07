import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { UserProfile } from '../user-profile';

// Declare mock functions using vi.hoisted()
const {
  mockRouterReplace,
  mockSaveCurrentTenant,
  mockSaveUserTenants,
  mockDispatch,
  mockFetchTenantMetadata,
  mockGetBillingURL,
  mockGetTopUpURL,
  mockGetUserSubscriptionPackage,
  mockGetUserActiveAppLegacy,
  mockBannerButtonTriggerCallback,
} = vi.hoisted(() => ({
  mockRouterReplace: vi.fn(),
  mockSaveCurrentTenant: vi.fn(),
  mockSaveUserTenants: vi.fn(),
  mockDispatch: vi.fn(),
  mockFetchTenantMetadata: vi.fn(),
  mockGetBillingURL: vi.fn(),
  mockGetTopUpURL: vi.fn(),
  mockGetUserSubscriptionPackage: vi.fn(),
  mockGetUserActiveAppLegacy: vi.fn(),
  mockBannerButtonTriggerCallback: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'new-tenant', mentorId: 'mentor-1' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
    toString: vi.fn().mockReturnValue(''),
  }),
  usePathname: () => '/platform/new-tenant/mentor-1',
}));

// Mock user hooks - userTenants does NOT include 'new-tenant'
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
  useIsAdmin: () => false,
  useIsVisiting: () => false,
  useUserIsStudent: () => false,
  useCurrentTenant: () => ({
    currentTenant: { key: 'other-tenant', is_admin: false, org: 'other-org' },
    saveCurrentTenant: mockSaveCurrentTenant,
  }),
  useUserTenants: () => ({
    userTenants: [{ key: 'other-tenant', is_admin: false, org: 'other-org' }],
    saveUserTenants: mockSaveUserTenants,
  }),
  useVisitingTenant: () => ({ visitingTenant: null }),
}));

// Mock Redux hooks
vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => {
    const mockState = {
      topBanner: { topBannerOptions: {} },
      rbac: {},
    };
    return selector(mockState);
  },
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    iblPlatform: () => 'mentor',
    mainTenantKey: () => 'main',
    mentorUrl: () => 'https://mentor.example.com',
    helpCenterUrl: () => 'https://help.example.com',
    enableGravatarOnProfilePic: () => 'true',
    authUrl: () => 'https://auth.example.com',
    platformBaseDomain: () => 'example.com',
    enableRBAC: () => false,
    iblTemplateMentor: () => 'default-mentor',
  },
}));

// Mock utils
vi.mock('@/features/utils', () => ({
  getUserEmail: () => 'test@example.com',
  getUserName: () => 'testuser',
}));

// Mock lib/utils
vi.mock('@/lib/utils', () => ({
  handleLogout: vi.fn(),
  handleTenantSwitch: vi.fn(),
  isStripeActivated: vi.fn().mockReturnValue(false),
}));

// Mock subscription flow class
vi.mock('@/hooks/subscription/subscription-flow-v2', () => ({
  MentorSubscriptionFlowV2: vi.fn().mockImplementation(() => ({})),
}));

// Mock tenant metadata and subscription hooks
vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => ({
    metadata: { help_center_url: 'https://help.example.com', show_help: true },
    metadataLoaded: true,
  }),
  Tenant: {},
  useSubscriptionHandlerV2: () => ({
    getBillingURL: mockGetBillingURL,
    getTopUpURL: mockGetTopUpURL,
    getUserSubscriptionPackage: mockGetUserSubscriptionPackage,
    getUserActiveAppLegacy: mockGetUserActiveAppLegacy,
    bannerButtonTriggerCallback: mockBannerButtonTriggerCallback,
  }),
  SUBSCRIPTION_V2_TRIGGERS: {
    PRICING_MODAL: 'TRIGGER_PRICING_MODAL',
    TOP_UP_CREDIT: 'TRIGGER_TOP_UP_CREDIT',
    CONTACT_ADMIN: 'TRIGGER_CONTACT_ADMIN',
    BILLING_PAGE: 'TRIGGER_BILLING_PAGE',
  },
}));

// Mock @iblai/iblai-api to provide the enum
vi.mock('@iblai/iblai-api', () => ({
  MentorVisibilityEnum: {
    VIEWABLE_BY_ANYONE: 'VIEWABLE_BY_ANYONE',
  },
  UserApp: {},
}));

// Mock data layer query - returns anonymous mentor settings
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: () => ({
    data: {
      allow_anonymous: true,
      mentor_visibility: 'VIEWABLE_BY_ANYONE',
    },
  }),
}));

// Mock tenant metadata query
vi.mock('@/features/tenants/api-slice', () => ({
  useLazyGetTenantMetadataQuery: () => [mockFetchTenantMetadata],
}));

// Mock RBAC slice
vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: () => ({}),
  updateRbacPermissions: vi.fn((permissions) => ({
    type: 'updateRbacPermissions',
    payload: permissions,
  })),
}));

// Mock model download hook
vi.mock('@/hooks/use-model-download', () => ({
  useModelDownload: () => ({
    isAvailable: false,
    state: { status: 'idle' },
    ollamaStatus: null,
    startDownload: vi.fn(),
    cancelDownload: vi.fn(),
    installOllama: vi.fn(),
    installFoundry: vi.fn(),
    checkStatus: vi.fn(),
    resetState: vi.fn(),
    isUsingFoundry: false,
    foundryModels: [],
    selectedFoundryModel: null,
    foundryStatus: null,
    onSelectFoundryModel: vi.fn(),
  }),
}));

// Mock learner mode switch
vi.mock('./learner-mode-switch', () => ({
  LearnerModeSwitch: () => <div data-testid="learner-mode-switch">Switch</div>,
}));

// Mock UserProfileDropdown
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  UserProfileDropdown: (props: any) => (
    <div data-testid="user-profile-dropdown">
      <span data-testid="tenant">{props.tenantKey}</span>
    </div>
  ),
}));

describe('UserProfile - Anonymous Mentor Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBillingURL.mockResolvedValue('');
    mockGetTopUpURL.mockResolvedValue('');
    mockGetUserSubscriptionPackage.mockResolvedValue(null);
    mockGetUserActiveAppLegacy.mockResolvedValue(null);
    mockBannerButtonTriggerCallback.mockReturnValue(vi.fn());
  });

  describe('anonymous mentor useEffect', () => {
    it('should fetch tenant metadata when tenant is not in userTenants', async () => {
      mockFetchTenantMetadata.mockReturnValue({
        unwrap: () => Promise.resolve({ platform_name: 'New Platform' }),
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(mockFetchTenantMetadata).toHaveBeenCalledWith({
          tenantKey: 'new-tenant',
        });
      });
    });

    it('should save new tenant after fetching metadata', async () => {
      mockFetchTenantMetadata.mockReturnValue({
        unwrap: () => Promise.resolve({ platform_name: 'New Platform' }),
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(mockSaveUserTenants).toHaveBeenCalled();
        expect(mockSaveCurrentTenant).toHaveBeenCalled();
      });
    });

    it('should handle metadata fetch error gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockFetchTenantMetadata.mockReturnValue({
        unwrap: () => Promise.reject(new Error('Fetch failed')),
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch tenant metadata',
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should use tenantKey as fallback when platform_name is missing', async () => {
      mockFetchTenantMetadata.mockReturnValue({
        unwrap: () => Promise.resolve({}),
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(mockSaveCurrentTenant).toHaveBeenCalledWith(
          expect.objectContaining({
            key: 'new-tenant',
            platform_name: 'new-tenant',
            name: 'new-tenant',
          }),
        );
      });
    });
  });
});
