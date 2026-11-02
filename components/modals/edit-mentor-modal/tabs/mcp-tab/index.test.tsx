import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { McpTab } from './index';

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockExecuteWithTrialCheck = vi.fn();
const mockAgentSettingsProvider = vi.fn();
const mockSdkMcpTab = vi.fn();
const rbacPermissions = { '/mcpservers/': { list: true, create: false } };

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
  McpTab: (props: unknown) => {
    mockSdkMcpTab(props);
    return <div data-testid="sdk-mcp-tab" />;
  },
}));

const providerValue = () =>
  mockAgentSettingsProvider.mock.calls.at(-1)![0] as {
    executeGatedAction: (fn: () => unknown) => unknown;
  };

describe('McpTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'route-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('test-user');
    mockEnableRBAC.mockReturnValue(true);
  });

  afterEach(() => cleanup());

  it('renders the SDK tab inside the provider with the route identity and RBAC permissions', () => {
    render(<McpTab />);

    expect(screen.getByTestId('sdk-mcp-tab')).toBeInTheDocument();
    expect(providerValue()).toMatchObject({
      tenantKey: 'test-tenant',
      mentorId: 'route-mentor',
      username: 'test-user',
      enableRBAC: true,
      rbacPermissions,
    });
    expect(mockSdkMcpTab).toHaveBeenCalledWith(
      expect.objectContaining({ onSelect: undefined }),
    );
  });

  it('prefers the navigated agent over the route param', () => {
    mockGetMentorId.mockReturnValue('nav-mentor');
    render(<McpTab />);
    expect(providerValue()).toMatchObject({ mentorId: 'nav-mentor' });
  });

  it('forwards onSelect so the workflow node picker can pick a server', () => {
    const onSelect = vi.fn();
    render(<McpTab onSelect={onSelect} />);
    expect(mockSdkMcpTab).toHaveBeenCalledWith(
      expect.objectContaining({ onSelect }),
    );
  });

  it('routes gated actions through the paywall check', () => {
    render(<McpTab />);
    const action = vi.fn();
    providerValue().executeGatedAction(action);
    expect(mockExecuteWithTrialCheck).toHaveBeenCalledWith(action);
  });

  it('renders nothing until the tenant, agent and user are known', () => {
    mockUseUsername.mockReturnValue(undefined);
    const { container } = render(<McpTab />);
    expect(container).toBeEmptyDOMElement();
    expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
  });
});
