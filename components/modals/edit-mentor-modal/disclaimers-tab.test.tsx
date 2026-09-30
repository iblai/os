import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { DisclaimersTab } from './disclaimers-tab';
import { DEFAULT_DISCLAIMER_CONTENT } from '@/constants/disclaimer';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockRbacPermissions = { mentors: { '/x/': { read: true } } };

const mockAgentSettingsProvider = vi.fn();
const mockAgentDisclaimersTab = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// next-intl: echo `namespace.key` (plus any ICU params) so every SDK label
// slot is provably wired to the right OS translation key.
vi.mock('next-intl', () => ({
  useTranslations:
    (namespace: string) => (key: string, params?: Record<string, unknown>) =>
      params
        ? `${namespace}.${key}:${JSON.stringify(params)}`
        : `${namespace}.${key}`,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
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
  useAppSelector: (selector: unknown) => {
    void selector;
    return mockRbacPermissions;
  },
}));

vi.mock('@/components/markdown', () => ({
  default: ({
    children,
    className,
  }: {
    children: string;
    className?: string;
  }) => (
    <div data-testid="markdown" className={className}>
      {children}
    </div>
  ),
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
  AgentDisclaimersTab: (props: unknown) => {
    mockAgentDisclaimersTab(props);
    return <div data-testid="agent-disclaimers-tab">AgentDisclaimersTab</div>;
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const providerValue = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as Record<string, unknown>;
const tabProps = () =>
  mockAgentDisclaimersTab.mock.calls.at(-1)![0] as Record<string, any>;

// ============================================================================
// TESTS
// ============================================================================

describe('DisclaimersTab', () => {
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
  });

  afterEach(() => cleanup());

  describe('Provider wiring', () => {
    it('wraps AgentDisclaimersTab in an AgentSettingsProvider with the resolved identity + RBAC', () => {
      render(<DisclaimersTab />);

      expect(screen.getByTestId('agent-settings-provider')).toBeInTheDocument();
      expect(screen.getByTestId('agent-disclaimers-tab')).toBeInTheDocument();

      const value = providerValue();
      expect(value.tenantKey).toBe('acme');
      expect(value.mentorId).toBe('mentor-1');
      expect(value.username).toBe('jane');
      expect(value.enableRBAC).toBe(false);
      expect(value.rbacPermissions).toBe(mockRbacPermissions);
    });

    it('forwards the config-derived enableRBAC flag', () => {
      mockEnableRBAC.mockReturnValue(true);
      render(<DisclaimersTab />);
      expect(providerValue().enableRBAC).toBe(true);
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor');
      render(<DisclaimersTab />);
      expect(providerValue().mentorId).toBe('nav-mentor');
    });

    it('falls back to params.mentorId when getMentorId() is null', () => {
      mockGetMentorId.mockReturnValue(null);
      render(<DisclaimersTab />);
      expect(providerValue().mentorId).toBe('mentor-1');
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: undefined, mentorId: 'm' });
      const { container } = render(<DisclaimersTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'acme', mentorId: undefined });
      mockGetMentorId.mockReturnValue(null);
      const { container } = render(<DisclaimersTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });

    it('renders nothing when username is null', () => {
      mockUseUsername.mockReturnValue(null);
      const { container } = render(<DisclaimersTab />);
      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    });
  });

  describe('Tab props', () => {
    it('passes the OS default user-agreement text', () => {
      render(<DisclaimersTab />);
      expect(tabProps().defaultDisclaimerContent).toBe(
        DEFAULT_DISCLAIMER_CONTENT,
      );
    });

    it('renders card content through the OS Markdown component after parsePrompt', () => {
      render(<DisclaimersTab />);
      const { container } = render(
        <>{tabProps().renderContent('Hello **world**')}</>,
      );
      const markdown = container.querySelector('[data-testid="markdown"]')!;
      expect(markdown).toHaveClass('text-sm', 'text-gray-700');
      expect(markdown).toHaveTextContent('Hello **world**');
    });
  });

  describe('Labels override (OS i18n wording)', () => {
    it('maps every SDK label slot onto the existing OS translation keys', () => {
      render(<DisclaimersTab />);
      const labels = tabProps().labels;

      expect(labels.header).toEqual({
        title: 'disclaimersTabIndex.heading',
        description: 'disclaimersTabIndex.subheading',
      });
      expect(labels.infoBox).toBe('disclaimersTabIndex.infoBox');
      expect(labels.userAgreement.title).toBe(
        'disclaimersTabIndex.userAgreementTitle',
      );
      expect(labels.userAgreement.editTitle).toBe(
        'disclaimersTabEditUserAgreementModal.title',
      );
      expect(labels.advisory.tooltip).toBe(
        'disclaimersTabIndex.advisoryTooltip',
      );
      expect(labels.advisory.editPlaceholder).toBe(
        'disclaimersTabEditDisclaimerModal.advisoryContentPlaceholder',
      );
      expect(labels.actions).toEqual({
        edit: 'disclaimersTabIndex.editButton',
        save: 'disclaimersTabEditUserAgreementModal.saveButton',
        saving: 'disclaimersTabEditUserAgreementModal.savingButton',
        cancel: 'disclaimersTabEditUserAgreementModal.cancelButton',
        viewAgreements: 'disclaimersTabIndex.viewAgreements',
      });
      // The monolith rendered one ICU toast with a `{status}` param; the SDK
      // wants the two resolved strings.
      expect(labels.toasts.userAgreementEnabled).toBe(
        'disclaimersTabIndex.userAgreementToggledSuccess:{"status":"enabled"}',
      );
      expect(labels.toasts.userAgreementDisabled).toBe(
        'disclaimersTabIndex.userAgreementToggledSuccess:{"status":"disabled"}',
      );
      expect(labels.toasts.toggleError).toBe(
        'disclaimersTabIndex.userAgreementUpdatedError',
      );
      expect(labels.agreements.title).toBe('disclaimersTabAgreements.title');
      expect(labels.agreements.dialogDescription).toBe(
        'disclaimersTabAgreements.dialogDescription',
      );
      expect(labels.agreements.totalAgreements(3)).toBe(
        'disclaimersTabAgreements.totalAgreements:{"count":3}',
      );
      expect(labels.agreements.noMatchesDescription).toBe(
        'disclaimersTabAgreements.noMatchesDescription',
      );
    });
  });
});
