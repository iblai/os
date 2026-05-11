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

// SkillsTab imports from `@iblai/iblai-js/web-containers` (the unified
// SDK barrel). Mock the exact path the source uses — Vitest keys mocks
// by module specifier so the underlying `@iblai/web-containers` mock
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
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the Skills header and description', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(
        screen.getByText('Manage agent skill assignments for your mentor.'),
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
      });
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<SkillsTab />);

      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<SkillsTab />);

      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
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
      });
    });
  });
});
