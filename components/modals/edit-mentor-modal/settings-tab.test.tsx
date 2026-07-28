import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SettingsTab } from './settings-tab';
import { MENTOR_VISIBILITY, MODALS } from '@/lib/constants';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockRouterReplace = vi.fn();
const mockGetMentorId = vi.fn();
const mockCloseEditMentorModal = vi.fn();
const mockNavigateToMentor = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockDispatch = vi.fn();
const mockRbacPermissions = { mentors: { '/x/': { read: true } } };
const mockUseGetUserTenantsQuery = vi.fn();
const mockHandleTenantSwitch = vi.fn();
const mockInvalidateTags = vi.fn((tags: string[]) => ({
  type: 'invalidate',
  tags,
}));

const mockAgentSettingsProvider = vi.fn();
const mockAgentSettingsTab = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ replace: mockRouterReplace }),
}));

// next-intl: echo the key so label mappings are assertable. Namespaced calls
// all share this echo — that's enough to prove each SDK label slot is wired to
// the right OS translation key.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
    closeEditMentorModal: mockCloseEditMentorModal,
    navigateToMentor: mockNavigateToMentor,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
  }),
}));

vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    config: {
      ...actual.config,
      enableRBAC: () => mockEnableRBAC(),
    },
  };
});

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: unknown) => {
    void selector;
    return mockRbacPermissions;
  },
}));

vi.mock('@/features/tenants/api-slice', () => ({
  useGetUserTenantsQuery: () => mockUseGetUserTenantsQuery(),
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    handleTenantSwitch: (...args: unknown[]) => mockHandleTenantSwitch(...args),
  };
});

vi.mock('@iblai/iblai-js/data-layer', () => ({
  chatPrivacyApiSlice: {
    util: {
      invalidateTags: (tags: string[]) => mockInvalidateTags(tags),
    },
  },
}));

vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentSettingsProvider: ({
    children,
    ...value
  }: {
    children: React.ReactNode;
  }) => {
    mockAgentSettingsProvider(value);
    return <div data-testid="agent-settings-provider">{children}</div>;
  },
  AgentSettingsTab: (props: unknown) => {
    mockAgentSettingsTab(props);
    return <div data-testid="agent-settings-tab">AgentSettingsTab</div>;
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const providerValue = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as Record<string, unknown>;
const tabProps = () =>
  mockAgentSettingsTab.mock.calls.at(-1)![0] as Record<string, any>;

// ============================================================================
// TESTS
// ============================================================================

describe('SettingsTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'acme',
      mentorId: 'mentor-1',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('jane');
    mockEnableRBAC.mockReturnValue(false);
    mockUseGetUserTenantsQuery.mockReturnValue({
      data: [
        { key: 'acme', name: 'Acme', is_admin: true },
        { key: 'beta', name: null, is_admin: false },
      ],
      isLoading: false,
    });
  });

  afterEach(() => cleanup());

  describe('Provider wiring', () => {
    it('wraps AgentSettingsTab in an AgentSettingsProvider with the resolved identity + config', () => {
      render(<SettingsTab />);

      expect(screen.getByTestId('agent-settings-provider')).toBeInTheDocument();
      expect(screen.getByTestId('agent-settings-tab')).toBeInTheDocument();

      const value = providerValue();
      expect(value.tenantKey).toBe('acme');
      expect(value.mentorId).toBe('mentor-1');
      expect(value.username).toBe('jane');
      expect(value.enableRBAC).toBe(false);
      expect(value.rbacPermissions).toBe(mockRbacPermissions);
      expect(value.visibilityOptions).toEqual(MENTOR_VISIBILITY);
    });

    it('forwards the config-derived enableRBAC flag', () => {
      mockEnableRBAC.mockReturnValue(true);
      render(<SettingsTab />);
      expect(providerValue().enableRBAC).toBe(true);
    });

    it('routes executeGatedAction through the OS paywall check', () => {
      render(<SettingsTab />);
      const fn = vi.fn();
      (providerValue().executeGatedAction as (f: () => unknown) => unknown)(fn);
      expect(mockExecuteWithTrialCheck).toHaveBeenCalledWith(fn);
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor');
      render(<SettingsTab />);
      expect(providerValue().mentorId).toBe('nav-mentor');
    });

    it('falls back to params.mentorId when getMentorId() is null', () => {
      mockGetMentorId.mockReturnValue(null);
      render(<SettingsTab />);
      expect(providerValue().mentorId).toBe('mentor-1');
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: undefined, mentorId: 'm' });
      const { container } = render(<SettingsTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'acme', mentorId: undefined });
      mockGetMentorId.mockReturnValue(null);
      const { container } = render(<SettingsTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);
      const { container } = render(<SettingsTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });
  });

  describe('Tenant list', () => {
    it('maps the tenants query to the CopyMentorTenant shape', () => {
      render(<SettingsTab />);
      expect(tabProps().tenants).toEqual([
        { key: 'acme', name: 'Acme', is_admin: true },
        { key: 'beta', name: null, is_admin: false },
      ]);
      expect(tabProps().isLoadingTenants).toBe(false);
    });

    it('defaults to an empty tenant list while the query is loading', () => {
      mockUseGetUserTenantsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      render(<SettingsTab />);
      expect(tabProps().tenants).toEqual([]);
      expect(tabProps().isLoadingTenants).toBe(true);
    });
  });

  describe('Labels override (agent -> mentor/OS wording)', () => {
    it('maps translated strings and reproduces the hard-coded ones', () => {
      render(<SettingsTab />);
      const labels = tabProps().labels;

      expect(labels.header.title).toBe('settingsHeading');
      expect(labels.actions.save).toBe('saveButton');
      expect(labels.toasts.saveSuccess).toBe('agentUpdatedSuccess');
      expect(labels.deleteModal.title).toBe('title');
      expect(labels.copyModal.title).toBe('dialogTitle');
      expect(labels.copyModal.defaultNamePrefix).toBe('defaultCopyNamePrefix');

      // Who-can-view options match MENTOR_VISIBILITY labels.
      expect(labels.fields.whoCanView.options).toEqual({
        administrators: 'Administrators',
        students: 'Users',
        anyone: 'Anyone',
      });

      // Strings the monolith hard-coded in English (no i18n key).
      expect(labels.fields.showReasoning.label).toBe(
        'Enable verbose reasoning',
      );
      expect(labels.fields.privateMode.label).toBe('Enable private mode');

      // Sub-tabs, section headings, and the full Capabilities toggle set are
      // all wired to their OS i18n keys.
      expect(labels.subTabs).toEqual({
        basic: 'tabBasic',
        discovery: 'tabDiscovery',
        capabilities: 'tabCapabilities',
      });
      expect(labels.sections).toEqual({
        chatExperience: 'chatExperienceHeading',
        voiceCalls: 'voiceCallsHeading',
        advanced: 'advancedHeading',
      });
      expect(labels.fields.enhancedDocRetrieval.label).toBe(
        'enhancedDocRetrievalLabel',
      );
      expect(labels.fields.promptCaching.label).toBe(
        'enablePromptCachingLabel',
      );
      expect(labels.fields.smartDocRetrieval.label).toBe(
        'smartDocRetrievalLabel',
      );
      expect(labels.toasts.voiceCallError).toBe('voiceCallSettingsError');
    });
  });

  // The SDK builds the copy's default name as `${prefix} ${sourceName}` — it
  // owns the separator. A prefix that carries its own trailing space (as an
  // ICU "Copy of {name}" rendered with an empty name did) produces
  // "Copy of  Agent" on the copied agent, so keep every catalog value bare.
  describe('Copy-name prefix catalogs', () => {
    it('stores a bare prefix with no separator or placeholder', async () => {
      const catalogs = {
        en: (await import('../../../messages/en.json')).default,
        es: (await import('../../../messages/es.json')).default,
        fr: (await import('../../../messages/fr.json')).default,
        zh: (await import('../../../messages/zh.json')).default,
      };

      for (const [locale, messages] of Object.entries(catalogs)) {
        const prefix = (
          messages as unknown as {
            settingsTabCopyMentorModal: { defaultCopyNamePrefix: string };
          }
        ).settingsTabCopyMentorModal.defaultCopyNamePrefix;

        expect(prefix, locale).toBeTruthy();
        expect(prefix, locale).toBe(prefix.trim());
        expect(prefix, locale).not.toContain('{name}');
      }
    });
  });

  describe('onSuccessfulSave', () => {
    it('invalidates the chat-privacy cache tag', () => {
      render(<SettingsTab />);
      tabProps().onSuccessfulSave({});
      expect(mockInvalidateTags).toHaveBeenCalledWith(['ChatPrivacyEffective']);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'invalidate',
        tags: ['ChatPrivacyEffective'],
      });
    });
  });

  describe('onSuccessfulDelete', () => {
    it('closes the modal and returns to Explore when the page mentor is deleted', () => {
      render(<SettingsTab />);
      tabProps().onSuccessfulDelete('mentor-1');
      expect(mockCloseEditMentorModal).toHaveBeenCalled();
      expect(mockRouterReplace).toHaveBeenCalledWith('/platform/acme/explore');
    });

    it('closes the modal but stays put when a different mentor is deleted', () => {
      mockGetMentorId.mockReturnValue('nav-mentor');
      render(<SettingsTab />);
      tabProps().onSuccessfulDelete('nav-mentor');
      expect(mockCloseEditMentorModal).toHaveBeenCalled();
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  describe('onSuccessfulCopy', () => {
    it('navigates to the new mentor for a same-tenant copy', () => {
      render(<SettingsTab />);
      tabProps().onSuccessfulCopy({
        forkedMentorId: 'fork-1',
        destinationTenantKey: 'acme',
        isCrossTenantCopy: false,
      });
      const expectedStack = JSON.stringify([
        {
          name: MODALS.EDIT_MENTOR.name,
          tab: MODALS.EDIT_MENTOR.tabs.settings,
        },
      ]);
      expect(mockNavigateToMentor).toHaveBeenCalledWith(
        'fork-1',
        `modal=${expectedStack}`,
      );
      expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
    });

    it('switches tenants for a cross-tenant copy', () => {
      render(<SettingsTab />);
      tabProps().onSuccessfulCopy({
        forkedMentorId: 'fork-2',
        destinationTenantKey: 'beta',
        isCrossTenantCopy: true,
      });
      expect(mockHandleTenantSwitch).toHaveBeenCalledTimes(1);
      const [dest, flag, url] = mockHandleTenantSwitch.mock.calls[0];
      expect(dest).toBe('beta');
      expect(flag).toBe(false);
      expect(url).toContain('/platform/beta/fork-2?modal=');
      expect(mockNavigateToMentor).not.toHaveBeenCalled();
    });
  });
});
