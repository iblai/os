import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import { EditMentorModal } from './index';
import { modalReducer, type ModalInfo } from '@/features/navigation/slice';
import { mentorApiSlice } from '@iblai/iblai-js/data-layer';
import rbacReducer from '@/features/rbac/rbac-slice';
import { MODALS, UserType } from '@/lib/constants';

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

const pushMock = vi.fn();
const changeModalTabMock = vi.fn();
let mockSearchParamsRaw = '';
let mockIsAdmin = true;
let mockGetEditMentorTab: string | undefined = MODALS.EDIT_MENTOR.tabs.settings;
let mockGetMentorId: string | null = 'mentor456';
let mockIsUserTypeAllowed: (item: { userTypes: string[] }) => boolean = (
  item,
) =>
  item.userTypes.includes(UserType.ADMIN) ||
  item.userTypes.includes(UserType.FREE_TRIAL);
let mockEnableRBAC = false;
let mockCheckRbacPermissionResult = true;
let mockMentorSettings: any = null;
let mockIsSuccess = true;

const dfp = {
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
  safety_system_prompt: { read: true, write: true },
  moderation_system_prompt: { read: true, write: true },
  moderation_response: { read: true, write: true },
  safety_response: { read: true, write: true },
  disclaimer: { read: true, write: true },
  mentor_tools: { read: true, write: true },
  custom_css: { read: true, write: true },
};

function dms() {
  return {
    mentor: 'Test Mentor',
    mentor_id: 123,
    mentor_unique_id: 'mentor456',
    platform_key: 'tenant123',
    mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
    permissions: { field: { ...dfp } },
  };
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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
      mockIsUserTypeAllowed(item),
  }),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    changeModalTab: changeModalTabMock,
    getEditMentorTab: () => mockGetEditMentorTab,
    getMentorId: () => mockGetMentorId,
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
      isSuccess: mockIsSuccess,
    }),
    useGetMemsearchStatusQuery: () => ({
      data: { enable_memsearch: true },
    }),
  };
});

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: () => 'main',
    iblTemplateMentor: () => 'ai-mentor',
    environment: () => 'test',
    authUrl: () => '',
    lmsUrl: () => '',
    dmUrl: () => '',
    axdUrl: () => '',
    mentorUrl: () => '',
    mentorIframeUrl: () => '',
    externalPricingPageUrl: () => '',
    stripeEnabled: () => 'true',
    baseWsUrl: () => '',
    liveKitServerUrl: () => '',
    mentorSettingsDisclaimer: () => '',
    iframeFromOldMentor: () => 'false',
    enableRBAC: () => mockEnableRBAC,
    sentryDsn: () => '',
    helpCenterUrl: () => '',
    supportEmail: () => '',
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

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

vi.mock('./tabs', () => ({
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
  AuditLogTab: () => <div data-testid="audit-log-tab">Audit Log Tab</div>,
}));

vi.mock('./tabs/memory-tab', () => ({
  MemoryTab: () => <div data-testid="memory-tab">Memory Tab</div>,
}));

vi.mock('./tabs/disclaimers-tab', () => ({
  DisclaimersTab: () => (
    <div data-testid="disclaimers-tab">Disclaimers Tab</div>
  ),
}));

vi.mock('@/hoc/utils', () => ({
  rbacPermissionToDisplay: (pf: string[], perms: any) => {
    if (!mockEnableRBAC || !perms || pf.length === 0) return true;
    for (const f of pf) {
      if (perms[f]?.read) return true;
    }
    return false;
  },
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: () => mockCheckRbacPermissionResult,
}));

function createTestStore(ps: ModalInfo[] = [], rp: object = {}) {
  return configureStore({
    reducer: {
      modals: modalReducer,
      rbac: rbacReducer,
      [mentorApiSlice.reducerPath]: mentorApiSlice.reducer,
    },
    middleware: (g) =>
      g({ serializableCheck: false }).concat(mentorApiSlice.middleware),
    preloadedState: {
      modals: {
        modalStack: ps,
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
      rbac: { rbacPermissions: rp },
    },
  });
}

function renderM(isOpen = true, onClose = vi.fn(), store = createTestStore()) {
  return render(
    <Provider store={store}>
      <EditMentorModal isOpen={isOpen} onClose={onClose} />
    </Provider>,
  );
}

describe('EditMentorModal', () => {
  beforeEach(() => {
    cleanup();
    pushMock.mockReset();
    changeModalTabMock.mockReset();
    mockSearchParamsRaw = '';
    mockIsAdmin = true;
    mockGetEditMentorTab = MODALS.EDIT_MENTOR.tabs.settings;
    mockGetMentorId = 'mentor456';
    mockEnableRBAC = false;
    mockCheckRbacPermissionResult = true;
    mockIsSuccess = true;
    mockIsUserTypeAllowed = (item) =>
      item.userTypes.includes(UserType.ADMIN) ||
      item.userTypes.includes(UserType.FREE_TRIAL);
    mockMentorSettings = dms();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders dialog when isOpen true', () => {
      renderM(true);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('no dialog when isOpen false', () => {
      renderM(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows Edit Mentor title', async () => {
      renderM();
      await waitFor(() => {
        const h = screen
          .getAllByRole('heading')
          .find((el) => el.textContent?.includes('Edit Agent'));
        expect(h).toBeTruthy();
      });
    });

    it('shows Edit Mentor fallback', async () => {
      mockGetMentorId = null;
      renderM();
      await waitFor(() => {
        const h = screen
          .getAllByRole('heading')
          .find((el) => el.textContent?.includes('Edit Agent'));
        expect(h).toBeTruthy();
      });
    });

    it('sr-only description', async () => {
      renderM();
      await waitFor(() => {
        const d = screen.getByText(
          /Edit Agent settings, prompts, tools, safety/i,
        );
        expect(d).toHaveClass('sr-only');
      });
    });

    it('default settings tab', async () => {
      renderM();
      await waitFor(() =>
        expect(screen.getByTestId('settings-tab')).toBeInTheDocument(),
      );
    });
  });

  describe('Active Tab', () => {
    it('uses getEditMentorTab', async () => {
      mockGetEditMentorTab = MODALS.EDIT_MENTOR.tabs.llm;
      renderM();
      await waitFor(() =>
        expect(screen.getByTestId('llm-tab')).toBeInTheDocument(),
      );
    });

    it('defaults to settings', async () => {
      mockGetEditMentorTab = undefined;
      renderM();
      await waitFor(() =>
        expect(screen.getByTestId('settings-tab')).toBeInTheDocument(),
      );
    });
  });

  describe('handleTabChange', () => {
    it('LLM tab trigger is clickable and has correct role', async () => {
      renderM();
      await waitFor(() => {
        const llmTab = document.getElementById(
          `desktop-tab-${MODALS.EDIT_MENTOR.tabs.llm}`,
        );
        expect(llmTab).toBeTruthy();
        expect(llmTab?.getAttribute('role')).toBe('tab');
        expect(llmTab?.getAttribute('type')).toBe('button');
      });
    });

    it('Prompts tab trigger is clickable and has correct value', async () => {
      renderM();
      await waitFor(() => {
        const promptsTab = document.getElementById(
          `desktop-tab-${MODALS.EDIT_MENTOR.tabs.prompts}`,
        );
        expect(promptsTab).toBeTruthy();
        expect(promptsTab?.getAttribute('role')).toBe('tab');
        // The active tab should be settings by default, prompts should be inactive
        expect(promptsTab?.getAttribute('data-state')).toBe('inactive');
      });
    });

    it('active settings tab has data-state active', async () => {
      renderM();
      await waitFor(() => {
        const settingsTab = document.getElementById(
          `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
        );
        expect(settingsTab?.getAttribute('data-state')).toBe('active');
      });
    });
  });

  describe('Desktop Sidebar', () => {
    it('tablist aria-label', async () => {
      renderM();
      await waitFor(() => {
        expect(
          screen
            .getAllByRole('tablist')
            .find(
              (t) => t.getAttribute('aria-label') === 'Agent settings tabs',
            ),
        ).toBeTruthy();
      });
    });

    it('desktop-tab IDs', async () => {
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });

    it('aria-controls', async () => {
      renderM();
      await waitFor(() => {
        expect(
          document
            .getElementById(`desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`)
            ?.getAttribute('aria-controls'),
        ).toBe(`panel-${MODALS.EDIT_MENTOR.tabs.settings}`);
      });
    });

    it('panel aria-labelledby', async () => {
      renderM();
      await waitFor(() => {
        const p = document.getElementById(
          `panel-${MODALS.EDIT_MENTOR.tabs.settings}`,
        );
        expect(p).toBeInTheDocument();
        expect(p?.getAttribute('aria-labelledby')).toBe(
          `tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
        );
      });
    });
  });

  describe('Mobile Tabs', () => {
    it('multiple tablists', async () => {
      renderM();
      await waitFor(() =>
        expect(screen.getAllByRole('tablist').length).toBeGreaterThanOrEqual(2),
      );
    });

    it('narrow screen tabs', async () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 500,
        writable: true,
      });
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(`tab-${MODALS.EDIT_MENTOR.tabs.settings}`),
        ).toBeInTheDocument(),
      );
    });

    it('tablet tabs', async () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
      });
      renderM();
      await waitFor(() =>
        expect(screen.getAllByRole('tablist').length).toBeGreaterThanOrEqual(2),
      );
    });

    it('overflow dropdown', async () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 500,
        writable: true,
      });
      renderM();
      await waitFor(() =>
        expect(screen.getByRole('dialog')).toBeInTheDocument(),
      );
    });
  });

  describe('Tab Filtering', () => {
    it('shows tabs for ADMIN/FREE_TRIAL', async () => {
      renderM();
      await waitFor(() => {
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument();
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.access}`,
          ),
        ).toBeInTheDocument();
      });
    });

    it('filters when user type STUDENT', async () => {
      mockIsUserTypeAllowed = (i) => i.userTypes.includes(UserType.STUDENT);
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('shows when mentor not on main tenant', async () => {
      mockIsAdmin = false;
      mockMentorSettings = {
        ...dms(),
        platform_key: 'custom',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });

    it('shows when visibility matches for admin', async () => {
      mockMentorSettings = {
        ...dms(),
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });

    it('filters when visibility no match', async () => {
      mockIsAdmin = false;
      mockMentorSettings = {
        ...dms(),
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('filters when RBAC fails', async () => {
      mockCheckRbacPermissionResult = false;
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('shows when RBAC passes', async () => {
      mockCheckRbacPermissionResult = true;
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });

    it('filters when field perms missing RBAC on', async () => {
      mockEnableRBAC = true;
      mockCheckRbacPermissionResult = true;
      mockMentorSettings = { ...dms(), permissions: { field: {} } };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('shows empty permissionFieldsCheck tabs', async () => {
      mockEnableRBAC = true;
      mockCheckRbacPermissionResult = true;
      mockMentorSettings = { ...dms(), permissions: { field: {} } };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.access}`,
          ),
        ).toBeInTheDocument(),
      );
    });

    it('no tabs when null settings', async () => {
      mockMentorSettings = null;
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('no tabs when undefined settings', async () => {
      mockMentorSettings = undefined;
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('getMentorId fallback', () => {
    it('uses truthy getMentorId', async () => {
      mockGetMentorId = 'x';
      renderM();
      await waitFor(() =>
        expect(screen.getByRole('dialog')).toBeInTheDocument(),
      );
    });

    it('fallback on null', async () => {
      mockGetMentorId = null;
      renderM();
      await waitFor(() =>
        expect(
          screen
            .getAllByRole('heading')
            .find((h) => h.textContent?.includes('Edit Agent')),
        ).toBeTruthy(),
      );
    });

    it('fallback on empty', async () => {
      mockGetMentorId = '';
      renderM();
      await waitFor(() =>
        expect(
          screen
            .getAllByRole('heading')
            .find((h) => h.textContent?.includes('Edit Agent')),
        ).toBeTruthy(),
      );
    });
  });

  describe('onClose', () => {
    it('calls onClose', async () => {
      const fn = vi.fn();
      renderM(true, fn);
      await waitFor(() =>
        expect(screen.getByRole('dialog')).toBeInTheDocument(),
      );
      const b = screen.getByRole('button', { name: /close/i });
      if (b) {
        fireEvent.click(b);
        expect(fn).toHaveBeenCalled();
      }
    });
  });

  describe('All Tabs', () => {
    const cases = [
      { t: MODALS.EDIT_MENTOR.tabs.settings, id: 'settings-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.access, id: 'access-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.llm, id: 'llm-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.prompts, id: 'prompts-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.safety, id: 'safety-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.disclaimer, id: 'disclaimers-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.tools, id: 'tools-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.mcp, id: 'mcp-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.memory, id: 'memory-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.history, id: 'history-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.datasets, id: 'datasets-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.api, id: 'api-tab' },
      { t: MODALS.EDIT_MENTOR.tabs.embed, id: 'embed-tab' },
    ];
    cases.forEach(({ t, id }) => {
      it(`renders ${t}`, async () => {
        mockGetEditMentorTab = t;
        renderM();
        await waitFor(() => expect(screen.getByTestId(id)).toBeInTheDocument());
      });
    });
  });

  describe('Edge Cases', () => {
    it('Access filtered STUDENTS visibility', async () => {
      mockMentorSettings = {
        ...dms(),
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
      };
      renderM();
      await waitFor(() => {
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.access}`,
          ),
        ).not.toBeInTheDocument();
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument();
      });
    });

    it('empty permissionFieldsCheck passes', async () => {
      mockEnableRBAC = true;
      mockCheckRbacPermissionResult = true;
      mockMentorSettings = { ...dms(), permissions: { field: {} } };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(`desktop-tab-${MODALS.EDIT_MENTOR.tabs.mcp}`),
        ).toBeInTheDocument(),
      );
    });

    it('AND: field ok RBAC fail', async () => {
      mockCheckRbacPermissionResult = false;
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('AND: RBAC ok field fail', async () => {
      mockEnableRBAC = true;
      mockCheckRbacPermissionResult = true;
      mockMentorSettings = {
        ...dms(),
        permissions: { field: { x: { read: true, write: true } } },
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('AND: both fail', async () => {
      mockEnableRBAC = true;
      mockCheckRbacPermissionResult = false;
      mockMentorSettings = {
        ...dms(),
        permissions: { field: { x: { read: true, write: true } } },
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });

    it('visibility false branch', async () => {
      mockIsAdmin = false;
      mockMentorSettings = {
        ...dms(),
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('Full 13 tabs', () => {
    it('all tabs render', async () => {
      renderM();
      const ts = [
        MODALS.EDIT_MENTOR.tabs.settings,
        MODALS.EDIT_MENTOR.tabs.access,
        MODALS.EDIT_MENTOR.tabs.llm,
        MODALS.EDIT_MENTOR.tabs.prompts,
        MODALS.EDIT_MENTOR.tabs.safety,
        MODALS.EDIT_MENTOR.tabs.disclaimer,
        MODALS.EDIT_MENTOR.tabs.tools,
        MODALS.EDIT_MENTOR.tabs.mcp,
        MODALS.EDIT_MENTOR.tabs.memory,
        MODALS.EDIT_MENTOR.tabs.history,
        MODALS.EDIT_MENTOR.tabs.datasets,
        MODALS.EDIT_MENTOR.tabs.api,
        MODALS.EDIT_MENTOR.tabs.embed,
      ];
      await waitFor(() => {
        for (const v of ts)
          expect(
            document.getElementById(`desktop-tab-${v}`),
          ).toBeInTheDocument();
      });
    });
  });

  describe('Re-runs', () => {
    it('handles settings null', async () => {
      const { rerender } = renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
      mockMentorSettings = null;
      rerender(
        <Provider store={createTestStore()}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('updates on isSuccess', async () => {
      mockIsSuccess = false;
      mockMentorSettings = null;
      const { rerender } = renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
      mockIsSuccess = true;
      mockMentorSettings = dms();
      rerender(
        <Provider store={createTestStore()}>
          <EditMentorModal isOpen={true} onClose={vi.fn()} />
        </Provider>,
      );
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });
  });

  describe('STUDENTS visibility', () => {
    it('shows STUDENTS tabs', async () => {
      mockMentorSettings = {
        ...dms(),
        platform_key: 'tenant123',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });
  });

  describe('Partial perms', () => {
    it('partial read ok', async () => {
      mockEnableRBAC = true;
      mockCheckRbacPermissionResult = true;
      mockMentorSettings = {
        ...dms(),
        permissions: { field: { mentor_name: { read: true, write: false } } },
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });

    it('all read false hides', async () => {
      mockEnableRBAC = true;
      mockCheckRbacPermissionResult = true;
      mockMentorSettings = {
        ...dms(),
        permissions: {
          field: {
            mentor_name: { read: false, write: true },
            mentor_description: { read: false, write: true },
            profile_image: { read: false, write: true },
            mentor_visibility: { read: false, write: true },
            metadata: { read: false, write: true },
            allow_anonymous: { read: false, write: true },
            is_lti_accessible: { read: false, write: true },
            show_attachment: { read: false, write: true },
            show_voice_call: { read: false, write: true },
            show_voice_record: { read: false, write: true },
          },
        },
      };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('Missing perms', () => {
    it('undefined perms ok', async () => {
      mockMentorSettings = { ...dms(), permissions: undefined };
      renderM();
      await waitFor(() =>
        expect(
          document.getElementById(
            `desktop-tab-${MODALS.EDIT_MENTOR.tabs.settings}`,
          ),
        ).toBeInTheDocument(),
      );
    });
  });
});
