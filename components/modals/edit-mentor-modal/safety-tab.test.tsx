import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SafetyTab } from './safety-tab';

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockCheckRbacPermission = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockCloseModal = vi.fn();
const mockFreeTrial = {
  isModalOpen: false,
  FreeTrialDialog: null as React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
  }> | null,
};
const mockRbacPermissions = { mentors: { '/x/': { read: true } } };

const mockAgentSettingsProvider = vi.fn();
const mockAgentSafetyTab = vi.fn();
const mockFlaggedPromptsModal = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
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
    isModalOpen: mockFreeTrial.isModalOpen,
    FreeTrialDialog: mockFreeTrial.FreeTrialDialog,
    closeModal: mockCloseModal,
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
  useAppSelector: () => mockRbacPermissions,
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

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorSettingsQuery(...args),
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

vi.mock('./tabs/safety-tab/flagged-prompts', () => ({
  FlaggedPromptsModal: (props: Record<string, unknown>) => {
    mockFlaggedPromptsModal(props);
    return <div data-testid="flagged-prompts-modal" />;
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
  AgentSafetyTab: (props: {
    FlaggedPromptsModal: React.ComponentType<Record<string, unknown>>;
  }) => {
    mockAgentSafetyTab(props);
    const { FlaggedPromptsModal } = props;
    return (
      <div data-testid="agent-safety-tab">
        <FlaggedPromptsModal
          isOpen
          onClose={() => {}}
          mentorId="m"
          tenantKey="t"
          username="u"
        />
      </div>
    );
  },
}));

const providerValue = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as Record<string, any>;
const tabProps = () =>
  mockAgentSafetyTab.mock.calls.at(-1)![0] as Record<string, any>;

describe('SafetyTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'acme', mentorId: 'mentor-1' });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('jane');
    mockEnableRBAC.mockReturnValue(false);
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });
    mockCheckRbacPermission.mockReturnValue(true);
    mockFreeTrial.isModalOpen = false;
    mockFreeTrial.FreeTrialDialog = null;
  });

  afterEach(() => cleanup());

  it('wraps AgentSafetyTab in a provider with identity, RBAC and the paywall gate', () => {
    mockEnableRBAC.mockReturnValue(true);
    render(<SafetyTab />);

    expect(screen.getByTestId('agent-safety-tab')).toBeInTheDocument();
    const value = providerValue();
    expect(value.tenantKey).toBe('acme');
    expect(value.mentorId).toBe('mentor-1');
    expect(value.username).toBe('jane');
    expect(value.enableRBAC).toBe(true);
    expect(value.rbacPermissions).toBe(mockRbacPermissions);

    const fn = vi.fn();
    value.executeGatedAction(fn);
    expect(mockExecuteWithTrialCheck).toHaveBeenCalledWith(fn);
  });

  it('prefers the navigate mentor id over the route param', () => {
    mockGetMentorId.mockReturnValue('nav-mentor');
    render(<SafetyTab />);
    expect(providerValue().mentorId).toBe('nav-mentor');
    expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
      { mentor: 'nav-mentor', org: 'acme', userId: 'jane' },
      { skip: false },
    );
  });

  it.each([
    ['tenantKey', { tenantKey: undefined, mentorId: 'mentor-1' }, 'jane'],
    ['mentorId', { tenantKey: 'acme', mentorId: undefined }, 'jane'],
    ['username', { tenantKey: 'acme', mentorId: 'mentor-1' }, null],
  ])('renders nothing and skips the query without %s', (_, params, user) => {
    mockUseParams.mockReturnValue(params);
    mockUseUsername.mockReturnValue(user);
    const { container } = render(<SafetyTab />);
    expect(container).toBeEmptyDOMElement();
    expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
    expect(mockUseGetMentorSettingsQuery.mock.calls.at(-1)![0]).toEqual(
      expect.objectContaining({ userId: user ?? '' }),
    );
    expect(mockUseGetMentorSettingsQuery.mock.calls.at(-1)![1]).toEqual({
      skip: true,
    });
  });

  it('gates the flagged-prompts button on the #view_moderation_logs permission', () => {
    mockCheckRbacPermission.mockReturnValue(false);
    render(<SafetyTab />);
    expect(mockCheckRbacPermission).toHaveBeenCalledWith(
      mockRbacPermissions,
      '/mentors/42/#view_moderation_logs',
    );
    expect(tabProps().showFlaggedPrompts).toBe(false);
  });

  it('shows the flagged-prompts button when permitted', () => {
    render(<SafetyTab />);
    expect(tabProps().showFlaggedPrompts).toBe(true);
  });

  it('injects the lazily loaded OS flagged-prompts modal', async () => {
    render(<SafetyTab />);
    expect(
      await screen.findByTestId('flagged-prompts-modal'),
    ).toBeInTheDocument();
    expect(mockFlaggedPromptsModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        mentorId: 'm',
        tenantKey: 't',
        username: 'u',
      }),
    );
  });

  it('renders prompt content as parsed Markdown', () => {
    render(<SafetyTab />);
    render(<>{tabProps().renderPromptContent('Hello **there**')}</>);
    const md = screen.getByTestId('markdown');
    expect(md).toHaveClass('text-sm', 'text-gray-700');
    expect(md).toHaveTextContent('Hello **there**');
  });

  it('maps every label slot onto the OS next-intl keys', () => {
    render(<SafetyTab />);
    const ns = 'tabsSafetyTab';
    expect(tabProps().labels).toEqual({
      header: {
        title: `${ns}.safetyTitle`,
        description: `${ns}.safetyDescription`,
      },
      prompts: {
        moderation: {
          title: `${ns}.moderationPromptTitle`,
          tooltip: `${ns}.moderationPromptTooltipContent`,
          activeLabel: `${ns}.active`,
          inactiveLabel: `${ns}.inactive`,
        },
        safety: {
          title: `${ns}.safetyPromptTitle`,
          tooltip: `${ns}.safetyPromptTooltipContent`,
          activeLabel: `${ns}.active`,
          inactiveLabel: `${ns}.inactive`,
        },
        moderationResponse: { title: `${ns}.moderationResponseTitle` },
        safetyResponse: { title: `${ns}.safetyResponseTitle` },
      },
      actions: {
        edit: `${ns}.edit`,
        viewFlaggedPrompts: `${ns}.viewFlaggedPrompts`,
      },
      toasts: {
        updateSuccess: `${ns}.agentUpdatedSuccess`,
        updateError: `${ns}.agentUpdateFailed`,
      },
    });
  });

  it('renders the free-trial dialog when the paywall opens it', () => {
    const dialog = vi.fn(({ onClose }: { onClose: () => void }) => (
      <button data-testid="free-trial" onClick={onClose} />
    ));
    mockFreeTrial.isModalOpen = true;
    mockFreeTrial.FreeTrialDialog = dialog;
    render(<SafetyTab />);
    screen.getByTestId('free-trial').click();
    expect(mockCloseModal).toHaveBeenCalled();
  });

  it('does not render the free-trial dialog while closed', () => {
    mockFreeTrial.FreeTrialDialog = function ClosedDialog() {
      return <div data-testid="free-trial" />;
    };
    render(<SafetyTab />);
    expect(screen.queryByTestId('free-trial')).not.toBeInTheDocument();
  });
});
