import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { PrivacyTab } from './privacy-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseUsername = vi.fn();
const mockAgentPrivacyTab = vi.fn();

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

// PrivacyTab imports from `@iblai/iblai-js/web-containers/next` (the
// Next-only entry — that's where AgentPrivacyTab is actually exported).
// Vitest keys mocks by module specifier, so we mock the exact path the
// source uses, not the underlying `@iblai/web-containers/next`.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentPrivacyTab: (props: any) => {
    mockAgentPrivacyTab(props);
    return (
      <div
        data-testid="agent-privacy-tab"
        data-tenant-key={props.tenantKey}
        data-mentor-id={props.mentorId}
        data-username={props.username}
      >
        AgentPrivacyTab
      </div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('PrivacyTab', () => {
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
    it('forwards tenantKey, mentorId and username from URL params to AgentPrivacyTab', () => {
      render(<PrivacyTab />);

      const agent = screen.getByTestId('agent-privacy-tab');
      expect(agent).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(agent).toHaveAttribute('data-mentor-id', 'test-mentor');
      expect(agent).toHaveAttribute('data-username', 'test-user');

      expect(mockAgentPrivacyTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
      });
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<PrivacyTab />);

      expect(mockAgentPrivacyTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
        username: 'test-user',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<PrivacyTab />);

      expect(mockAgentPrivacyTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
        username: 'test-user',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<PrivacyTab />);

      expect(mockAgentPrivacyTab).toHaveBeenCalledWith({
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

      const { container } = render(<PrivacyTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentPrivacyTab).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<PrivacyTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentPrivacyTab).not.toHaveBeenCalled();
    });

    it('renders nothing when username is missing', () => {
      mockUseUsername.mockReturnValue(undefined);

      const { container } = render(<PrivacyTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentPrivacyTab).not.toHaveBeenCalled();
    });

    it('renders the tab when getMentorId() provides an id but params.mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<PrivacyTab />);

      expect(screen.getByTestId('agent-privacy-tab')).toBeInTheDocument();
      expect(mockAgentPrivacyTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
        username: 'test-user',
      });
    });
  });
});
