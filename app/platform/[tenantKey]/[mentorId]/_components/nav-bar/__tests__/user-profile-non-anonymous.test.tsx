import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { UserProfile } from '../user-profile';

const { mockSaveCurrentTenant, mockSaveUserTenants, mockDispatch } = vi.hoisted(
  () => ({
    mockSaveCurrentTenant: vi.fn(),
    mockSaveUserTenants: vi.fn(),
    mockDispatch: vi.fn(),
  }),
);

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'new-tenant', mentorId: 'mentor-1' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
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

vi.mock('@/features/utils', () => ({
  getUserEmail: () => 'test@example.com',
  getUserName: () => 'testuser',
}));

vi.mock('@/lib/utils', () => ({
  handleLogout: vi.fn(),
  handleTenantSwitch: vi.fn(),
  isStripeActivated: vi.fn().mockReturnValue(false),
  onAccountDeleted: vi.fn(),
}));

vi.mock('@/hooks/subscription/subscription-flow-v2', () => ({
  MentorSubscriptionFlowV2: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => ({
    metadata: {},
    metadataLoaded: true,
  }),
  Tenant: {},
  useSubscriptionHandlerV2: () => ({
    getBillingURL: vi.fn().mockResolvedValue(''),
    getTopUpURL: vi.fn().mockResolvedValue(''),
    getUserSubscriptionPackage: vi.fn().mockResolvedValue(null),
    getUserActiveAppLegacy: vi.fn().mockResolvedValue(null),
    bannerButtonTriggerCallback: vi.fn().mockReturnValue(vi.fn()),
  }),
  SUBSCRIPTION_V2_TRIGGERS: {
    PRICING_MODAL: 'TRIGGER_PRICING_MODAL',
    TOP_UP_CREDIT: 'TRIGGER_TOP_UP_CREDIT',
    CONTACT_ADMIN: 'TRIGGER_CONTACT_ADMIN',
    BILLING_PAGE: 'TRIGGER_BILLING_PAGE',
  },
}));

vi.mock('@iblai/iblai-api', () => ({
  MentorVisibilityEnum: {
    VIEWABLE_BY_ANYONE: 'VIEWABLE_BY_ANYONE',
  },
  UserApp: {},
}));

// Mentor is NOT anonymous - allow_anonymous is false
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: () => ({
    data: {
      allow_anonymous: false,
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

vi.mock('@/features/tenants/api-slice', () => ({
  useLazyGetTenantMetadataQuery: () => [vi.fn()],
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: () => ({}),
  updateRbacPermissions: vi.fn((permissions) => ({
    type: 'updateRbacPermissions',
    payload: permissions,
  })),
}));

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

vi.mock('./learner-mode-switch', () => ({
  LearnerModeSwitch: () => <div data-testid="learner-mode-switch">Switch</div>,
}));

vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  UserProfileDropdown: (props: any) => (
    <div data-testid="user-profile-dropdown">
      <span data-testid="tenant">{props.tenantKey}</span>
    </div>
  ),
}));

describe('UserProfile - Non-Anonymous Mentor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not fetch tenant metadata when mentor does not allow anonymous chat', async () => {
    render(<UserProfile />);

    // Wait a tick to ensure the useEffect has run
    await waitFor(() => {
      expect(mockSaveCurrentTenant).not.toHaveBeenCalled();
      expect(mockSaveUserTenants).not.toHaveBeenCalled();
    });
  });

  it('should render without errors even when mentor is not anonymous', () => {
    const { getByTestId } = render(<UserProfile />);
    expect(getByTestId('user-profile-dropdown')).toBeInTheDocument();
  });
});
