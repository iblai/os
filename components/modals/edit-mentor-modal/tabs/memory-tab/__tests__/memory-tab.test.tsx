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

const mockGetMentorSettingsQuery = vi.fn();
const mockEditMentor = vi.fn();
const mockEditMentorState = { isLoading: false };

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: any[]) =>
    mockGetMentorSettingsQuery(...args),
  useEditMentorMutation: () => [mockEditMentor, mockEditMentorState],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../manage-memories', () => ({
  ManageMemories: (props: any) => (
    <div data-testid="manage-memories">
      {props.tenantKey}-{props.username}-{props.mentorId}
    </div>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      data-testid="memory-switch"
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

// ---- Helpers ----
const defaultParams = { tenantKey: 'test-tenant', mentorId: 'mentor-123' };

function setupDefaults(
  overrides: {
    params?: any;
    username?: string | null;
    getMentorIdReturn?: string | null;
    settingsData?: any;
    settingsLoading?: boolean;
  } = {},
) {
  const {
    params = defaultParams,
    username = 'testuser',
    getMentorIdReturn = null,
    settingsData = { enable_memory_component: false },
    settingsLoading = false,
  } = overrides;

  mockUseParams.mockReturnValue(params);
  mockUseUsername.mockReturnValue(username);
  mockGetMentorId.mockReturnValue(getMentorIdReturn);
  mockGetMentorSettingsQuery.mockReturnValue({
    data: settingsData,
    isLoading: settingsLoading,
  });
  mockEditMentor.mockReturnValue({ unwrap: () => Promise.resolve() });
  mockEditMentorState.isLoading = false;
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

    it('renders the toggle label and description', () => {
      render(<MemoryTab />);

      expect(screen.getByText('Enable Memory')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Allow this agent to remember and reference information from past conversations.',
        ),
      ).toBeInTheDocument();
    });

    it('renders the memory switch', () => {
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-switch')).toBeInTheDocument();
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

  describe('Toggle state', () => {
    it('shows switch as checked when enable_memory_component is true', () => {
      setupDefaults({ settingsData: { enable_memory_component: true } });
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-switch')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByTestId('memory-switch')).toHaveTextContent('On');
    });

    it('shows switch as unchecked when enable_memory_component is false', () => {
      setupDefaults({ settingsData: { enable_memory_component: false } });
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-switch')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByTestId('memory-switch')).toHaveTextContent('Off');
    });

    it('defaults to unchecked when enable_memory_component is undefined', () => {
      setupDefaults({ settingsData: {} });
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-switch')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByTestId('memory-switch')).toHaveTextContent('Off');
    });

    it('defaults to unchecked when settings data is null', () => {
      setupDefaults({ settingsData: null });
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-switch')).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByTestId('memory-switch')).toHaveTextContent('Off');
    });
  });

  describe('Toggle interaction - enable', () => {
    it('calls editMentor with enable_memory_component: true when toggling on', async () => {
      setupDefaults({ settingsData: { enable_memory_component: false } });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith({
          mentor: 'mentor-123',
          org: 'test-tenant',
          formData: { enable_memory_component: true },
          userId: 'testuser',
        });
      });
    });

    it('shows "Memory enabled" toast on successful enable', async () => {
      setupDefaults({ settingsData: { enable_memory_component: false } });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Memory enabled');
      });
    });
  });

  describe('Toggle interaction - disable', () => {
    it('calls editMentor with enable_memory_component: false when toggling off', async () => {
      setupDefaults({ settingsData: { enable_memory_component: true } });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith({
          mentor: 'mentor-123',
          org: 'test-tenant',
          formData: { enable_memory_component: false },
          userId: 'testuser',
        });
      });
    });

    it('shows "Memory disabled" toast on successful disable', async () => {
      setupDefaults({ settingsData: { enable_memory_component: true } });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Memory disabled');
      });
    });
  });

  describe('Disabled states', () => {
    it('disables switch when settings are loading', () => {
      setupDefaults({ settingsLoading: true });
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-switch')).toBeDisabled();
    });

    it('disables switch when mutation is in progress', () => {
      setupDefaults();
      mockEditMentorState.isLoading = true;
      render(<MemoryTab />);

      expect(screen.getByTestId('memory-switch')).toBeDisabled();
    });
  });

  describe('Error handling', () => {
    it('shows error toast with data.error message', async () => {
      const error = { data: { error: 'Memory quota exceeded' } };
      mockEditMentor.mockReturnValue({
        unwrap: () => Promise.reject(error),
      });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Memory quota exceeded');
      });
    });

    it('shows error toast with error.error message', async () => {
      const error = { error: { error: 'Service unavailable' } };
      mockEditMentor.mockReturnValue({
        unwrap: () => Promise.reject(error),
      });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Service unavailable');
      });
    });

    it('shows default error message when no specific error', async () => {
      const error = { someOther: 'field' };
      mockEditMentor.mockReturnValue({
        unwrap: () => Promise.reject(error),
      });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to update memory setting',
        );
      });
    });

    it('calls console.error on failure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = { data: { error: 'Some error' } };
      mockEditMentor.mockReturnValue({
        unwrap: () => Promise.reject(error),
      });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to update memory setting:',
          error,
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Early return', () => {
    it('does not call editMentor when tenantKey is missing', async () => {
      setupDefaults({ params: { tenantKey: '', mentorId: 'mentor-123' } });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });

    it('does not call editMentor when username is missing', async () => {
      setupDefaults({ username: null });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });

    it('does not call editMentor when activeMentorId is missing', async () => {
      setupDefaults({
        params: { tenantKey: 'test-tenant', mentorId: '' },
        getMentorIdReturn: null,
      });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(mockEditMentor).not.toHaveBeenCalled();
      });
    });
  });

  describe('getMentorId fallback', () => {
    it('uses getMentorId() value when available', () => {
      setupDefaults({ getMentorIdReturn: 'nav-mentor-456' });
      render(<MemoryTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'nav-mentor-456' }),
        expect.anything(),
      );

      const manageMemories = screen.getByTestId('manage-memories');
      expect(manageMemories).toHaveTextContent(
        'test-tenant-testuser-nav-mentor-456',
      );
    });

    it('falls back to mentorId from params when getMentorId() returns null', () => {
      setupDefaults({ getMentorIdReturn: null });
      render(<MemoryTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'mentor-123' }),
        expect.anything(),
      );

      const manageMemories = screen.getByTestId('manage-memories');
      expect(manageMemories).toHaveTextContent(
        'test-tenant-testuser-mentor-123',
      );
    });

    it('falls back to mentorId from params when getMentorId() returns undefined', () => {
      setupDefaults({ getMentorIdReturn: undefined });
      render(<MemoryTab />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'mentor-123' }),
        expect.anything(),
      );
    });

    it('uses getMentorId value for editMentor calls', async () => {
      setupDefaults({
        getMentorIdReturn: 'nav-mentor-789',
        settingsData: { enable_memory_component: false },
      });
      render(<MemoryTab />);

      fireEvent.click(screen.getByTestId('memory-switch'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({ mentor: 'nav-mentor-789' }),
        );
      });
    });
  });
});
