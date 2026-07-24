import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

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

// MemoryTab now hydrates `enable_memory_component` from mentor settings and
// PATCHes it via the RTK Query hooks for its in-tab capability toggle. Mock the
// data-layer barrel so the tab renders without a real redux store.
const mockGetMentorSettingsQuery = vi.fn();
const mockEditMentor = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
  useEditMentorMutation: () => [mockEditMentor, { isLoading: false }],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// CapabilityGate uses the real `@/components/ui/switch`; flatten it to a plain
// checkbox so the toggle's checked/disabled state is trivially assertable.
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
      {...props}
    />
  ),
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
    mentor?: any;
  } = {},
) {
  const {
    params = defaultParams,
    username = 'testuser',
    getMentorIdReturn = null,
    mentor = { enable_memory_component: false },
  } = overrides;

  mockUseParams.mockReturnValue(params);
  mockUseUsername.mockReturnValue(username);
  mockGetMentorId.mockReturnValue(getMentorIdReturn);
  mockGetMentorSettingsQuery.mockReturnValue({ data: mentor });
  mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
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

    it('renders the in-tab long-term-memory capability toggle', () => {
      render(<MemoryTab />);

      expect(
        screen.getByTestId('memory-capability-toggle'),
      ).toBeInTheDocument();
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

  describe('Capability toggle', () => {
    it('reflects enable_memory_component=false as unchecked', () => {
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-capability-toggle')).not.toBeChecked();
    });

    it('reflects enable_memory_component=true as checked', () => {
      setupDefaults({ mentor: { enable_memory_component: true } });

      render(<MemoryTab />);

      expect(screen.getByTestId('memory-capability-toggle')).toBeChecked();
    });

    it('grays out (but still renders) ManageMemories when the capability is off', () => {
      render(<MemoryTab />);

      const content = screen.getByTestId('capability-gate-content');
      expect(content).toHaveAttribute('data-enabled', 'false');
      expect(screen.getByTestId('manage-memories')).toBeInTheDocument();
    });

    it('PATCHes enable_memory_component via editMentor when switched on', () => {
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-capability-toggle'));

      expect(mockEditMentor).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'mentor-123',
          org: 'test-tenant',
          formData: { enable_memory_component: true },
        }),
      );
    });

    it('rolls back the toggle and shows an error toast when the PATCH fails', async () => {
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('nope')),
      });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-capability-toggle'));

      await waitFor(() => expect(toast.error).toHaveBeenCalled());
      // optimistic check was rolled back to the server value (false)
      expect(screen.getByTestId('memory-capability-toggle')).not.toBeChecked();
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

  describe('Toggle failure & fallbacks', () => {
    it('rolls the toggle back and surfaces the error toast when the PATCH fails', async () => {
      mockEditMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('network')),
      });
      render(<MemoryTab />);

      const toggle = screen.getByTestId('memory-capability-toggle');
      fireEvent.click(toggle);
      // Optimistic flip happens synchronously…
      expect(toggle).toBeChecked();

      // …then the rejected unwrap rolls it back and toasts.
      await waitFor(() => {
        expect(toggle).not.toBeChecked();
      });
      expect(toast.error).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('treats a settings payload without enable_memory_component as off', () => {
      setupDefaults({ mentor: {} });
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-capability-toggle')).not.toBeChecked();
    });

    it('sends an empty userId when no username is available', () => {
      setupDefaults({ username: null });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-capability-toggle'));

      expect(mockEditMentor).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '' }),
      );
    });
  });
});
