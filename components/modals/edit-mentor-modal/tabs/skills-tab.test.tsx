import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SkillsTab } from './skills-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockAgentSkills = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'admin-user',
}));

// The settings lookup only supplies the mentor DB id that keys the RBAC
// grants the SDK panel gates on — same query the hosting modal already
// subscribes to, so at runtime it is an RTK cache read.
const mockUseGetMentorSettingsQuery = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorSettingsQuery(...args),
}));

// SkillsTab imports from `@iblai/iblai-js/web-containers` (the unified
// SDK barrel). Mock the exact path the source uses — Vitest keys mocks
// by module specifier so the underlying `@iblai/iblai-js/web-containers` mock
// wouldn't match.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  AgentSkills: (props: any) => {
    mockAgentSkills(props);
    return (
      <div
        data-testid="agent-skills"
        data-platform-key={props.platformKey}
        data-mentor-unique-id={props.mentorUniqueId}
      >
        AgentSkills
      </div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('SkillsTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the Skills header and description', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Reusable playbooks this Base Agent can discover and follow.',
        ),
      ).toBeInTheDocument();
    });

    it('renders AgentSkills with platformKey and mentorUniqueId from url params', () => {
      render(<SkillsTab />);

      const agentSkills = screen.getByTestId('agent-skills');
      expect(agentSkills).toHaveAttribute('data-platform-key', 'test-tenant');
      expect(agentSkills).toHaveAttribute(
        'data-mentor-unique-id',
        'test-mentor',
      );
      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
        mentorDbId: 42,
      });
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SkillsTab />);

      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'nav-mentor-xyz',
        mentorDbId: 42,
      });
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<SkillsTab />);

      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
        mentorDbId: 42,
      });
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<SkillsTab />);

      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
        mentorDbId: 42,
      });
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });

      const { container } = render(<SkillsTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSkills).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<SkillsTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSkills).not.toHaveBeenCalled();
    });

    it('renders the tab when getMentorId() provides an id but params.mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SkillsTab />);

      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'nav-mentor-xyz',
        mentorDbId: 42,
      });
    });
  });
});
