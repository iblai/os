import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { LLMTab } from './llm-tab';
import { MENTOR_VISIBILITY } from '@/lib/constants';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockRbacPermissions = { mentors: { '/x/': { read: true } } };

const mockAgentSettingsProvider = vi.fn();
const mockAgentLLMTab = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// next-intl: echo the key (plus any ICU values) so every label mapping is
// assertable without pulling in the real message catalogs.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
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
    config: { ...actual.config, enableRBAC: () => mockEnableRBAC() },
  };
});

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: unknown) => {
    void selector;
    return mockRbacPermissions;
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
  AgentLLMTab: (props: unknown) => {
    mockAgentLLMTab(props);
    return <div data-testid="agent-llm-tab">AgentLLMTab</div>;
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const providerValue = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as Record<string, unknown>;
const tabProps = () =>
  mockAgentLLMTab.mock.calls.at(-1)![0] as Record<string, any>;
const labels = () => tabProps().labels;

// ============================================================================
// TESTS
// ============================================================================

describe('LLMTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({ tenantKey: 'acme', mentorId: 'mentor-1' });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('jane');
    mockEnableRBAC.mockReturnValue(false);
  });

  afterEach(() => cleanup());

  describe('Provider wiring', () => {
    it('wraps AgentLLMTab in an AgentSettingsProvider with the resolved identity + config', () => {
      render(<LLMTab />);

      expect(screen.getByTestId('agent-settings-provider')).toBeInTheDocument();
      expect(screen.getByTestId('agent-llm-tab')).toBeInTheDocument();

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
      render(<LLMTab />);
      expect(providerValue().enableRBAC).toBe(true);
    });

    it('routes executeGatedAction through the OS paywall check', () => {
      render(<LLMTab />);
      const fn = vi.fn();
      (providerValue().executeGatedAction as (f: () => unknown) => unknown)(fn);
      expect(mockExecuteWithTrialCheck).toHaveBeenCalledWith(fn);
    });

    it('leaves getLLMProviderDetails to the SDK default', () => {
      render(<LLMTab />);
      expect(tabProps().getLLMProviderDetails).toBeUndefined();
    });
  });

  describe('showConfigurationHeader', () => {
    it('defaults to true (Edit Mentor modal slot)', () => {
      render(<LLMTab />);
      expect(tabProps().showConfigurationHeader).toBe(true);
    });

    it('forwards false (nav-bar LLM Providers dialog)', () => {
      render(<LLMTab showConfigurationHeader={false} />);
      expect(tabProps().showConfigurationHeader).toBe(false);
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() when provided, on both the provider and the tab', () => {
      mockGetMentorId.mockReturnValue('nav-mentor');
      render(<LLMTab />);
      expect(providerValue().mentorId).toBe('nav-mentor');
      expect(tabProps().mentorId).toBe('nav-mentor');
    });

    it('falls back to params.mentorId when getMentorId() is empty', () => {
      mockGetMentorId.mockReturnValue(null);
      render(<LLMTab />);
      expect(providerValue().mentorId).toBe('mentor-1');
      expect(tabProps().mentorId).toBe('mentor-1');
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: undefined, mentorId: 'm' });
      const { container } = render(<LLMTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'acme', mentorId: undefined });
      mockGetMentorId.mockReturnValue(null);
      const { container } = render(<LLMTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);
      const { container } = render(<LLMTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });
  });

  describe('Labels override (agent -> OS wording)', () => {
    it('maps the tab-level slots to the tabsLlmTab namespace', () => {
      render(<LLMTab />);
      const l = labels();
      expect(l.header.title).toBe('llmConfiguration');
      expect(l.header.description).toBe('configureLanguageModelSettings');
      expect(l.infoBox).toBe('infoBox');
      expect(l.search.placeholder).toBe('searchProviders');
      expect(l.toasts.updateSuccess).toBe('llmUpdatedSuccessfully');
      expect(l.toasts.updateError).toBe('failedToUpdateLlm');
    });

    it('maps the provider-modal slots to the modalsLlmProviderModal namespace', () => {
      render(<LLMTab />);
      const pm = labels().providerModal;
      expect(pm.title).toBe('title');
      expect(pm.searchPlaceholder).toBe('searchPlaceholder');
      // OS names this string "subtitle"; the SDK slot is helpText.
      expect(pm.helpText).toBe('subtitle');
      expect(pm.tooLargeTitle).toBe('tooLargeTitle');
      expect(pm.cancel).toBe('cancel');
      expect(pm.downloadAnyway).toBe('downloadAnyway');
      expect(pm.alreadyDownloadingTitle).toBe('alreadyDownloadingTitle');
      expect(pm.unnamedModel).toBe('unnamedModel');
      expect(pm.gotIt).toBe('gotIt');
      expect(pm.announceCancelled).toBe('announceCancelled');
      expect(pm.announceFailed).toBe('announceFailed');
    });

    it('maps the on-device row slots', () => {
      render(<LLMTab />);
      const lm = labels().providerModal.localModel;
      expect(lm.onDevice).toBe('localModel.onDevice');
      expect(lm.starting).toBe('localModel.starting');
      expect(lm.cancel).toBe('localModel.cancel');
      expect(lm.inUse).toBe('localModel.inUse');
      expect(lm.downloadFailedRetry).toBe('localModel.downloadFailedRetry');
    });

    it('renders the parameterised slots as ICU calls with the right values', () => {
      render(<LLMTab />);
      const l = labels();
      const pm = l.providerModal;
      const lm = pm.localModel;

      expect(l.providerLogoAlt('OpenAI')).toBe(
        'providerLogoAlt:{"providerName":"OpenAI"}',
      );
      expect(pm.description('OpenAI')).toBe(
        'dialogDescription:{"providerName":"OpenAI"}',
      );
      expect(pm.providerIconAlt('Meta')).toBe(
        'providerIconAlt:{"providerName":"Meta"}',
      );
      expect(pm.tooLargeDescription('Llama 3.2', '2 GB')).toBe(
        'tooLargeDescription:{"modelName":"Llama 3.2","modelSize":"2 GB"}',
      );
      expect(pm.alreadyDownloadingDescription('Llama 3.2')).toBe(
        'alreadyDownloadingDescription:{"modelName":"Llama 3.2"}',
      );
      expect(pm.announceDownloaded('Llama 3.2')).toBe(
        'announceDownloaded:{"modelName":"Llama 3.2"}',
      );
      expect(pm.announceStarted('Llama 3.2')).toBe(
        'announceStarted:{"modelName":"Llama 3.2"}',
      );
      expect(lm.ariaDownload('Llama 3.2', '2 GB')).toBe(
        'localModel.ariaDownload:{"modelName":"Llama 3.2","modelSize":"2 GB"}',
      );
      expect(lm.ariaStarting('Llama 3.2')).toBe(
        'localModel.ariaStarting:{"modelName":"Llama 3.2"}',
      );
      expect(lm.ariaDownloading('Llama 3.2', 42)).toBe(
        'localModel.ariaDownloading:{"modelName":"Llama 3.2","percent":42}',
      );
      expect(lm.ariaInstalled('Llama 3.2')).toBe(
        'localModel.ariaInstalled:{"modelName":"Llama 3.2"}',
      );
      expect(lm.ariaSelected('Llama 3.2')).toBe(
        'localModel.ariaSelected:{"modelName":"Llama 3.2"}',
      );
      expect(lm.ariaError('Llama 3.2')).toBe(
        'localModel.ariaError:{"modelName":"Llama 3.2"}',
      );
      expect(lm.ariaErrorWithReason('Llama 3.2', 'disk full')).toBe(
        'localModel.ariaErrorWithReason:{"modelName":"Llama 3.2","reason":"disk full"}',
      );
    });
  });

  // Every SDK label slot must be filled by the OS mapping — a missing one would
  // silently fall back to the SDK's own "agent" wording.
  describe('Label catalog parity', () => {
    it('ships an OS string for every key the SDK asks for', async () => {
      const catalogs = {
        en: (await import('../../../messages/en.json')).default,
        es: (await import('../../../messages/es.json')).default,
        fr: (await import('../../../messages/fr.json')).default,
        zh: (await import('../../../messages/zh.json')).default,
      };

      const tabKeys = [
        'infoBox',
        'llmUpdatedSuccessfully',
        'failedToUpdateLlm',
        'llmConfiguration',
        'configureLanguageModelSettings',
        'searchProviders',
        'providerLogoAlt',
      ];
      const modalKeys = [
        'dialogDescription',
        'title',
        'subtitle',
        'searchPlaceholder',
        'providerIconAlt',
        'tooLargeTitle',
        'tooLargeDescription',
        'cancel',
        'downloadAnyway',
        'alreadyDownloadingTitle',
        'unnamedModel',
        'alreadyDownloadingDescription',
        'gotIt',
        'announceDownloaded',
        'announceCancelled',
        'announceFailed',
        'announceStarted',
      ];
      const localModelKeys = [
        'onDevice',
        'starting',
        'cancel',
        'inUse',
        'downloadFailedRetry',
        'ariaDownload',
        'ariaStarting',
        'ariaDownloading',
        'ariaInstalled',
        'ariaSelected',
        'ariaError',
        'ariaErrorWithReason',
      ];

      for (const [locale, messages] of Object.entries(catalogs)) {
        const m = messages as unknown as Record<string, any>;
        for (const key of tabKeys) {
          expect(
            m.tabsLlmTab?.[key],
            `${locale}.tabsLlmTab.${key}`,
          ).toBeTruthy();
        }
        for (const key of modalKeys) {
          expect(
            m.modalsLlmProviderModal?.[key],
            `${locale}.modalsLlmProviderModal.${key}`,
          ).toBeTruthy();
        }
        for (const key of localModelKeys) {
          expect(
            m.modalsLlmProviderModal?.localModel?.[key],
            `${locale}.modalsLlmProviderModal.localModel.${key}`,
          ).toBeTruthy();
        }
      }
    });
  });
});
