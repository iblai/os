import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
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

  // Historical note: earlier revisions of this file tested an anonymous-mentor
  // `useEffect` in `user-profile.tsx` that fetched tenant metadata and called
  // `saveCurrentTenant` / `saveUserTenants`. Commit f2d3d2d intentionally
  // commented that `useEffect` out because the tenant provider now owns the
  // flow — see the `// TODO: The tenant provider already handles...` block in
  // `user-profile.tsx`. The tests below now verify the opposite invariant:
  // `UserProfile` must NOT touch tenants itself while the commented-out block
  // is dormant. If it ever regresses to calling those spies, these assertions
  // will catch it.
  describe('anonymous mentor tenant sync is owned by the tenant provider', () => {
    it('does not call fetchTenantMetadata on mount when tenant is not in userTenants', async () => {
      mockFetchTenantMetadata.mockReturnValue({
        unwrap: () => Promise.resolve({ platform_name: 'New Platform' }),
      });

      render(<UserProfile />);

      // Give React a flush tick so any rogue useEffect has a chance to run
      await waitFor(() => {
        expect(screen.getByTestId('user-profile-dropdown')).toBeInTheDocument();
      });
      expect(mockFetchTenantMetadata).not.toHaveBeenCalled();
    });

    it('does not call saveUserTenants or saveCurrentTenant on mount', async () => {
      mockFetchTenantMetadata.mockReturnValue({
        unwrap: () => Promise.resolve({ platform_name: 'New Platform' }),
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-dropdown')).toBeInTheDocument();
      });
      expect(mockSaveUserTenants).not.toHaveBeenCalled();
      expect(mockSaveCurrentTenant).not.toHaveBeenCalled();
    });

    it('does not log "Failed to fetch tenant metadata" on mount (the fetch is never attempted)', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockFetchTenantMetadata.mockReturnValue({
        unwrap: () => Promise.reject(new Error('Fetch failed')),
      });

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-dropdown')).toBeInTheDocument();
      });
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        'Failed to fetch tenant metadata',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('renders the current tenant from useCurrentTenant without mutating it', async () => {
      render(<UserProfile />);

      // The mocked useCurrentTenant returns `{ key: 'new-tenant' }` in this
      // suite's setup — the component should render that verbatim without
      // the old useEffect ever replacing it with a "freshly-fetched" tenant.
      await waitFor(() => {
        expect(screen.getByTestId('tenant')).toHaveTextContent('new-tenant');
      });
      expect(mockSaveCurrentTenant).not.toHaveBeenCalled();
    });
  });
});
