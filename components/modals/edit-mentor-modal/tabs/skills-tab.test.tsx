import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SkillsTab } from './skills-tab';

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockRbacPermissions = { mentors: { '/x/': { read: true } } };

const mockAgentSettingsProvider = vi.fn();
const mockAgentSkillsTab = vi.fn();

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
  AgentSkillsTab: (props: unknown) => {
    mockAgentSkillsTab(props);
    return <div data-testid="agent-skills-tab">AgentSkillsTab</div>;
  },
}));

const providerValue = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as Record<string, unknown>;
const tabProps = () =>
  mockAgentSkillsTab.mock.calls.at(-1)![0] as Record<string, unknown>;

describe('SkillsTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'acme', mentorId: 'mentor-1' });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('jane');
    mockEnableRBAC.mockReturnValue(false);
  });

  afterEach(() => cleanup());

  it('wraps AgentSkillsTab in a provider carrying the OS identity and RBAC', () => {
    mockEnableRBAC.mockReturnValue(true);
    render(<SkillsTab />);

    expect(screen.getByTestId('agent-skills-tab')).toBeInTheDocument();
    expect(providerValue()).toEqual({
      tenantKey: 'acme',
      mentorId: 'mentor-1',
      username: 'jane',
      enableRBAC: true,
      rbacPermissions: mockRbacPermissions,
    });
  });

  it('prefers the navigation-selected mentor over the route param', () => {
    mockGetMentorId.mockReturnValue('nav-mentor');
    render(<SkillsTab />);

    expect(providerValue().mentorId).toBe('nav-mentor');
  });

  it('maps only the title so the SDK description keeps its "type /" hint', () => {
    render(<SkillsTab />);

    expect(tabProps()).toEqual({
      labels: { header: { title: 'tabsSkillsTab.heading' } },
    });
  });

  it.each([
    ['tenantKey', { tenantKey: undefined, mentorId: 'mentor-1' }, 'jane'],
    ['mentorId', { tenantKey: 'acme', mentorId: undefined }, 'jane'],
    ['username', { tenantKey: 'acme', mentorId: 'mentor-1' }, null],
  ])('renders nothing until %s is known', (_, params, username) => {
    mockUseParams.mockReturnValue(params);
    mockUseUsername.mockReturnValue(username);
    const { container } = render(<SkillsTab />);

    expect(container).toBeEmptyDOMElement();
    expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
  });
});
