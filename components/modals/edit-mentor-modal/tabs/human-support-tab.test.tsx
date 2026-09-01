import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { HumanSupportTab } from './human-support-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockAgentSettingsProvider = vi.fn();
const mockAgentHumanSupportTab = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/lib/config', () => ({
  config: {
    enableRBAC: () => mockEnableRBAC(),
  },
}));

// HumanSupportTab imports from `@iblai/iblai-js/web-containers/next` (the
// Next-only entry — that's where AgentHumanSupportTab / AgentSettingsProvider
// are actually exported). Vitest keys mocks by module specifier, so we mock
// the exact path the source uses.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentSettingsProvider: ({
    children,
    ...value
  }: {
    children: React.ReactNode;
    tenantKey: string;
    mentorId: string;
    username: string;
    enableRBAC: boolean;
  }) => {
    mockAgentSettingsProvider(value);
    return (
      <div
        data-testid="agent-settings-provider"
        data-tenant-key={value.tenantKey}
        data-mentor-id={value.mentorId}
        data-username={value.username}
        data-enable-rbac={String(value.enableRBAC)}
      >
        {children}
      </div>
    );
  },
  AgentHumanSupportTab: (props: unknown) => {
    mockAgentHumanSupportTab(props);
    return (
      <div data-testid="agent-human-support-tab">AgentHumanSupportTab</div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('HumanSupportTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('test-user');
    mockEnableRBAC.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('wraps AgentHumanSupportTab in an AgentSettingsProvider with the resolved identity', () => {
      render(<HumanSupportTab />);

      const provider = screen.getByTestId('agent-settings-provider');
      expect(provider).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(provider).toHaveAttribute('data-mentor-id', 'test-mentor');
      expect(provider).toHaveAttribute('data-username', 'test-user');
      expect(provider).toHaveAttribute('data-enable-rbac', 'false');

      expect(screen.getByTestId('agent-human-support-tab')).toBeInTheDocument();
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
        enableRBAC: false,
      });
    });

    it('does not pass a labels override so the SDK i18n catalog stays authoritative', () => {
      render(<HumanSupportTab />);

      expect(mockAgentHumanSupportTab).toHaveBeenCalledWith(
        expect.not.objectContaining({ labels: expect.anything() }),
      );
    });

    it('forwards the config-derived enableRBAC flag to the provider', () => {
      mockEnableRBAC.mockReturnValue(true);

      render(<HumanSupportTab />);

      expect(screen.getByTestId('agent-settings-provider')).toHaveAttribute(
        'data-enable-rbac',
        'true',
      );
      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ enableRBAC: true }),
      );
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<HumanSupportTab />);

      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'nav-mentor-xyz' }),
      );
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<HumanSupportTab />);

      expect(mockAgentSettingsProvider).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'test-mentor' }),
      );
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });

      const { container } = render(<HumanSupportTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
      expect(mockAgentHumanSupportTab).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<HumanSupportTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
      expect(mockAgentHumanSupportTab).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);

      const { container } = render(<HumanSupportTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSettingsProvider).not.toHaveBeenCalled();
      expect(mockAgentHumanSupportTab).not.toHaveBeenCalled();
    });
  });
});
