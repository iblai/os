import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SpendCapsTab } from './spend-caps-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockAgentSpendCapsTab = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

// SpendCapsTab imports from `@iblai/iblai-js/web-containers/next` (the
// Next-only entry — that's where AgentSpendCapsTab is actually exported).
// Vitest keys mocks by module specifier, so we mock the exact path the
// source uses.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentSpendCapsTab: (props: any) => {
    mockAgentSpendCapsTab(props);
    return (
      <div
        data-testid="agent-spend-caps-tab"
        data-tenant-key={props.tenantKey}
        data-mentor-id={props.mentorId}
      >
        AgentSpendCapsTab
      </div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('SpendCapsTab', () => {
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
    it('forwards tenantKey and mentorId from URL params to AgentSpendCapsTab', () => {
      render(<SpendCapsTab />);

      const agent = screen.getByTestId('agent-spend-caps-tab');
      expect(agent).toHaveAttribute('data-tenant-key', 'test-tenant');
      expect(agent).toHaveAttribute('data-mentor-id', 'test-mentor');

      expect(mockAgentSpendCapsTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
      });
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SpendCapsTab />);

      expect(mockAgentSpendCapsTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<SpendCapsTab />);

      expect(mockAgentSpendCapsTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'test-mentor',
      });
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });

      const { container } = render(<SpendCapsTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSpendCapsTab).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<SpendCapsTab />);

      expect(container.firstChild).toBeNull();
      expect(mockAgentSpendCapsTab).not.toHaveBeenCalled();
    });

    it('renders the tab when getMentorId() provides an id but params.mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SpendCapsTab />);

      expect(screen.getByTestId('agent-spend-caps-tab')).toBeInTheDocument();
      expect(mockAgentSpendCapsTab).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        mentorId: 'nav-mentor-xyz',
      });
    });
  });
});
