import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserProfile } from '../user-profile';

const { mockHandleTenantSwitch } = vi.hoisted(() => ({
  mockHandleTenantSwitch: vi.fn(),
}));

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
  handleTenantSwitch: mockHandleTenantSwitch,
  isStripeActivated: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/subscription/subscription-flow-v2', () => ({
  MentorSubscriptionFlowV2: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useTenantMetadata: () => ({ metadata: {}, metadataLoaded: true }),
  Tenant: {},
  useSubscriptionHandlerV2: () => ({
    getUserSubscriptionPackage: vi.fn().mockResolvedValue(null),
    getUserActiveAppLegacy: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('@iblai/iblai-api', () => ({
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

// A mock that surfaces the tenant-switch callback so a test can trigger it the
// way the real dropdown does when the user picks a different tenant.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  UserProfileDropdown: (props: any) => (
    <button
      data-testid="switch-tenant"
      onClick={() => props.onTenantChange('new-tenant')}
    >
      switch
    </button>
  ),
}));

describe('UserProfile tenant switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('in an embed, posts the tenant switch to the parent instead of redirecting', () => {
    const postMessage = vi.fn();
    vi.spyOn(window, 'parent', 'get').mockReturnValue({
      postMessage,
    } as unknown as Window);

    render(<UserProfile embed />);
    fireEvent.click(screen.getByTestId('switch-tenant'));

    expect(postMessage).toHaveBeenCalledWith(
      { tenantSwitch: true, tenant: 'new-tenant' },
      '*',
    );
    expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
  });

  it('outside an embed, runs the normal web tenant switch', () => {
    const postMessage = vi.fn();
    vi.spyOn(window, 'parent', 'get').mockReturnValue({
      postMessage,
    } as unknown as Window);

    render(<UserProfile />);
    fireEvent.click(screen.getByTestId('switch-tenant'));

    expect(mockHandleTenantSwitch).toHaveBeenCalledWith('new-tenant');
    expect(postMessage).not.toHaveBeenCalled();
  });
});
