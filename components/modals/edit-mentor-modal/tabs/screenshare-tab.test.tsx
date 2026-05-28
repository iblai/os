import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { ScreenShareTab } from './screenshare-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockAgentScreenShareTab = vi.fn();

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

// ScreenShareTab imports `AgentScreenShareTab` from `@iblai/iblai-js/web-containers/next`
// directly. Vitest keys mocks by module specifier — match the source path.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentScreenShareTab: (props: any) => {
    mockAgentScreenShareTab(props);
    return (
      <div
        data-testid="agent-screenshare-tab"
        data-tenant-key={props.tenantKey}
        data-mentor-id={props.mentorId}
        data-username={props.username}
      >
        AgentScreenShareTab
      </div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('ScreenShareTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUseUsername.mockReturnValue('test-user');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('forwards tenantKey, mentorId and username from URL params to AgentScreenShareTab', () => {
      render(<ScreenShareTab />);

      const agent = screen.getByTestId('agent-screenshare-tab');
      expect(agent).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(agent).toHaveAttribute('data-mentor-id', 'test-mentor');
      expect(agent).toHaveAttribute('data-username', 'test-user');

      expect(mockAgentScreenShareTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
      });
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<ScreenShareTab />);

      expect(mockAgentScreenShareTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
        username: 'test-user',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<ScreenShareTab />);

      expect(mockAgentScreenShareTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<ScreenShareTab />);

      expect(mockAgentScreenShareTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
      });
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });

      const { container } = render(<ScreenShareTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentScreenShareTab).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<ScreenShareTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentScreenShareTab).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);

      const { container } = render(<ScreenShareTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentScreenShareTab).not.toHaveBeenCalled();
    });

    it('renders when getMentorId() provides an id but params.mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<ScreenShareTab />);

      expect(screen.getByTestId('agent-screenshare-tab')).toBeInTheDocument();
      expect(mockAgentScreenShareTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
        username: 'test-user',
      });
    });
  });
});
