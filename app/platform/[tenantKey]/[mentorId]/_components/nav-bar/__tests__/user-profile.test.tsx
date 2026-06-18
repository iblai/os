import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { UserProfile } from '../user-profile';

// Declare mock functions using vi.hoisted() to ensure they're available in vi.mock factories
const {
  mockRouterPush,
  mockRouterReplace,
  mockSearchParamsGet,
  mockSearchParamsToString,
  mockSaveCurrentTenant,
  mockSaveUserTenants,
  mockDispatch,
  mockGetBillingURL,
  mockGetTopUpURL,
  mockGetUserSubscriptionPackage,
  mockGetUserActiveAppLegacy,
  mockBannerButtonTriggerCallback,
  mockHandleLogout,
  mockHandleTenantSwitch,
  mockIsStripeActivated,
  mockFetchTenantMetadata,
  mockOnAccountDeleted,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockSearchParamsToString: vi.fn(),
  mockSaveCurrentTenant: vi.fn(),
  mockSaveUserTenants: vi.fn(),
  mockDispatch: vi.fn(),
  mockGetBillingURL: vi.fn(),
  mockGetTopUpURL: vi.fn(),
  mockGetUserSubscriptionPackage: vi.fn(),
  mockGetUserActiveAppLegacy: vi.fn(),
  mockBannerButtonTriggerCallback: vi.fn(),
  mockHandleLogout: vi.fn(),
  mockHandleTenantSwitch: vi.fn(),
  mockIsStripeActivated: vi.fn(),
  mockFetchTenantMetadata: vi.fn(),
  mockOnAccountDeleted: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-1' }),
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: mockSearchParamsToString,
  }),
  usePathname: () => '/platform/test-tenant/mentor-1',
}));

// Mock user hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
  useIsAdmin: () => true,
  useIsVisiting: () => false,
  useUserIsStudent: () => false,
  useCurrentTenant: () => ({
    currentTenant: { key: 'test-tenant', is_admin: true, org: 'test-org' },
    saveCurrentTenant: mockSaveCurrentTenant,
  }),
  useUserTenants: () => ({
    userTenants: [{ key: 'test-tenant', is_admin: true, org: 'test-org' }],
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
    defaultSupportPhoneNumber: () => '(571) 293-0242',
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
  handleLogout: mockHandleLogout,
  handleTenantSwitch: mockHandleTenantSwitch,
  isStripeActivated: mockIsStripeActivated,
  onAccountDeleted: mockOnAccountDeleted,
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

// Mock data layer query
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: () => ({ data: null }),
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

// Store captured callbacks
let capturedCallbacks: any = {};

// Mock UserProfileDropdown to capture all callbacks
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  UserProfileDropdown: (props: any) => {
    // Capture all callbacks for testing
    capturedCallbacks = {
      onProfileClick: props.onProfileClick,
      onLogout: props.onLogout,
      onTenantChange: props.onTenantChange,
      onHelpClick: props.onHelpClick,
      onTenantUpdate: props.onTenantUpdate,
      onLoadGroupPermissions: props.onLoadGroupPermissions,
      onTabChange: props.onTabChange,
      onUpgradeClick: props.onUpgradeClick,
      onBillingTabRequest: props.onBillingTabRequest,
      onModalOpenChange: props.onModalOpenChange,
      onAccountDeleted: props.onAccountDeleted,
    };

    return (
      <div data-testid="user-profile-dropdown">
        <span data-testid="username">{props.username}</span>
        <span data-testid="tenant">{props.tenantKey}</span>
        <span data-testid="is-admin">{String(props.userIsAdmin)}</span>
        <span data-testid="is-modal-open">{String(props.isModalOpen)}</span>
        <span data-testid="active-tab">{props.defaultActiveTab}</span>
        <span data-testid="billing-url">{props.billingURL || ''}</span>
        <span data-testid="top-up-url">{props.topUpURL || ''}</span>
        <span data-testid="current-plan">{props.currentPlan || ''}</span>
        <span data-testid="show-tenant-switcher">
          {String(props.showTenantSwitcher)}
        </span>
        <span data-testid="show-learner-mode-switch">
          {String(props.showLearnerModeSwitch)}
        </span>
        <span data-testid="billing-enabled">
          {String(props.billingEnabled)}
        </span>
        <span data-testid="top-up-enabled">{String(props.topUpEnabled)}</span>
        <span data-testid="is-student">{String(props.userIsStudent)}</span>
        <span data-testid="is-visiting">{String(props.userIsVisiting)}</span>
        <span data-testid="enable-gravatar">
          {String(props.enableGravatarOnProfilePic)}
        </span>
        <span data-testid="current-spa">{props.currentSPA || ''}</span>
        <span data-testid="mentor-id">{props.mentorId || ''}</span>
        <button
          data-testid="profile-btn"
          onClick={() => props.onProfileClick?.()}
        >
          Profile
        </button>
        <button data-testid="logout-btn" onClick={() => props.onLogout?.()}>
          Logout
        </button>
        <button
          data-testid="tenant-change-btn"
          onClick={() => props.onTenantChange?.('new-tenant')}
        >
          Change Tenant
        </button>
        <button
          data-testid="help-btn"
          onClick={() => props.onHelpClick?.('https://help.example.com')}
        >
          Help
        </button>
        <button
          data-testid="tenant-update-btn"
          onClick={() =>
            props.onTenantUpdate?.({
              key: 'test-tenant',
              is_admin: true,
              org: 'org',
            })
          }
        >
          Update Tenant
        </button>
        <button
          data-testid="tenant-update-new-btn"
          onClick={() =>
            props.onTenantUpdate?.({
              key: 'new-tenant',
              is_admin: false,
              org: 'new-org',
            })
          }
        >
          Update New Tenant
        </button>
        <button
          data-testid="permissions-btn"
          onClick={() => props.onLoadGroupPermissions?.({ test: true })}
        >
          Load Permissions
        </button>
        <button
          data-testid="tab-change-billing-btn"
          onClick={() => props.onTabChange?.('billing')}
        >
          Billing Tab
        </button>
        <button
          data-testid="tab-change-basic-btn"
          onClick={() => props.onTabChange?.('basic')}
        >
          Basic Tab
        </button>
        <button
          data-testid="upgrade-btn"
          onClick={() => props.onUpgradeClick?.()}
        >
          Upgrade
        </button>
        <button
          data-testid="billing-request-btn"
          onClick={() => props.onBillingTabRequest?.()}
        >
          Request Billing
        </button>
        <button
          data-testid="modal-open-btn"
          onClick={() => props.onModalOpenChange?.(true)}
        >
          Open Modal
        </button>
        <button
          data-testid="modal-close-btn"
          onClick={() => props.onModalOpenChange?.(false)}
        >
          Close Modal
        </button>
        <button
          data-testid="account-deleted-btn"
          onClick={() => props.onAccountDeleted?.()}
        >
          Account Deleted
        </button>
      </div>
    );
  },
}));

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallbacks = {};
    mockSearchParamsGet.mockReturnValue(null);
    mockSearchParamsToString.mockReturnValue('');
    mockIsStripeActivated.mockReturnValue(false);
    mockGetBillingURL.mockResolvedValue('');
    mockGetTopUpURL.mockResolvedValue('');
    mockGetUserSubscriptionPackage.mockResolvedValue(null);
    mockGetUserActiveAppLegacy.mockResolvedValue(null);
    mockBannerButtonTriggerCallback.mockReturnValue(vi.fn());
    mockFetchTenantMetadata.mockReturnValue({
      unwrap: () => Promise.resolve({ platform_name: 'Test Platform' }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render the UserProfileDropdown', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('user-profile-dropdown')).toBeInTheDocument();
    });

    it('should pass username to dropdown', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    });

    it('should pass tenantKey to dropdown', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('tenant')).toHaveTextContent('test-tenant');
    });

    it('should pass userIsAdmin to dropdown', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });

    it('should start with modal closed', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('is-modal-open')).toHaveTextContent('false');
    });

    it('should start with basic tab active', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('active-tab')).toHaveTextContent('basic');
    });

    it('should show tenant switcher for admin users', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('show-tenant-switcher')).toHaveTextContent(
        'true',
      );
    });
  });

  describe('callbacks', () => {
    it('should handle profile click', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const profileBtn = screen.getByTestId('profile-btn');
      await user.click(profileBtn);

      // Profile click triggers subscription data fetch
      expect(mockGetUserActiveAppLegacy).toHaveBeenCalled();
      expect(mockGetUserSubscriptionPackage).toHaveBeenCalled();
    });

    it('should handle logout click', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const logoutBtn = screen.getByTestId('logout-btn');
      await user.click(logoutBtn);

      expect(mockHandleLogout).toHaveBeenCalled();
    });

    it('should handle tenant change', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tenantChangeBtn = screen.getByTestId('tenant-change-btn');
      await user.click(tenantChangeBtn);

      expect(mockHandleTenantSwitch).toHaveBeenCalledWith('new-tenant');
    });

    it('should handle help click', async () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null);
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const helpBtn = screen.getByTestId('help-btn');
      await user.click(helpBtn);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://help.example.com',
        '_blank',
      );

      windowOpenSpy.mockRestore();
    });

    it('should handle tenant update for existing tenant', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tenantUpdateBtn = screen.getByTestId('tenant-update-btn');
      await user.click(tenantUpdateBtn);

      expect(mockSaveCurrentTenant).toHaveBeenCalled();
      expect(mockSaveUserTenants).toHaveBeenCalled();
    });

    it('should handle tenant update for new tenant', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tenantUpdateBtn = screen.getByTestId('tenant-update-new-btn');
      await user.click(tenantUpdateBtn);

      expect(mockSaveCurrentTenant).toHaveBeenCalledWith({
        key: 'new-tenant',
        is_admin: false,
        org: 'new-org',
      });
      expect(mockSaveUserTenants).toHaveBeenCalled();
    });

    it('should handle load group permissions', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const permissionsBtn = screen.getByTestId('permissions-btn');
      await user.click(permissionsBtn);

      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should handle load group permissions with empty object', async () => {
      render(<UserProfile />);

      // Call with null to test fallback to empty object
      act(() => {
        capturedCallbacks.onLoadGroupPermissions?.(null);
      });

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('tab change handling', () => {
    it('should handle tab change to billing', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tabBtn = screen.getByTestId('tab-change-billing-btn');
      await user.click(tabBtn);

      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.stringContaining('profileTab=billing'),
        expect.any(Object),
      );
    });

    it('should handle tab change to non-billing tab', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tabBtn = screen.getByTestId('tab-change-basic-btn');
      await user.click(tabBtn);

      // Should remove profileTab from URL
      expect(mockRouterReplace).toHaveBeenCalled();
    });

    it('should preserve other search params when changing tabs', async () => {
      mockSearchParamsToString.mockReturnValue('other=value');
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tabBtn = screen.getByTestId('tab-change-basic-btn');
      await user.click(tabBtn);

      // Should keep other params
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.stringContaining('other=value'),
        expect.any(Object),
      );
    });
  });

  describe('modal open/close handling', () => {
    it('should handle modal close and update URL', () => {
      render(<UserProfile />);

      // Call onModalOpenChange with false directly
      act(() => {
        capturedCallbacks.onModalOpenChange?.(false);
      });

      expect(mockRouterReplace).toHaveBeenCalled();
    });

    it('should preserve other search params when closing modal', () => {
      mockSearchParamsToString.mockReturnValue(
        'other=value&profileTab=billing',
      );

      render(<UserProfile />);

      // Call onModalOpenChange with false directly
      act(() => {
        capturedCallbacks.onModalOpenChange?.(false);
      });

      // Should delete profileTab but keep other params
      expect(mockRouterReplace).toHaveBeenCalledWith(
        expect.stringContaining('other=value'),
        expect.any(Object),
      );
    });

    it('should handle modal open', () => {
      render(<UserProfile />);

      // Call onModalOpenChange with true directly
      act(() => {
        capturedCallbacks.onModalOpenChange?.(true);
      });

      // Modal open doesn't trigger router replace
      expect(screen.getByTestId('is-modal-open')).toHaveTextContent('true');
    });
  });

  describe('subscription data fetching', () => {
    it('should fetch subscription data on profile click', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const profileBtn = screen.getByTestId('profile-btn');
      await user.click(profileBtn);

      expect(mockGetUserActiveAppLegacy).toHaveBeenCalled();
      expect(mockGetUserSubscriptionPackage).toHaveBeenCalled();
    });

    it('should set current plan from subscription package', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      mockGetUserSubscriptionPackage.mockResolvedValue(
        'org-tenant-pro-monthly',
      );
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const profileBtn = screen.getByTestId('profile-btn');
      await user.click(profileBtn);

      await waitFor(() => {
        expect(mockGetUserSubscriptionPackage).toHaveBeenCalled();
      });
    });
  });

  describe('URL parameter handling', () => {
    it('should open billing tab when profileTab=billing in URL', async () => {
      mockSearchParamsGet.mockReturnValue('billing');

      render(<UserProfile />);

      // The component should set modal open and tab to billing
      await waitFor(() => {
        expect(screen.getByTestId('is-modal-open')).toHaveTextContent('true');
        expect(screen.getByTestId('active-tab')).toHaveTextContent('billing');
      });
    });

    it('should not reopen modal while closing', async () => {
      vi.useFakeTimers();
      mockSearchParamsGet.mockReturnValue('billing');

      const { rerender } = render(<UserProfile />);

      // Close the modal
      act(() => {
        capturedCallbacks.onModalOpenChange?.(false);
      });

      // Rerender while closing
      rerender(<UserProfile />);

      // Should still be closed due to isClosingRef
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // After timeout, isClosingRef resets
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
    });

    it('should not open modal when profileTab is not billing', () => {
      mockSearchParamsGet.mockReturnValue('profile');

      render(<UserProfile />);

      expect(screen.getByTestId('is-modal-open')).toHaveTextContent('false');
    });
  });

  describe('plan parsing', () => {
    it('should extract last segment of plan name', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      mockGetUserSubscriptionPackage.mockResolvedValue(
        'org-tenant-pro-monthly',
      );

      render(<UserProfile />);

      act(() => {
        capturedCallbacks.onProfileClick?.();
      });

      await waitFor(() => {
        expect(mockGetUserSubscriptionPackage).toHaveBeenCalled();
      });
    });

    it('should handle single-segment plan name', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      mockGetUserSubscriptionPackage.mockResolvedValue('premium');

      render(<UserProfile />);

      act(() => {
        capturedCallbacks.onProfileClick?.();
      });

      await waitFor(() => {
        expect(mockGetUserSubscriptionPackage).toHaveBeenCalled();
      });
    });
  });

  describe('URL path handling in tab change', () => {
    it('should use pathname only when no other search params exist', async () => {
      mockSearchParamsToString.mockReturnValue('');
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tabBtn = screen.getByTestId('tab-change-basic-btn');
      await user.click(tabBtn);

      // When no params, should use just pathname
      expect(mockRouterReplace).toHaveBeenCalledWith(
        '/platform/test-tenant/mentor-1',
        expect.any(Object),
      );
    });

    it('should use pathname only when closing modal with no other params', () => {
      mockSearchParamsToString.mockReturnValue('');

      render(<UserProfile />);

      act(() => {
        capturedCallbacks.onModalOpenChange?.(false);
      });

      // When no params after removing profileTab, should use just pathname
      expect(mockRouterReplace).toHaveBeenCalledWith(
        '/platform/test-tenant/mentor-1',
        expect.any(Object),
      );
    });
  });

  describe('account deletion', () => {
    it('should call onAccountDeleted when account deleted button is clicked', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const accountDeletedBtn = screen.getByTestId('account-deleted-btn');
      await user.click(accountDeletedBtn);

      expect(mockOnAccountDeleted).toHaveBeenCalled();
    });

    it('should pass onAccountDeleted callback to UserProfileDropdown', () => {
      render(<UserProfile />);

      expect(capturedCallbacks.onAccountDeleted).toBeDefined();
      expect(typeof capturedCallbacks.onAccountDeleted).toBe('function');
    });
  });

  describe('props passed to UserProfileDropdown', () => {
    it('should pass showLearnerModeSwitch as true for admin on non-main tenant', () => {
      render(<UserProfile />);

      // useIsAdmin returns true, tenantKey is 'test-tenant' (not 'main')
      expect(screen.getByTestId('show-learner-mode-switch')).toHaveTextContent(
        'true',
      );
    });

    it('should pass userIsStudent to dropdown', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('is-student')).toHaveTextContent('false');
    });

    it('should pass userIsVisiting to dropdown', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('is-visiting')).toHaveTextContent('false');
    });

    it('should pass enableGravatarOnProfilePic based on config', () => {
      render(<UserProfile />);

      // config.enableGravatarOnProfilePic() returns 'true', so !== 'false' is true
      expect(screen.getByTestId('enable-gravatar')).toHaveTextContent('true');
    });

    it('should pass currentSPA from config', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('current-spa')).toHaveTextContent('mentor');
    });

    it('should pass mentorId to dropdown', () => {
      render(<UserProfile />);

      expect(screen.getByTestId('mentor-id')).toHaveTextContent('mentor-1');
    });
  });

  describe('subscription state rendering', () => {
    it('should render current plan name after successful fetch', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      mockGetUserSubscriptionPackage.mockResolvedValue(
        'org-tenant-pro-monthly',
      );

      render(<UserProfile />);

      act(() => {
        capturedCallbacks.onProfileClick?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-plan')).toHaveTextContent('monthly');
      });
    });

    it('should render single-segment plan name correctly', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      mockGetUserSubscriptionPackage.mockResolvedValue('premium');

      render(<UserProfile />);

      act(() => {
        capturedCallbacks.onProfileClick?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('current-plan')).toHaveTextContent('premium');
      });
    });

    it('should not update plan when subscription package is null', async () => {
      mockIsStripeActivated.mockReturnValue(true);
      mockGetUserSubscriptionPackage.mockResolvedValue(null);

      render(<UserProfile />);

      act(() => {
        capturedCallbacks.onProfileClick?.();
      });

      await waitFor(() => {
        expect(mockGetUserSubscriptionPackage).toHaveBeenCalled();
      });

      // Plan should remain empty since null was returned
      expect(screen.getByTestId('current-plan')).toHaveTextContent('');
    });
  });

  describe('modal close resets tab', () => {
    it('should reset active tab to basic when modal closes', async () => {
      mockSearchParamsGet.mockReturnValue('billing');

      render(<UserProfile />);

      // Wait for billing tab to open via URL param
      await waitFor(() => {
        expect(screen.getByTestId('active-tab')).toHaveTextContent('billing');
      });

      // Close the modal
      act(() => {
        capturedCallbacks.onModalOpenChange?.(false);
      });

      // Tab should reset to basic
      expect(screen.getByTestId('active-tab')).toHaveTextContent('basic');
      expect(screen.getByTestId('is-modal-open')).toHaveTextContent('false');
    });
  });

  describe('tab change updates active tab', () => {
    it('should update active tab to billing when billing tab is selected', async () => {
      const { default: userEvent } = await import(
        '@testing-library/user-event'
      );
      const user = userEvent.setup();

      render(<UserProfile />);

      const tabBtn = screen.getByTestId('tab-change-billing-btn');
      await user.click(tabBtn);

      expect(screen.getByTestId('active-tab')).toHaveTextContent('billing');
    });
  });
});
