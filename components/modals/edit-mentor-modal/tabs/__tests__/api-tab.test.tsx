import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { ApiTab } from '../api-tab';

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockAgentSettingsProvider = vi.fn();
const mockAgentApiTab = vi.fn();
const rbacPermissions = { '/apitokens/#list': true };

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
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

vi.mock('@/lib/config', () => ({
  config: { enableRBAC: () => mockEnableRBAC() },
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (
    selector: (state: { rbac: { rbacPermissions: object } }) => unknown,
  ) => selector({ rbac: { rbacPermissions } }),
}));

vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentSettingsProvider: ({
    children,
    ...value
  }: {
    children: React.ReactNode;
  } & Record<string, unknown>) => {
    mockAgentSettingsProvider(value);
    return <div data-testid="agent-settings-provider">{children}</div>;
  },
  AgentApiTab: (props: unknown) => {
    mockAgentApiTab(props);
    return <div data-testid="agent-api-tab" />;
  },
}));

const providerValue = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as {
    executeGatedAction: (fn: () => unknown) => unknown;
  };

describe('ApiTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'route-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('test-user');
    mockEnableRBAC.mockReturnValue(false);
  });

  afterEach(() => cleanup());

  it('renders the SDK tab inside the provider with the route identity and RBAC permissions', () => {
    render(<ApiTab />);

    expect(screen.getByTestId('agent-settings-provider')).toContainElement(
      screen.getByTestId('agent-api-tab'),
    );
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith({
      tenantKey: 'test-tenant',
      mentorId: 'route-mentor',
      username: 'test-user',
      enableRBAC: false,
      rbacPermissions,
      executeGatedAction: expect.any(Function),
    });
  });

  it('passes no label overrides so the SDK catalog copy is used', () => {
    render(<ApiTab />);
    expect(mockAgentApiTab).toHaveBeenCalledWith({});
  });

  it('routes gated actions (create / delete) through the OS paywall check', () => {
    mockExecuteWithTrialCheck.mockReturnValue('gated-result');
    render(<ApiTab />);
    const action = vi.fn();

    expect(providerValue().executeGatedAction(action)).toBe('gated-result');
    expect(mockExecuteWithTrialCheck).toHaveBeenCalledWith(action);
  });

  it('prefers the modal-stack mentor over the route mentor', () => {
    mockGetMentorId.mockReturnValue('modal-mentor');
    render(<ApiTab />);
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ mentorId: 'modal-mentor' }),
    );
  });

  it('forwards enableRBAC from config', () => {
    mockEnableRBAC.mockReturnValue(true);
    render(<ApiTab />);
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ enableRBAC: true }),
    );
  });

  it.each([
    ['username', () => mockUseUsername.mockReturnValue(null)],
    [
      'tenantKey',
      () => mockUseParams.mockReturnValue({ mentorId: 'route-mentor' }),
    ],
    [
      'mentorId',
      () => mockUseParams.mockReturnValue({ tenantKey: 'test-tenant' }),
    ],
  ])('renders nothing while %s is missing', (_, arrange) => {
    arrange();
    const { container } = render(<ApiTab />);
    expect(container).toBeEmptyDOMElement();
    expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
  });
});
