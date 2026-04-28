import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SkillsTab } from './skills-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockAgentSkills = vi.fn();
let currentUsername: string | null = 'testuser';

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => currentUsername,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
}));

vi.mock('@iblai/web-containers', () => ({
  AgentSkills: (props: any) => {
    mockAgentSkills(props);
    return (
      <div
        data-testid="agent-skills"
        data-platform-key={props.platformKey}
        data-mentor-id={String(props.mentorId)}
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
    currentUsername = 'testuser';

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
      isLoading: false,
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
        screen.getByText('Manage agent skill assignments for your mentor.'),
      ).toBeInTheDocument();
    });

    it('renders AgentSkills with platformKey, numeric mentorId, and mentorUniqueId', () => {
      render(<SkillsTab />);

      const agentSkills = screen.getByTestId('agent-skills');
      expect(agentSkills).toHaveAttribute('data-platform-key', 'test-tenant');
      expect(agentSkills).toHaveAttribute('data-mentor-id', '42');
      expect(agentSkills).toHaveAttribute(
        'data-mentor-unique-id',
        'test-mentor',
      );
      expect(mockAgentSkills).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorId: 42,
        mentorUniqueId: 'test-mentor',
      });
    });

    it('calls useGetMentorSettingsQuery with resolved mentor id, org, and username', () => {
      render(<SkillsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        {
          mentor: 'test-mentor',
          org: 'test-tenant',
          userId: 'testuser',
        },
        expect.objectContaining({ skip: false }),
      );
    });
  });

  describe('Active mentor id resolution for the settings query', () => {
    it('uses getMentorId() when the navigate hook returns a value', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SkillsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'nav-mentor-xyz' }),
        expect.anything(),
      );
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<SkillsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'test-mentor' }),
        expect.anything(),
      );
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

    it('renders nothing when mentor settings response has no mentor_id', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { mentor_id: undefined },
        isLoading: false,
      });

      const { container } = render(<SkillsTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSkills).not.toHaveBeenCalled();
    });

    it('renders nothing while mentor settings have not loaded yet', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const { container } = render(<SkillsTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSkills).not.toHaveBeenCalled();
    });

    it('skips the settings query when username is missing', () => {
      currentUsername = null;

      render(<SkillsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('skips the settings query when both params and nav return no mentor id', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      render(<SkillsTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });
  });
});
