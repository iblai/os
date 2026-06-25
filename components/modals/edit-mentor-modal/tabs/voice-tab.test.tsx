import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { VoiceTab } from './voice-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockAgentVoiceTab = vi.fn();

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

// VoiceTab imports AgentVoiceTab from `@iblai/iblai-js/web-containers/next` directly
// (bypassing the `@iblai/iblai-js` re-export). Vitest keys mocks by module
// specifier — mock the exact path the source uses.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentVoiceTab: (props: any) => {
    mockAgentVoiceTab(props);
    return (
      <div
        data-testid="agent-voice-tab"
        data-tenant-key={props.tenantKey}
        data-mentor-id={props.mentorId}
        data-username={props.username}
      >
        AgentVoiceTab
      </div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('VoiceTab', () => {
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
    it('forwards tenantKey, mentorId and username from URL params to AgentVoiceTab', () => {
      render(<VoiceTab />);

      const agent = screen.getByTestId('agent-voice-tab');
      expect(agent).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(agent).toHaveAttribute('data-mentor-id', 'test-mentor');
      expect(agent).toHaveAttribute('data-username', 'test-user');

      expect(mockAgentVoiceTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
      });
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<VoiceTab />);

      expect(mockAgentVoiceTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
        username: 'test-user',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<VoiceTab />);

      expect(mockAgentVoiceTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<VoiceTab />);

      expect(mockAgentVoiceTab).toHaveBeenCalledWith({
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

      const { container } = render(<VoiceTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentVoiceTab).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<VoiceTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentVoiceTab).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);

      const { container } = render(<VoiceTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentVoiceTab).not.toHaveBeenCalled();
    });

    it('renders the tab when getMentorId() provides an id but params.mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<VoiceTab />);

      expect(screen.getByTestId('agent-voice-tab')).toBeInTheDocument();
      expect(mockAgentVoiceTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
        username: 'test-user',
      });
    });
  });
});
