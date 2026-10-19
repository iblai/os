import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { ToolsTab } from '../tools-tab';

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockAgentSettingsProvider = vi.fn();
const mockAgentToolsTab = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/lib/config', () => ({
  config: { enableRBAC: () => mockEnableRBAC() },
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
  AgentToolsTab: (props: unknown) => {
    mockAgentToolsTab(props);
    return <div data-testid="agent-tools-tab" />;
  },
}));

describe('ToolsTab', () => {
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

  it('renders the SDK tab inside the provider with the route identity', () => {
    render(<ToolsTab />);

    expect(screen.getByTestId('agent-settings-provider')).toContainElement(
      screen.getByTestId('agent-tools-tab'),
    );
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith({
      tenantKey: 'test-tenant',
      mentorId: 'route-mentor',
      username: 'test-user',
      enableRBAC: false,
    });
  });

  it('passes no label overrides so the SDK catalog copy is used', () => {
    render(<ToolsTab />);
    expect(mockAgentToolsTab).toHaveBeenCalledWith({});
  });

  it('prefers the modal-stack mentor over the route mentor', () => {
    mockGetMentorId.mockReturnValue('modal-mentor');
    render(<ToolsTab />);
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ mentorId: 'modal-mentor' }),
    );
  });

  it('forwards enableRBAC from config', () => {
    mockEnableRBAC.mockReturnValue(true);
    render(<ToolsTab />);
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
    const { container } = render(<ToolsTab />);
    expect(container).toBeEmptyDOMElement();
    expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
  });
});
