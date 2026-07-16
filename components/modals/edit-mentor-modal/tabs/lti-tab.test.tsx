import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { LtiTab } from './lti-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockEnableRBAC = vi.fn();
const mockLegacyLmsUrl = vi.fn();
const mockAgentLtiTab = vi.fn();

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
    // The LTI tab points the platform endpoints at the dedicated LMS domain via
    // `legacyLmsUrl()` (not `lmsUrl()`, which becomes `<apiBase>/lms`).
    legacyLmsUrl: () => mockLegacyLmsUrl(),
  },
}));

// LtiTab imports AgentLtiTab from `@iblai/iblai-js/web-containers/next` directly
// (the Next-only entry where the tab components are exported). Vitest keys mocks
// by module specifier — mock the exact path the source uses.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentLtiTab: (props: any) => {
    mockAgentLtiTab(props);
    return (
      <div
        data-testid="agent-lti-tab"
        data-tenant-key={props.tenantKey}
        data-mentor-id={props.mentorId}
        data-username={props.username}
        data-enable-rbac={String(props.enableRBAC)}
        data-lms-domain={props.lmsDomain}
      >
        AgentLtiTab
      </div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('LtiTab', () => {
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
    mockLegacyLmsUrl.mockReturnValue('https://learn.example.org');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('forwards identity, the RBAC flag and the LMS domain to AgentLtiTab', () => {
      render(<LtiTab />);

      const agent = screen.getByTestId('agent-lti-tab');
      expect(agent).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(agent).toHaveAttribute('data-mentor-id', 'test-mentor');
      expect(agent).toHaveAttribute('data-username', 'test-user');
      expect(agent).toHaveAttribute('data-enable-rbac', 'false');
      expect(agent).toHaveAttribute(
        'data-lms-domain',
        'https://learn.example.org',
      );

      expect(mockAgentLtiTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
        enableRBAC: false,
        lmsDomain: 'https://learn.example.org',
      });
    });

    it('forwards the config-derived enableRBAC flag when enabled', () => {
      mockEnableRBAC.mockReturnValue(true);

      render(<LtiTab />);

      expect(screen.getByTestId('agent-lti-tab')).toHaveAttribute(
        'data-enable-rbac',
        'true',
      );
      expect(mockAgentLtiTab).toHaveBeenCalledWith(
        expect.objectContaining({ enableRBAC: true }),
      );
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<LtiTab />);

      expect(mockAgentLtiTab).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'nav-mentor-xyz' }),
      );
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<LtiTab />);

      expect(mockAgentLtiTab).toHaveBeenCalledWith(
        expect.objectContaining({ mentorId: 'test-mentor' }),
      );
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<LtiTab />);

      expect(mockAgentLtiTab).toHaveBeenCalledWith(
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

      const { container } = render(<LtiTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentLtiTab).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<LtiTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentLtiTab).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);

      const { container } = render(<LtiTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentLtiTab).not.toHaveBeenCalled();
    });

    it('renders the tab when getMentorId() provides an id but params.mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<LtiTab />);

      expect(screen.getByTestId('agent-lti-tab')).toBeInTheDocument();
      expect(mockAgentLtiTab).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantKey: 'test-tenant',
          mentorId: 'nav-mentor-xyz',
          username: 'test-user',
        }),
      );
    });
  });
});
