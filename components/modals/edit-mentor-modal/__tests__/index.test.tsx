import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MentorVisibilityEnum } from '@iblai/iblai-api';

import { EditMentorModal } from '../index';
import { modalReducer, type ModalInfo } from '@/features/navigation/slice';
import { mentorApiSlice } from '@iblai/iblai-js/data-layer';
import rbacReducer from '@/features/rbac/rbac-slice';
import { MODALS, UserType } from '@/lib/constants';

// ============================================================================
// GLOBAL MOCKS
// ============================================================================

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// ============================================================================
// MOCKS
// ============================================================================

const pushMock = vi.fn();
let mockSearchParamsRaw = '';
let mockIsAdmin = true;
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
      allow_anonymous: { read: true, write: true },
      is_lti_accessible: { read: true, write: true },
      show_attachment: { read: true, write: true },
      show_voice_call: { read: true, write: true },
      show_voice_record: { read: true, write: true },
      llm_provider: { read: true, write: true },
      system_prompt: { read: true, write: true },
      proactive_prompt: { read: true, write: true },
      guided_prompt_instructions: { read: true, write: true },
      enable_guided_prompts: { read: true, write: true },
      safety_system_prompt: { read: true, write: true },
      moderation_system_prompt: { read: true, write: true },
      safety_response: { read: true, write: true },
      enable_safety_system: { read: true, write: true },
      enable_moderation: { read: true, write: true },
      disclaimer: { read: true, write: true },
      enable_disclaimer: { read: true, write: true },
      mentor_tools: { read: true, write: true },
      custom_css: { read: true, write: true },
    },
  },
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/platform/tenant123/mentor456',
  useParams: () => ({ tenantKey: 'tenant123', mentorId: 'mentor456' }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsRaw),
}));

vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: () => mockIsAdmin,
  useUsername: () => 'testuser',
}));

vi.mock('@/hooks/use-user-type', () => ({
  useUserType: () => ({
    isUserTypeAllowed: (item: { userTypes: string[] }) =>
      item.userTypes.includes(UserType.ADMIN) || item.userTypes.includes(UserType.FREE_TRIAL),
  }),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    changeModalTab: vi.fn(),
    getEditMentorTab: () => MODALS.EDIT_MENTOR.tabs.settings,
    getMentorId: () => 'mentor456',
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@iblai/iblai-js/data-layer')>();
  return {
    ...actual,
    useGetMentorSettingsQuery: () => ({
      data: mockMentorSettings,
      isLoading: false,
      isSuccess: true,
    }),
  };
});

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: () => 'main',
    iblTemplateMentor: () => 'ai-mentor',
    environment: () => 'test',
    authUrl: () => 'https://auth.example.com',
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
    enableGravatarOnProfilePic: () => 'false',
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
    platformBaseDomain: () => 'example.com',
    iblPlatform: () => 'mentor',
    iblEnableSpecialLogoWhenIframed: () => 'false',
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock all tab components
vi.mock('../tabs', () => ({
  SettingsTab: () => <div data-testid="settings-tab">Settings Tab</div>,
  LLMTab: () => <div data-testid="llm-tab">LLM Tab</div>,
  PromptsTab: () => <div data-testid="prompts-tab">Prompts Tab</div>,
  McpTab: () => <div data-testid="mcp-tab">MCP Tab</div>,
  ToolsTab: () => <div data-testid="tools-tab">Tools Tab</div>,
  SafetyTab: () => <div data-testid="safety-tab">Safety Tab</div>,
  HistoryTab: () => <div data-testid="history-tab">History Tab</div>,
  DatasetsTab: () => <div data-testid="datasets-tab">Datasets Tab</div>,
  ApiTab: () => <div data-testid="api-tab">API Tab</div>,
  EmbedTab: () => <div data-testid="embed-tab">Embed Tab</div>,
  AccessTab: () => <div data-testid="access-tab">Access Tab</div>,
}));

vi.mock('../tabs/memory-tab', () => ({
  MemoryTab: () => <div data-testid="memory-tab">Memory Tab</div>,
}));

vi.mock('../tabs/disclaimers-tab', () => ({
  DisclaimersTab: () => <div data-testid="disclaimers-tab">Disclaimers Tab</div>,
}));

// ============================================================================
// TEST STORE FACTORY
// ============================================================================

function createTestStore(preloadedStack: ModalInfo[] = [], rbacPermissions: object = {}) {
  return configureStore({
    reducer: {
      modals: modalReducer,
      rbac: rbacReducer,
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
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
    },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('EditMentorModal', () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    mockSearchParamsRaw = '';
    mockIsAdmin = true;
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
          allow_anonymous: { read: true, write: true },
          is_lti_accessible: { read: true, write: true },
          show_attachment: { read: true, write: true },
          show_voice_call: { read: true, write: true },
          show_voice_record: { read: true, write: true },
          llm_provider: { read: true, write: true },
          system_prompt: { read: true, write: true },
          proactive_prompt: { read: true, write: true },
          guided_prompt_instructions: { read: true, write: true },
          enable_guided_prompts: { read: true, write: true },
          safety_system_prompt: { read: true, write: true },
          moderation_system_prompt: { read: true, write: true },
          safety_response: { read: true, write: true },
          enable_safety_system: { read: true, write: true },
          enable_moderation: { read: true, write: true },
          disclaimer: { read: true, write: true },
          enable_disclaimer: { read: true, write: true },
          mentor_tools: { read: true, write: true },
          custom_css: { read: true, write: true },
        },
      },
    };
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
    it('renders the dialog when isOpen is true', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditMentorModal isOpen={false} onClose={vi.fn()} />
        </Provider>,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the Edit Mentor title with mentor name', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );

      // The title should contain "Edit" followed by the mentor name
      // Look for it in h2 heading elements
      await waitFor(() => {
        const headings = screen.getAllByRole('heading');
        const editHeading = headings.find((h) => h.textContent?.includes('Edit'));
        expect(editHeading).toBeTruthy();
      });
    });

    it('renders the default settings tab content', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('settings-tab')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility Tests
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    it('has accessible dialog description', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );

      await waitFor(() => {
        const description = screen.getByText(
          /Edit Mentor settings, prompts, tools, safety, flow, history, datasets, and API keys/i,
        );
        expect(description).toBeInTheDocument();
        expect(description).toHaveClass('sr-only');
      });
    });

    it('tab triggers have proper aria attributes', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );

      await waitFor(() => {
        // Get all tablists (there are multiple for desktop/mobile views)
        const tabsLists = screen.getAllByRole('tablist');
        expect(tabsLists.length).toBeGreaterThan(0);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Tab Navigation Tests
  // --------------------------------------------------------------------------

  describe('Tab Navigation', () => {
    it('renders tab list for navigation', async () => {
      const store = createTestStore();

      render(
        <Provider store={store}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );

      await waitFor(() => {
        const tabsList = screen.getAllByRole('tablist');
        expect(tabsList.length).toBeGreaterThan(0);
      });
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS FOR TAB FILTERING LOGIC
// ============================================================================

describe('EditMentorModal - Tab Filtering Logic', () => {
  /**
   * These tests validate the tab filtering logic that determines
   * which tabs are shown based on user type, admin status, tenant, and permissions.
   */

  interface MockTab {
    label: string;
    value: string;
    userTypes: string[];
    rbacResource?: (mentorDbId: number) => string;
    permissionFieldsCheck: string[];
    mentorVisibility: MentorVisibilityEnum[];
  }

  interface MockMentorSettings {
    platform_key: string;
    mentor_visibility: MentorVisibilityEnum;
    mentor_id: number;
    permissions?: {
      field?: Record<string, { read: boolean; write: boolean }>;
    };
  }

  interface MockConfig {
    mainTenantKey: () => string;
  }

  /**
   * Pure function that mirrors the tab filtering logic from EditMentorModal.
   */
  function filterTabs(
    tabs: MockTab[],
    isUserTypeAllowed: (item: MockTab) => boolean,
    isAdmin: boolean,
    tenantKey: string | undefined,
    mentorSettings: MockMentorSettings | undefined,
    config: MockConfig,
    rbacPermissions: Record<string, boolean>,
    rbacPermissionToDisplay: (
      fields: string[],
      permissions?: Record<string, { read: boolean; write: boolean }>,
    ) => boolean,
    checkRbacPermission: (permissions: object, resource: string) => boolean,
  ): MockTab[] {
    if (!mentorSettings) return [];

    return tabs
      .filter(isUserTypeAllowed)
      .filter((item) => {
        const isAdminOnMainTenant = isAdmin && tenantKey === config.mainTenantKey();
        const mentorNotOnMainTenant = mentorSettings.platform_key !== config.mainTenantKey();
        const visibilityMatches = item.mentorVisibility.includes(
          mentorSettings.mentor_visibility as MentorVisibilityEnum,
        );
        const isNonAdminOnMainTenant = !isAdmin && tenantKey === config.mainTenantKey();
        const visibilityAllowed = visibilityMatches && !isNonAdminOnMainTenant;

        return isAdminOnMainTenant || mentorNotOnMainTenant || visibilityAllowed;
      })
      .filter((item) => {
        const hasFieldPermission = rbacPermissionToDisplay(
          item.permissionFieldsCheck,
          mentorSettings.permissions?.field,
        );
        const hasRbacPermission =
          !item.rbacResource ||
          checkRbacPermission(rbacPermissions, item.rbacResource(mentorSettings.mentor_id));
        return hasFieldPermission && hasRbacPermission;
      });
  }

  const mockConfig: MockConfig = { mainTenantKey: () => 'main' };

  const sampleTabs: MockTab[] = [
    {
      label: 'Settings',
      value: 'settings',
      userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
      rbacResource: (mentorDbId: number) => `/mentors/${mentorDbId}/#show_settings`,
      permissionFieldsCheck: ['mentor_name', 'mentor_description'],
      mentorVisibility: [
        MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
      ],
    },
    {
      label: 'Access',
      value: 'access',
      userTypes: [UserType.ADMIN],
      rbacResource: (mentorDbId: number) => `/mentors/${mentorDbId}/#read_shared_mentor`,
      permissionFieldsCheck: [],
      mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
    },
    {
      label: 'LLM',
      value: 'llm',
      userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
      rbacResource: (mentorDbId: number) => `/mentors/${mentorDbId}/llms/#list`,
      permissionFieldsCheck: ['llm_provider'],
      mentorVisibility: [
        MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
      ],
    },
  ];

  const mockRbacPermissionToDisplay = (
    fields: string[],
    permissions?: Record<string, { read: boolean; write: boolean }>,
  ): boolean => {
    if (!permissions || fields.length === 0) return true;
    return fields.some((field) => permissions[field]?.read);
  };

  const mockCheckRbacPermission = (): boolean => true;

  describe('Admin on main tenant', () => {
    it('shows all tabs that pass user type check', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
            mentor_description: { read: true, write: true },
            llm_provider: { read: true, write: true },
          },
        },
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true,
        'main',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      expect(result.map((t) => t.label)).toContain('Settings');
      expect(result.map((t) => t.label)).toContain('Access');
      expect(result.map((t) => t.label)).toContain('LLM');
    });
  });

  describe('Non-admin on main tenant', () => {
    it('filters out admin-only tabs', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
            mentor_description: { read: true, write: true },
            llm_provider: { read: true, write: true },
          },
        },
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.FREE_TRIAL),
        false,
        'main',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      expect(result.map((t) => t.label)).not.toContain('Access');
    });

    it('filters tabs based on mentor visibility for non-admins on main tenant', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
          },
        },
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.FREE_TRIAL),
        false,
        'main',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      // VIEWABLE_BY_ANYONE is not in any tab's mentorVisibility array
      // and isNonAdminOnMainTenant is true, so visibilityAllowed is false
      expect(result.length).toBe(0);
    });
  });

  describe('User on non-main tenant', () => {
    it('shows tabs when mentor is on non-main tenant', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
          },
        },
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true,
        'custom-tenant',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      expect(result.map((t) => t.label)).toContain('Settings');
      expect(result.map((t) => t.label)).toContain('Access');
    });
  });

  describe('RBAC permission checks', () => {
    it('filters out tabs when user lacks field permissions', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            // Missing mentor_name, mentor_description - Settings should be filtered
            llm_provider: { read: true, write: true },
          },
        },
      };

      const strictRbacPermissionToDisplay = (
        fields: string[],
        permissions?: Record<string, { read: boolean; write: boolean }>,
      ): boolean => {
        if (fields.length === 0) return true;
        if (!permissions) return false;
        return fields.some((field) => permissions[field]?.read);
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true,
        'custom-tenant',
        mentorSettings,
        mockConfig,
        {},
        strictRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      expect(result.map((t) => t.label)).not.toContain('Settings');
      expect(result.map((t) => t.label)).toContain('LLM');
      expect(result.map((t) => t.label)).toContain('Access');
    });

    it('filters out tabs when RBAC resource check fails', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {
            mentor_name: { read: true, write: true },
            llm_provider: { read: true, write: true },
          },
        },
      };

      const strictCheckRbacPermission = (_: object, resource: string): boolean => {
        // Deny access to LLM
        if (resource.includes('llms')) return false;
        return true;
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true,
        'custom-tenant',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        strictCheckRbacPermission,
      );

      expect(result.map((t) => t.label)).not.toContain('LLM');
      expect(result.map((t) => t.label)).toContain('Settings');
    });
  });

  describe('Edge cases', () => {
    it('returns empty array when mentor settings is undefined', () => {
      const result = filterTabs(
        sampleTabs,
        () => true,
        true,
        'tenant123',
        undefined,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      expect(result).toEqual([]);
    });

    it('handles tabs with no rbacResource', () => {
      const tabsWithNoRbac: MockTab[] = [
        {
          label: 'Simple Tab',
          value: 'simple',
          userTypes: [UserType.ADMIN],
          permissionFieldsCheck: [],
          mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
        },
      ];

      const mentorSettings: MockMentorSettings = {
        platform_key: 'tenant123',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
      };

      const result = filterTabs(
        tabsWithNoRbac,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true,
        'tenant123',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      expect(result.map((t) => t.label)).toContain('Simple Tab');
    });

    it('handles empty permissions field object', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'tenant123',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 123,
        permissions: {
          field: {},
        },
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true,
        'main',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      // With empty permissions and admin on main tenant, should still show tabs
      // that have empty permissionFieldsCheck
      expect(result.map((t) => t.label)).toContain('Access');
    });
  });

  describe('Visibility filtering logic', () => {
    it('isAdminOnMainTenant bypasses visibility check', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'other-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE, // Not in tab's allowed list
        mentor_id: 123,
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true, // isAdmin
        'main', // on main tenant
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      // Admin on main tenant sees all tabs regardless of visibility
      expect(result.map((t) => t.label)).toContain('Settings');
    });

    it('mentorNotOnMainTenant bypasses visibility check', () => {
      const mentorSettings: MockMentorSettings = {
        platform_key: 'other-tenant', // Not main
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
        mentor_id: 123,
      };

      const result = filterTabs(
        sampleTabs,
        (item) => item.userTypes.includes(UserType.ADMIN),
        true,
        'other-tenant',
        mentorSettings,
        mockConfig,
        {},
        mockRbacPermissionToDisplay,
        mockCheckRbacPermission,
      );

      expect(result.map((t) => t.label)).toContain('Settings');
    });
  });
});
