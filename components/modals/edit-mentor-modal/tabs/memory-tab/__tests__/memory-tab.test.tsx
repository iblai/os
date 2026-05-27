import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MemoryTab } from '../index';

// ---- Mocks ----
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: (...args: any[]) => mockUseParams(...args),
}));

const mockUseUsername = vi.fn();
vi.mock('@/hooks/use-user', () => ({
  useUsername: (...args: any[]) => mockUseUsername(...args),
}));

const mockGetMentorId = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
}));

vi.mock('../manage-memories', () => ({
  ManageMemories: (props: any) => (
    <div data-testid="manage-memories">
      {props.tenantKey}-{props.username}-{props.mentorId}
    </div>
  ),
}));

// ---- Helpers ----
const defaultParams = { tenantKey: 'test-tenant', mentorId: 'mentor-123' };

function setupDefaults(
  overrides: {
    params?: any;
    username?: string | null;
    getMentorIdReturn?: string | null;
  } = {},
) {
  const {
    params = defaultParams,
    username = 'testuser',
    getMentorIdReturn = null,
  } = overrides;

  mockUseParams.mockReturnValue(params);
  mockUseUsername.mockReturnValue(username);
  mockGetMentorId.mockReturnValue(getMentorIdReturn);
}

// ---- Tests ----
describe('MemoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  describe('Rendering', () => {
    it('renders the header text and description', () => {
      render(<MemoryTab />);

      expect(screen.getByText('Memory')).toBeInTheDocument();
      expect(
        screen.getByText('Configure memory settings for your agent.'),
      ).toBeInTheDocument();
    });

    it('does not render the Enable Memory toggle (moved to Settings tab)', () => {
      render(<MemoryTab />);

      expect(screen.queryByText('Enable Memory')).not.toBeInTheDocument();
    });

    it('renders ManageMemories with correct props', () => {
      render(<MemoryTab />);

      const manageMemories = screen.getByTestId('manage-memories');
      expect(manageMemories).toBeInTheDocument();
      expect(manageMemories).toHaveTextContent(
        'test-tenant-testuser-mentor-123',
      );
    });
  });

  describe('getMentorId fallback', () => {
    it('uses getMentorId() value when available', () => {
      setupDefaults({ getMentorIdReturn: 'nav-mentor-456' });
      render(<MemoryTab />);

      const manageMemories = screen.getByTestId('manage-memories');
      expect(manageMemories).toHaveTextContent(
        'test-tenant-testuser-nav-mentor-456',
      );
    });

    it('falls back to mentorId from params when getMentorId() returns null', () => {
      setupDefaults({ getMentorIdReturn: null });
      render(<MemoryTab />);

      const manageMemories = screen.getByTestId('manage-memories');
      expect(manageMemories).toHaveTextContent(
        'test-tenant-testuser-mentor-123',
      );
    });
  });
});
