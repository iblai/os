import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserProfile } from '../user-profile';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'existing-tenant', mentorId: 'mentor-1' }),
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
  usePathname: () => '/platform/existing-tenant/mentor-1',
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
  useIsAdmin: () => true,
  useIsVisiting: () => false,
  useUserIsStudent: () => false,
  useCurrentTenant: () => ({
    currentTenant: { key: 'other-tenant', is_admin: true, org: 'other-org' },
    saveCurrentTenant: vi.fn(),
  }),
  useUserTenants: () => ({
    userTenants: [
      { key: 'other-tenant', is_admin: true, org: 'other-org' },
      { key: 'existing-tenant', is_admin: true, org: 'existing-org' },
    ],
    saveUserTenants: vi.fn(),
  }),
  useVisitingTenant: () => ({ visitingTenant: null }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: any) =>
    selector({ topBanner: { topBannerOptions: {} }, rbac: {} }),
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
    defaultSupportPhoneNumber: () => '(571) 293-0242',
    enableSupportPhone: () => false,
    enableGradebookTab: () => false,
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
  isStripeActivated: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/subscription/subscription-flow-v2', () => ({
  MentorSubscriptionFlowV2: vi.fn().mockImplementation(() => ({})),
}));

// Tenant metadata now rides the tenants list via this local hook (raw object).
vi.mock('@/hooks/use-tenant-object-metadata', () => ({
  useTenantObjectMetadata: () => ({}),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  Tenant: {},
  useSubscriptionHandlerV2: () => ({
    getUserSubscriptionPackage: vi.fn().mockResolvedValue(null),
    getUserActiveAppLegacy: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('@iblai/iblai-api', () => ({
  TransportEnum: {
    SSE: 'sse',
    WEBSOCKET: 'websocket',
    STREAMABLE_HTTP: 'streamable_http',
  },
  MentorVisibilityEnum: { VIEWABLE_BY_ANYONE: 'VIEWABLE_BY_ANYONE' },
  PromptVisibilityEnum: {
    VIEWABLE_BY_TENANT_ADMINS: 'viewable_by_tenant_admins',
    VIEWABLE_BY_TENANT_STUDENTS: 'viewable_by_tenant_students',
    VIEWABLE_BY_ANYONE: 'viewable_by_anyone',
  },
  UserApp: {},
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: () => ({
    data: { allow_anonymous: true, mentor_visibility: 'VIEWABLE_BY_ANYONE' },
  }),
}));

vi.mock('@/features/tenants/api-slice', () => ({
  useLazyGetTenantMetadataQuery: () => [vi.fn()],
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: () => ({}),
  updateRbacPermissions: vi.fn(),
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
    <>
      <span data-testid="organizations-link">
        {String(props.showOrganizationsLink)}
      </span>
      <span data-testid="tenant-switcher">
        {String(props.showTenantSwitcher)}
      </span>
    </>
  ),
}));

// Picking an organization is the auth app's job now — this app only decides
// whether to offer the trip.
describe('UserProfile organization chooser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the chooser to a user who belongs to another organization', () => {
    render(<UserProfile />);

    expect(screen.getByTestId('organizations-link')).toHaveTextContent('true');
  });

  // An embed cannot make the trip itself — navigating its iframe would tear it
  // out of the host page — so the SDK hands the chooser's address to the host.
  // The entry is still offered.
  it('offers it in an embed too, where the host makes the trip', () => {
    render(<UserProfile embed />);

    expect(screen.getByTestId('organizations-link')).toHaveTextContent('true');
    expect(screen.getByTestId('tenant-switcher')).toHaveTextContent('true');
  });
});
