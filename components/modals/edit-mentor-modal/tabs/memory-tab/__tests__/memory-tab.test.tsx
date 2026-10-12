import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { MemoryTab } from '../index';

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockAgentSettingsProvider = vi.fn();
const mockAgentMemoryTab = vi.fn();
const mockRbacPermissions = { '/mentors/42/': ['Ibl.Mentor/Mentors/write'] };

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

vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ rbac: { rbacPermissions: mockRbacPermissions } }),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: (state: {
    rbac: { rbacPermissions: typeof mockRbacPermissions };
  }) => state.rbac.rbacPermissions,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (
    args: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => mockUseGetMentorSettingsQuery(args, options),
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
  AgentMemoryTab: (props: unknown) => {
    mockAgentMemoryTab(props);
    return <div data-testid="agent-memory-tab" />;
  },
}));

describe('MemoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'route-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('test-user');
    mockEnableRBAC.mockReturnValue(false);
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_unique_id: 'uuid-1234' },
    });
  });

  afterEach(() => cleanup());

  it('renders the SDK tab inside the provider with the resolved identity', () => {
    render(<MemoryTab />);

    expect(screen.getByTestId('agent-settings-provider')).toContainElement(
      screen.getByTestId('agent-memory-tab'),
    );
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith({
      tenantKey: 'test-tenant',
      mentorId: 'uuid-1234',
      username: 'test-user',
      enableRBAC: false,
      rbacPermissions: mockRbacPermissions,
    });
  });

  it('passes no label overrides so the SDK catalog copy is used', () => {
    render(<MemoryTab />);
    expect(mockAgentMemoryTab).toHaveBeenCalledWith({});
  });

  it('forwards enableRBAC from config', () => {
    mockEnableRBAC.mockReturnValue(true);
    render(<MemoryTab />);
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ enableRBAC: true }),
    );
  });

  it('forwards the RBAC permissions from the store', () => {
    render(<MemoryTab />);
    expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
      expect.objectContaining({ rbacPermissions: mockRbacPermissions }),
    );
  });

  describe('mentor id resolution', () => {
    it('looks up settings for the route mentor with the current user', () => {
      render(<MemoryTab />);

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        { mentor: 'route-mentor', org: 'test-tenant', userId: 'test-user' },
        { skip: false },
      );
    });

    it('passes the mentor unique_id from settings to the provider', () => {
      render(<MemoryTab />);
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'uuid-1234' }),
      );
    });

    it('falls back to the route mentor while settings have not loaded', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({ data: undefined });

      render(<MemoryTab />);

      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'route-mentor' }),
      );
    });

    it('falls back to the active mentor when settings carry no unique_id', () => {
      mockUseGetMentorSettingsQuery.mockReturnValue({ data: {} });

      render(<MemoryTab />);

      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'route-mentor' }),
      );
    });

    it('prefers the modal-stack mentor over the route mentor', () => {
      mockGetMentorId.mockReturnValue('modal-mentor');
      mockUseGetMentorSettingsQuery.mockReturnValue({ data: undefined });

      render(<MemoryTab />);

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'modal-mentor' }),
        { skip: false },
      );
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'modal-mentor' }),
      );
    });
  });

  describe('incomplete identity', () => {
    it('skips the settings lookup and sends an empty user while the username is missing', () => {
      mockUseUsername.mockReturnValue(null);

      render(<MemoryTab />);

      expect(mockUseGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '' }),
        { skip: true },
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
      const { container } = render(<MemoryTab />);
      expect(container).toBeEmptyDOMElement();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
      expect(mockAgentMemoryTab).not.toHaveBeenCalled();
    });
  });
});
