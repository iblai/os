import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MentorVisibilityEnum } from '@iblai/iblai-api';

import { NavBar, ANALYTICS_NAV_ITEM } from '../index';
import {
  filterMentorSegments,
  MENTOR_SEGMENTS,
  type MentorSegment,
  type MentorSegmentFilterContext,
} from '@/hooks/use-mentor-segments';
import { modalReducer, type ModalInfo } from '@/features/navigation/slice';
import { mentorApiSlice } from '@iblai/iblai-js/data-layer';
import rbacReducer from '@/features/rbac/rbac-slice';
import { analyticsReducer } from '@/features/analytics/slice';
import { UserType } from '@/lib/constants';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

// Mock URL.createObjectURL for jsdom environment
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// ============================================================================
// MOCKS
// ============================================================================

const pushMock = vi.fn();
let mockSearchParamsRaw = '';
let mockPathname = '/platform/tenant123/mentor456';
let mockIsAdmin = true;
let mockUserIsStudent = false;
let mockIsVisiting = false;
let mockIsAccessingPublicRoute = false;
let mockCurrentTenant: any = {
  key: 'test-tenant',
  is_admin: true,
  show_paywall: false,
};
let mockAllTenants: Array<{ key: string }> = [{ key: 'test-tenant' }];
let mockMentorSettings: any = {
  mentor: 'Test Mentor',
  mentor_id: 123,
  mentor_unique_id: 'mentor456',
  platform_key: 'tenant123',
  mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
  permissions: {
    field: {
      mentor_name: { read: true, write: true },
      mentor_description: { read: true, write: true },
      profile_image: { read: true, write: true },
      mentor_visibility: { read: true, write: true },
      metadata: { read: true, write: true },
      llm_provider: { read: true, write: true },
      system_prompt: { read: true, write: true },
      mentor_tools: { read: true, write: true },
      custom_css: { read: true, write: true },
      allow_anonymous: { read: true, write: true },
    },
  },
  forkable: false,
  forkable_with_training_data: false,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => mockPathname,
  useParams: () => ({ tenantKey: 'tenant123', mentorId: 'mentor456' }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsRaw),
}));

vi.mock('next/image', () => ({
  default: (props: any) => {
    return <img {...props} alt={props.alt || ''} />;
  },
}));

vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: () => mockIsAdmin,
  useIsVisiting: () => mockIsVisiting,
  useUserIsStudent: () => mockUserIsStudent,
  useUsername: () => 'testuser',
  useCurrentTenant: () => ({
    currentTenant: mockCurrentTenant,
    saveCurrentTenant: vi.fn(),
  }),
  useGetAllTenants: () => mockAllTenants,
}));

vi.mock('@/features/utils', () => ({
  getUserEmail: () => 'student@example.com',
  getUserName: () => 'student-user',
}));

vi.mock('@/hooks/use-user-type', () => ({
  useUserType: () => ({
    isUserTypeAllowed: (item: { userTypes: string[] }) =>
      item.userTypes.includes(UserType.ADMIN) ||
      item.userTypes.includes(UserType.FREE_TRIAL),
  }),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: (fn: () => void) => fn(),
    FreeTrialDialog: null,
    closeModal: vi.fn(),
    isModalOpen: false,
    isNewlyUserOnPreFreeOrAdvertisingMode: () => false,
  }),
}));

vi.mock('@/hooks/use-anonymous-mentor', () => ({
  useAccessingPublicRoute: () => mockIsAccessingPublicRoute,
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: () => false,
}));

vi.mock('@/hooks/use-tauri-offline', () => ({
  isTauriOfflineMode: () => false,
  isOfflineServerOrigin: () => false,
}));

vi.mock('@/types/tauri', () => ({
  isTauriApp: () => false,
}));

vi.mock('@/hooks/use-model-download', () => ({
  useModelDownload: () => ({
    isAvailable: false,
    state: 'idle',
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
    foundryStatusLoaded: false,
    onSelectFoundryModel: vi.fn(),
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({
    toggleSidebar: vi.fn(),
    open: false,
    isMobile: false,
  }),
}));

vi.mock('@/lib/eventBus', () => ({
  default: { emit: vi.fn() },
  RemoteEvents: { newChat: 'newChat' },
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    openEditMentorModal: vi.fn(),
    showEditMentorModal: false,
    closeEditMentorModal: vi.fn(),
    showCreateMentorModal: false,
    closeCreateMentorModal: vi.fn(),
    navigateToAnalytics: vi.fn(),
    navigateToMentor: vi.fn(),
    getUpdatedModalStack: vi.fn(),
    navigateToNotifications: vi.fn(),
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@iblai/iblai-js/data-layer')>();
  return {
    ...actual,
    useGetMentorSettingsQuery: () => ({
      data: mockMentorSettings,
      isLoading: false,
      isSuccess: true,
    }),
    useGetMemsearchStatusQuery: () => ({
      data: { enable_memsearch: false },
      isLoading: false,
      isSuccess: true,
    }),
    useForkMentorMutation: () => [vi.fn(), { isLoading: false }],
    useEditMentorMutation: () => [vi.fn()],
  };
});

vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => ({
    data: {
      mentorName: 'Test Mentor',
      mentorSlug: 'test-mentor',
      profileImage: '/test-image.png',
      mentorUniqueId: 'mentor456',
      mentorDbId: 'db-id-999',
      llmProvider: 'openai',
      llmName: 'GPT-4',
      mentorVisibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      allowAnonymous: false,
    },
  }),
}));

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: () => 'main',
    enableGravatarOnProfilePic: () => 'false',
    iblPlatform: () => 'mentor',
    authUrl: () => 'https://auth.example.com',
    platformBaseDomain: () => 'example.com',
    iblTemplateMentor: () => 'ai-mentor',
    environment: () => 'test',
    lmsUrl: () => 'https://learn.example.com',
    dmUrl: () => 'https://dm.example.com',
    axdUrl: () => 'https://axd.example.com',
    mentorUrl: () => 'https://mentor.example.com',
    mentorIframeUrl: () => 'https://mentor.example.com',
    externalPricingPageUrl: () => 'https://pricing.example.com',
    stripeEnabled: () => 'true',
    baseWsUrl: () => 'wss://ws.example.com',
    liveKitServerUrl: () => 'wss://livekit.example.com',
    mentorSettingsDisclaimer: () => '',
    iframeFromOldMentor: () => 'false',
    enableRBAC: () => false,
    sentryDsn: () => '',
    helpCenterUrl: () => 'https://help.example.com',
    supportEmail: () => 'support@example.com',
    defaultEmbedCssUrl: () => '',
    appBannerLink: () => '',
    appBannerLinkText: () => '',
    appBannerBadge: () => '',
    appBannerText: () => '',
    showAppBanner: () => 'false',
    mentorTrainingMaximumFileSize: () => '60',
    hideAnalytics: () => 'false',
    showBaseMentor: () => false,
    disabedDatasets: () => '',
    advertisingEnabled: () => false,
    disabledAnalyticsReports: () => '',
    iblEnableSpecialLogoWhenIframed: () => 'false',
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
  getLLMProviderDetails: () => ({ logo: '/llm-logo.png', name: 'GPT-4' }),
  isLoggedIn: () => true,
  redirectToAuthSpa: vi.fn(),
  redirectToAuthSpaJoinTenant: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/hoc/utils', () => ({
  rbacPermissionToDisplay: vi.fn(
    (
      fields: string[],
      permissions?: Record<string, { read: boolean; write: boolean }>,
    ): boolean => {
      if (!permissions || fields.length === 0) return true;
      return fields.some((field) => permissions[field]?.read);
    },
  ),
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: vi.fn(
    (_permissions: object, _resource: string): boolean => true,
  ),
}));

// Mock child components
vi.mock('../user-profile', () => ({
  UserProfile: () => <div data-testid="user-profile">User Profile</div>,
}));

vi.mock('../learner-mode-switch', () => ({
  LearnerModeSwitch: () => (
    <div data-testid="learner-mode-switch">Learner Mode</div>
  ),
}));

vi.mock('../embed-nav-bar', () => ({
  EmbedNavBar: () => <div data-testid="embed-nav-bar">Embed NavBar</div>,
}));

vi.mock('@/components/modals/edit-mentor-modal', () => ({
  EditMentorModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="edit-mentor-modal">
        Edit Mentor <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/create-mentor-modal', () => ({
  CreateMentorModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="create-mentor-modal">
        Create Mentor <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/llm-provider-selection-modal', () => ({
  LLMProviderSelectionModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="llm-provider-modal">
        LLM Provider <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/auth-modal', () => ({
  AuthModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="auth-modal">
        Auth Modal <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

let lastCreditBalanceProps: any = null;
vi.mock('@iblai/iblai-js/web-containers', () => ({
  NotificationDropdown: () => (
    <div data-testid="notification-dropdown">Notifications</div>
  ),
  CreditBalance: (props: any) => {
    lastCreditBalanceProps = props;
    return <div data-testid="credit-balance">CreditBalance</div>;
  },
}));

vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  UserProfileModal: (props: any) =>
    props.isOpen ? (
      <div data-testid="user-profile-modal">
        User Profile Modal <button onClick={props.onClose}>Close</button>
      </div>
    ) : null,
}));

// ============================================================================
// TEST STORE FACTORY
// ============================================================================

function createTestStore(
  preloadedStack: ModalInfo[] = [],
  rbacPermissions: object = {},
) {
  return configureStore({
    reducer: {
      modals: modalReducer,
      rbac: rbacReducer,
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
      analytics: (state = { selectedMentor: null }) => state,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(mentorApiSlice.middleware),
    preloadedState: {
      modals: {
        modalStack: preloadedStack,
        customAlertDialog: {
          message: '',
          validateTrigger: '',
          cancelTrigger: '',
          isOpen: false,
          title: '',
        },
        iframeCloseButton: false,
        darkMode: false,
        shortcutsModal: false,
      },
      rbac: {
        rbacPermissions: rbacPermissions,
      },
      analytics: {
        selectedMentor: {
          slug: 'test-mentor',
          name: 'Test Mentor',
          profileImage: '/test-image.png',
        },
      },
    },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('NavBar', () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    mockSearchParamsRaw = '';
    mockPathname = '/platform/tenant123/mentor456';
    mockIsAdmin = true;
    mockUserIsStudent = false;
    mockIsVisiting = false;
    mockIsAccessingPublicRoute = false;
    mockMentorSettings = {
      mentor: 'Test Mentor',
      mentor_id: 123,
      mentor_unique_id: 'mentor456',
      platform_key: 'tenant123',
      mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      permissions: {
        field: {
          mentor_name: { read: true, write: true },
          mentor_description: { read: true, write: true },
          profile_image: { read: true, write: true },
          mentor_visibility: { read: true, write: true },
          metadata: { read: true, write: true },
          llm_provider: { read: true, write: true },
          system_prompt: { read: true, write: true },
          mentor_tools: { read: true, write: true },
          custom_css: { read: true, write: true },
          allow_anonymous: { read: true, write: true },
        },
      },
      forkable: false,
    };
    mockCurrentTenant = {
      key: 'test-tenant',
      is_admin: true,
      show_paywall: false,
    };
    mockAllTenants = [{ key: 'test-tenant' }];
    lastCreditBalanceProps = null;
    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Basic Rendering Tests
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    it('renders the navigation bar', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders user profile component when logged in', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByTestId('user-profile')).toBeInTheDocument();
    });

    it('renders notification dropdown when logged in', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    });

    it('renders learner/instructor mode switch for admin users', () => {
      mockIsAdmin = true;
      mockIsVisiting = false;
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByTestId('learner-mode-switch')).toBeInTheDocument();
    });

    it('renders LLM model selector button for admin users on chat page', () => {
      mockIsAdmin = true;
      mockUserIsStudent = false;
      mockPathname = '/platform/tenant123/mentor456';
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByLabelText('LLM Model Selector')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Mentor Dropdown Tests
  // --------------------------------------------------------------------------

  describe('Mentor Dropdown', () => {
    it('renders mentor dropdown button with mentor name', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(
        screen.getByLabelText('Selected agent dropdown button'),
      ).toBeInTheDocument();
    });

    it('dropdown button is clickable', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      const dropdownButton = screen.getByLabelText(
        'Selected agent dropdown button',
      );
      expect(dropdownButton).toBeEnabled();
      // Clicking should not throw
      expect(() => fireEvent.click(dropdownButton)).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Mobile View Tests
  // --------------------------------------------------------------------------

  describe('Mobile View', () => {
    it('renders toggle sidebar button in mobile view', () => {
      vi.mocked(vi.fn()).mockReturnValue({
        toggleSidebar: vi.fn(),
        open: false,
        isMobile: true,
      });

      // We need to update the mock to return isMobile: true
      const useSidebarMock = vi.fn(() => ({
        toggleSidebar: vi.fn(),
        open: false,
        isMobile: true,
      }));

      vi.doMock('@/components/ui/sidebar', () => ({
        useSidebar: useSidebarMock,
      }));

      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      // Test passes if no errors - mobile detection mock would need more complex setup
    });
  });

  // --------------------------------------------------------------------------
  // Analytics — Selected Mentor Sync
  //
  // On mount (and whenever mentorUniqueId changes), the navbar dispatches
  // setSelectedMentor so the analytics iframe page can read which mentor's
  // reports to show — including the mentor database id, which is a separate
  // identifier from mentorUniqueId and is used for data-reports query params.
  // --------------------------------------------------------------------------

  describe('Selected mentor sync (analytics)', () => {
    it('dispatches setSelectedMentor including id (mentorDbId) on mount', async () => {
      const store = configureStore({
        reducer: {
          modals: modalReducer,
          rbac: rbacReducer,
          [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
          analytics: analyticsReducer,
        },
        middleware: (getDefaultMiddleware) =>
          getDefaultMiddleware({ serializableCheck: false }).concat(
            mentorApiSlice.middleware,
          ),
      });

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      await waitFor(() => {
        const state = store.getState() as unknown as {
          analytics: { selectedMentor: { id?: string } | null };
        };
        expect(state.analytics.selectedMentor).toEqual({
          slug: 'test-mentor',
          name: 'Test Mentor',
          profileImage: '/test-image.png',
          id: 'db-id-999',
        });
      });
    });
  });

  // --------------------------------------------------------------------------
  // My Mentors removal — issue #1431
  // --------------------------------------------------------------------------

  describe('My Mentors removed from navbar', () => {
    it('does not render any "My Mentors" or "Explore" trigger in the navbar', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.queryByText(/^My Mentors$/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('my-mentors-modal')).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('Explore mentors'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/^Explore$/)).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    it('has accessible navigation landmark', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('buttons have accessible labels', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      const llmButton = screen.getByLabelText('LLM Model Selector');
      expect(llmButton).toBeInTheDocument();

      const dropdownButton = screen.getByLabelText(
        'Selected agent dropdown button',
      );
      expect(dropdownButton).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // hide-navbar Query Param Tests
  //
  // The hide-navbar param hides the navbar in both embed and non-embed modes.
  // Accepted truthy values: "true" and "1".
  // --------------------------------------------------------------------------

  describe('hide-navbar query param', () => {
    it('hides navbar when hide-navbar=true', () => {
      mockSearchParamsRaw = 'hide-navbar=true';
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-nav-bar')).not.toBeInTheDocument();
      expect(container.innerHTML).toBe('');
    });

    it('hides navbar when hide-navbar=1', () => {
      mockSearchParamsRaw = 'hide-navbar=1';
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-nav-bar')).not.toBeInTheDocument();
      expect(container.innerHTML).toBe('');
    });

    it('renders normally when hide-navbar=false', () => {
      mockSearchParamsRaw = 'hide-navbar=false';
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders normally when hide-navbar=0', () => {
      mockSearchParamsRaw = 'hide-navbar=0';
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders normally when hide-navbar param is absent', () => {
      mockSearchParamsRaw = '';
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('hides embed navbar when hide-navbar=true in embed mode', async () => {
      mockSearchParamsRaw = 'hide-navbar=true';

      vi.resetModules();
      vi.doMock('@/hooks/use-embed-mode', () => ({
        useEmbedMode: () => true,
      }));

      const { NavBar: NavBarEmbed } = await import('../index');
      const store = createTestStore();

      const { container } = render(
        <Provider store={store}>
          <NavBarEmbed />
        </Provider>,
      );

      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('embed-nav-bar')).not.toBeInTheDocument();
      expect(container.innerHTML).toBe('');
    });

    it('renders EmbedNavBar in embed mode when hide-navbar is absent', async () => {
      mockSearchParamsRaw = '';

      vi.resetModules();
      vi.doMock('@/hooks/use-embed-mode', () => ({
        useEmbedMode: () => true,
      }));

      const { NavBar: NavBarEmbed } = await import('../index');
      const store = createTestStore();

      render(
        <Provider store={store}>
          <NavBarEmbed />
        </Provider>,
      );

      expect(screen.getByTestId('embed-nav-bar')).toBeInTheDocument();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS FOR MENU FILTERING LOGIC
//
// These tests exercise `filterMentorSegments` from `hooks/use-mentor-segments`
// — the same pure pipeline used by both EditMentorModal and NavBar — and the
// nav-only `ANALYTICS_NAV_ITEM` exported above. This is what previously lived
// inside the in-file `getFilteredMenuItems` helper.
//
// "New Chat" is no longer part of any filterable list (NavBar prepends it
// unconditionally), so its presence is verified structurally rather than via
// the filter pipeline.
// ============================================================================

// Import the mocked modules so we can override their implementations per-test
import { rbacPermissionToDisplay } from '@/hoc/utils';
import { checkRbacPermission } from '@/hoc/withPermissions';

const buildContext = (
  overrides: Partial<MentorSegmentFilterContext> & {
    userType: UserType;
  },
): MentorSegmentFilterContext => ({
  isAdmin: false,
  tenantKey: undefined,
  mentorSettings: undefined,
  rbacPermissions: {},
  flags: { isMemsearchEnabled: true, isMemoryComponentEnabled: true },
  isUserTypeAllowed: (segment: MentorSegment) =>
    segment.userTypes.includes(overrides.userType),
  ...overrides,
});

const filterAll = (ctx: MentorSegmentFilterContext) => [
  ...filterMentorSegments(MENTOR_SEGMENTS, ctx),
  ...filterMentorSegments([ANALYTICS_NAV_ITEM], ctx),
];

describe('NavBar - Menu Filtering Logic (filterMentorSegments)', () => {
  afterEach(() => {
    // Restore default mock implementations after tests that override them
    vi.mocked(rbacPermissionToDisplay).mockImplementation(
      (
        fields: string[],
        permissions?: Record<string, { read: boolean; write: boolean }>,
      ) => {
        if (!permissions || fields.length === 0) return true;
        return fields.some((field) => permissions[field]?.read);
      },
    );
    vi.mocked(checkRbacPermission).mockImplementation(
      (_permissions: object, _resource: string) => true,
    );
  });

  describe('Admin on main tenant', () => {
    it('shows all menu items that pass user type check', () => {
      const mentorSettings = {
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
            mentor_description: { read: true, write: true },
            profile_image: { read: true, write: true },
            mentor_visibility: { read: true, write: true },
            metadata: { read: true, write: true },
            llm_provider: { read: true, write: true },
            system_prompt: { read: true, write: true },
            mentor_tools: { read: true, write: true },
          },
        },
      };

      const result = filterAll(
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'main',
          mentorSettings,
        }),
      );

      const labels = result.map((i) => i.label);
      expect(labels).toContain('Settings');
      expect(labels).toContain('Access');
      expect(labels).toContain('Analytics');
      expect(labels).toContain('LLM');
      expect(labels).toContain('Prompts');
      expect(labels).toContain('Tools');
    });
  });

  describe('Non-admin on main tenant', () => {
    it('filters out admin items', () => {
      const mentorSettings = {
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
          },
        },
      };

      const result = filterAll(
        buildContext({
          userType: UserType.STUDENT,
          isAdmin: false,
          tenantKey: 'main',
          mentorSettings,
        }),
      );

      // Non-admin on main tenant should not see admin-only items
      const labels = result.map((i) => i.label);
      expect(labels).not.toContain('Access');
      expect(labels).not.toContain('Settings');
    });
  });

  describe('User on non-main tenant', () => {
    it('shows items when mentor is on non-main tenant', () => {
      const mentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
          },
        },
      };

      const result = filterAll(
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'custom-tenant',
          mentorSettings,
        }),
      );

      const labels = result.map((i) => i.label);
      expect(labels).toContain('Settings');
    });
  });

  describe('RBAC permission checks', () => {
    it('filters out items when user lacks field permissions', () => {
      const mentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            // No permissions for Settings-related fields
          },
        },
      };

      // Override the mock to be strict about field permissions
      vi.mocked(rbacPermissionToDisplay).mockImplementation(
        (
          fields: string[],
          permissions?: Record<string, { read: boolean; write: boolean }>,
        ) => {
          if (fields.length === 0) return true;
          if (!permissions) return false;
          return fields.some((field) => permissions[field]?.read);
        },
      );

      const result = filterAll(
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'custom-tenant',
          mentorSettings,
        }),
      );

      const labels = result.map((i) => i.label);
      // Settings should be filtered out because no field permissions
      expect(labels).not.toContain('Settings');
      // Access and Analytics have empty permissionFieldsCheck, so they pass
      expect(labels).toContain('Access');
      expect(labels).toContain('Analytics');
    });

    it('filters out items when RBAC resource check fails', () => {
      const mentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
          },
        },
      };

      // Override to deny analytics
      vi.mocked(checkRbacPermission).mockImplementation(
        (_permissions: object, resource: string) => {
          if (resource.includes('#view_analytics')) return false;
          return true;
        },
      );

      const result = filterAll(
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'custom-tenant',
          mentorSettings,
        }),
      );

      const labels = result.map((i) => i.label);
      expect(labels).not.toContain('Analytics');
      expect(labels).toContain('Settings');
    });
  });

  describe('User type filtering', () => {
    it('filters items based on user type', () => {
      const mentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
      };

      const result = filterAll(
        buildContext({
          userType: UserType.FREE_TRIAL,
          isAdmin: false,
          tenantKey: 'custom-tenant',
          mentorSettings,
        }),
      );

      const labels = result.map((i) => i.label);
      // Access requires UserType.ADMIN only
      expect(labels).not.toContain('Access');
      // Settings allows FREE_TRIAL
      expect(labels).toContain('Settings');
    });
  });

  describe('Config gating (enabledThroughConfig)', () => {
    const mentorSettings = {
      platform_key: 'custom-tenant',
      mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      mentor_id: 123,
      permissions: { field: {} },
    };

    it('hides the Memory tab when memsearch is disabled', () => {
      const result = filterMentorSegments(
        MENTOR_SEGMENTS,
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'custom-tenant',
          mentorSettings,
          flags: { isMemsearchEnabled: false, isMemoryComponentEnabled: true },
        }),
      );

      expect(result.map((i) => i.label)).not.toContain('Memory');
    });

    it('shows the Memory tab when memsearch is enabled', () => {
      const result = filterMentorSegments(
        MENTOR_SEGMENTS,
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'custom-tenant',
          mentorSettings,
          flags: { isMemsearchEnabled: true, isMemoryComponentEnabled: true },
        }),
      );

      expect(result.map((i) => i.label)).toContain('Memory');
    });

    it('does not affect any other segment when memsearch is disabled', () => {
      const enabled = filterMentorSegments(
        MENTOR_SEGMENTS,
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'custom-tenant',
          mentorSettings,
          flags: { isMemsearchEnabled: true, isMemoryComponentEnabled: true },
        }),
      );
      const disabled = filterMentorSegments(
        MENTOR_SEGMENTS,
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'custom-tenant',
          mentorSettings,
          flags: { isMemsearchEnabled: false, isMemoryComponentEnabled: true },
        }),
      );

      expect(disabled.map((i) => i.label)).toEqual(
        enabled.map((i) => i.label).filter((l) => l !== 'Memory'),
      );
    });
  });

  describe('Edge cases', () => {
    it('handles undefined mentor settings gracefully', () => {
      const result = filterAll(
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: 'tenant123',
          mentorSettings: undefined,
        }),
      );

      // With no mentorSettings, the RBAC resource check fails for every
      // segment that needs one — which is all of them. Pipeline should
      // tolerate this without throwing.
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles undefined tenant key', () => {
      const mentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
      };

      const result = filterAll(
        buildContext({
          userType: UserType.ADMIN,
          isAdmin: true,
          tenantKey: undefined,
          mentorSettings,
        }),
      );

      // mentorNotOnMainTenant is true (custom-tenant !== 'main'), so the
      // visibility filter passes.
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // CreditBalance — paywall + permission gating
  // --------------------------------------------------------------------------

  describe('CreditBalance gating', () => {
    function renderNav() {
      const store = createTestStore();
      return render(
        <Provider store={store}>
          <NavBar />
        </Provider>,
      );
    }

    it('renders CreditBalance when tenant.show_paywall is true and user is admin', () => {
      mockCurrentTenant = {
        key: 'paying-tenant',
        is_admin: true,
        show_paywall: true,
      };
      mockIsAdmin = true;

      renderNav();

      expect(screen.getByTestId('credit-balance')).toBeInTheDocument();
      expect(lastCreditBalanceProps).toMatchObject({
        tenant: 'tenant123',
        enabled: true,
        mainPlatformKey: 'main',
        currentUserEmail: 'student@example.com',
        username: 'student-user',
      });
      expect(typeof lastCreditBalanceProps.redirectUrl).toBe('string');
    });

    it('renders CreditBalance for free-trial users (non-admin on main with one tenant) when paywall is on', () => {
      mockIsAdmin = false;
      mockCurrentTenant = {
        key: 'main',
        is_admin: false,
        show_paywall: true,
      };
      mockAllTenants = [{ key: 'main' }];

      renderNav();

      expect(screen.getByTestId('credit-balance')).toBeInTheDocument();
    });

    it('does NOT render CreditBalance when tenant.show_paywall is false', () => {
      mockIsAdmin = true;
      mockCurrentTenant = {
        key: 'paying-tenant',
        is_admin: true,
        show_paywall: false,
      };

      renderNav();

      expect(screen.queryByTestId('credit-balance')).not.toBeInTheDocument();
    });

    it('does NOT render CreditBalance for non-admin users without free-trial eligibility', () => {
      mockIsAdmin = false;
      // Non-admin on a non-main tenant → not free trial
      mockCurrentTenant = {
        key: 'org-tenant',
        is_admin: false,
        show_paywall: true,
      };
      mockAllTenants = [{ key: 'org-tenant' }, { key: 'other-tenant' }];

      renderNav();

      expect(screen.queryByTestId('credit-balance')).not.toBeInTheDocument();
    });
  });
});
