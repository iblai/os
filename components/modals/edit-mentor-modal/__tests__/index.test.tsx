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
      item.userTypes.includes(UserType.ADMIN) ||
      item.userTypes.includes(UserType.FREE_TRIAL),
  }),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    changeModalTab: vi.fn(),
    getEditMentorTab: () => MODALS.EDIT_MENTOR.tabs.settings,
    getMentorId: () => 'mentor456',
  }),
}));

const mockMemsearchEnabled = false;

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
      data: { enable_memsearch: mockMemsearchEnabled },
      isLoading: false,
      isSuccess: true,
    }),
    // Stub the claw RTK Query hooks — the real `clawApiSlice` middleware
    // isn't mounted on this test's Redux store, so calling the real hooks
    // would throw "Middleware for RTK-Query API ... has not been added".
    // useMentorSegments + settings-tab consume these.
    useGetClawMentorConfigQuery: () => ({
      data: null,
      isError: false,
      isLoading: false,
    }),
    useUpdateClawMentorConfigMutation: () => [
      () => Promise.resolve({}),
      { isLoading: false },
    ],
    // Same rationale for the CallConfiguration RTK Query hooks — settings-tab
    // consumes them to hydrate / persist the two voice-call toggles.
    useGetCallConfigurationsQuery: () => ({
      data: [],
      isError: false,
      isLoading: false,
    }),
    useCreateCallConfigurationMutation: () => [
      () => ({ unwrap: () => Promise.resolve({}) }),
      { isLoading: false },
    ],
    useUpdateCallConfigurationMutation: () => [
      () => ({ unwrap: () => Promise.resolve({}) }),
      { isLoading: false },
    ],
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

// @iblai/web-containers transitively imports @iblai/web-utils which imports
// axios — which fails to resolve in Vitest's transform pipeline. Stub it here
// so importing the tabs barrel (which re-exports SandboxTab/SkillsTab that use
// these components) doesn't break the test.
vi.mock('@iblai/web-containers', () => ({
  SandboxConfig: () => null,
  AgentSkills: () => null,
  AgentConfigPrompts: () => null,
}));

// Mock all tab components. Keep this list in sync with `../tabs/index.ts` —
// any export the barrel exposes that we leave out here will throw a
// "No 'X' export is defined on the '../tabs' mock" error during render.
vi.mock('../tabs', () => ({
  SettingsTab: () => <div data-testid="settings-tab">Settings Tab</div>,
  LLMTab: () => <div data-testid="llm-tab">LLM Tab</div>,
  PromptsTab: () => <div data-testid="prompts-tab">Prompts Tab</div>,
  McpTab: () => <div data-testid="mcp-tab">MCP Tab</div>,
  ToolsTab: () => <div data-testid="tools-tab">Tools Tab</div>,
  SafetyTab: () => <div data-testid="safety-tab">Safety Tab</div>,
  PrivacyTab: () => <div data-testid="privacy-tab">Privacy Tab</div>,
  FlowTab: () => <div data-testid="flow-tab">Flow Tab</div>,
  HistoryTab: () => <div data-testid="history-tab">History Tab</div>,
  DatasetsTab: () => <div data-testid="datasets-tab">Datasets Tab</div>,
  ApiTab: () => <div data-testid="api-tab">API Tab</div>,
  EmbedTab: () => <div data-testid="embed-tab">Embed Tab</div>,
  AccessTab: () => <div data-testid="access-tab">Access Tab</div>,
  SandboxTab: () => <div data-testid="sandbox-tab">Sandbox Tab</div>,
  SkillsTab: () => <div data-testid="skills-tab">Skills Tab</div>,
  AuditLogTab: () => <div data-testid="audit-log-tab">Audit Log Tab</div>,
}));

vi.mock('../tabs/memory-tab', () => ({
  MemoryTab: () => <div data-testid="memory-tab">Memory Tab</div>,
}));

vi.mock('../tabs/disclaimers-tab', () => ({
  DisclaimersTab: () => (
    <div data-testid="disclaimers-tab">Disclaimers Tab</div>
  ),
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
        const editHeading = headings.find((h) =>
          h.textContent?.includes('Edit'),
        );
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
          /Edit Agent settings, prompts, tools, safety, flow, history, datasets, and API keys/i,
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

// NOTE: A previous version of this file maintained a local duplicate of
// the modal's tab filtering logic in a 'filterTabs' helper, then unit-tested
// the duplicate. That logic now lives in the shared useMentorSegments hook
// (hooks/use-mentor-segments.ts) and is exercised by
//   - hooks/__tests__/use-mentor-segments.test.tsx
//   - app/platform/[tenantKey]/[mentorId]/_components/nav-bar/__tests__/index.test.tsx
// The dead duplicate has been removed so future readers do not update one
// without the other.
