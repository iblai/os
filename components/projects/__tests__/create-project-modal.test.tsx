import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateProjectModal } from '../create-project-modal';

// Mock next/navigation
const mockParams: { tenantKey?: string } = { tenantKey: 'test-tenant' };
vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

// Mock use-user
let mockUsername: string | undefined = 'test-user';
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

// Mock data-layer
const mockCreateUserProject = vi.fn();
const mockUnwrap = vi.fn();
let mockIsLoading = false;
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateUserProjectMutation: () => [
    (...args: unknown[]) => {
      mockCreateUserProject(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: mockIsLoading },
  ],
}));

// Mock web-utils chatActions
vi.mock('@iblai/iblai-js/web-utils', () => ({
  chatActions: {
    setShouldStartNewChat: (value: boolean) => ({
      type: 'chat/setShouldStartNewChat',
      payload: value,
    }),
  },
}));

// Mock react-redux dispatch
const mockDispatch = vi.fn();
vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

// Mock navigate hook
const mockNavigateToMentorInProject = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToMentorInProject: mockNavigateToMentorInProject,
  }),
}));

// Mock the MentorSelectionGrid heavy child component
vi.mock('@/components/mentors/mentor-selection-grid', () => ({
  MentorSelectionGrid: (props: any) => {
    return (
      <div data-testid="mentor-selection-grid">
        <button
          data-testid="select-mentor-1"
          onClick={() => props.onMentorSelect({ unique_id: 'mentor-1' })}
        >
          select mentor 1
        </button>
        <button
          data-testid="select-mentor-2"
          onClick={() => props.onMentorSelect({ unique_id: 'mentor-2' })}
        >
          select mentor 2
        </button>
        <button
          data-testid="change-search"
          onClick={() => props.onSearchChange('new search')}
        >
          change search
        </button>
        <span data-testid="selected-ids">
          {props.selectedMentorIds.join(',')}
        </span>
        <span data-testid="search-query">{props.searchQuery}</span>
      </div>
    );
  },
}));

// Mock sonner
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

describe('CreateProjectModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({
      id: 42,
      mentors: [{ unique_id: 'mentor-1' }],
    });
    mockUsername = 'test-user';
    mockParams.tenantKey = 'test-tenant';
    mockIsLoading = false;
  });

  describe('rendering', () => {
    it('renders dialog with title and labels', () => {
      render(<CreateProjectModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('New Project')).toBeInTheDocument();
      expect(screen.getByText('Project Name')).toBeInTheDocument();
      expect(screen.getByText('Select Agents')).toBeInTheDocument();
      expect(screen.getByTestId('mentor-selection-grid')).toBeInTheDocument();
    });

    it('renders Cancel and Save buttons', () => {
      render(<CreateProjectModal {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('disables Save button when no name and no mentors selected', () => {
      render(<CreateProjectModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('does not show selected count when no mentors selected', () => {
      render(<CreateProjectModal {...defaultProps} />);

      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
  });

  describe('mentor selection', () => {
    it('toggles mentor selection on and off and shows selected count', () => {
      render(<CreateProjectModal {...defaultProps} />);

      // Select mentor 1
      fireEvent.click(screen.getByTestId('select-mentor-1'));
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('mentor-1');
      expect(screen.getByText('(1 selected)')).toBeInTheDocument();

      // Select mentor 2
      fireEvent.click(screen.getByTestId('select-mentor-2'));
      expect(screen.getByTestId('selected-ids')).toHaveTextContent(
        'mentor-1,mentor-2',
      );
      expect(screen.getByText('(2 selected)')).toBeInTheDocument();

      // Deselect mentor 1 (already selected -> filter out)
      fireEvent.click(screen.getByTestId('select-mentor-1'));
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('mentor-2');
      expect(screen.getByText('(1 selected)')).toBeInTheDocument();
    });

    it('forwards search changes to the grid', () => {
      render(<CreateProjectModal {...defaultProps} />);

      fireEvent.click(screen.getByTestId('change-search'));
      expect(screen.getByTestId('search-query')).toHaveTextContent(
        'new search',
      );
    });
  });

  describe('name input', () => {
    it('updates project name when typing', () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByPlaceholderText('Project Name');
      fireEvent.change(input, { target: { value: 'My Project' } });
      expect(input).toHaveValue('My Project');
    });

    it('enables Save button when name filled and a mentor selected', () => {
      render(<CreateProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Project Name'), {
        target: { value: 'My Project' },
      });
      fireEvent.click(screen.getByTestId('select-mentor-1'));

      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });
  });

  describe('create flow', () => {
    const fillValidForm = () => {
      fireEvent.change(screen.getByPlaceholderText('Project Name'), {
        target: { value: '  My Project  ' },
      });
      fireEvent.click(screen.getByTestId('select-mentor-1'));
    };

    it('creates project, resets form, shows success toast, dispatches and navigates', async () => {
      render(<CreateProjectModal {...defaultProps} />);
      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockCreateUserProject).toHaveBeenCalledWith({
          tenantKey: 'test-tenant',
          username: 'test-user',
          data: {
            name: 'My Project',
            description: '',
            shared: false,
            mentors_to_add: ['mentor-1'],
          },
        });
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Project created successfully',
        );
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'chat/setShouldStartNewChat',
        payload: true,
      });
      expect(mockNavigateToMentorInProject).toHaveBeenCalledWith(
        'mentor-1',
        '42',
      );
      expect(defaultProps.onClose).toHaveBeenCalled();

      // Form reset
      expect(screen.getByPlaceholderText('Project Name')).toHaveValue('');
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('');
    });

    it('creates project via Enter key', async () => {
      render(<CreateProjectModal {...defaultProps} />);
      fillValidForm();

      fireEvent.keyDown(screen.getByPlaceholderText('Project Name'), {
        key: 'Enter',
      });

      await waitFor(() => {
        expect(mockCreateUserProject).toHaveBeenCalled();
      });
    });

    it('does not create on non-Enter key press', () => {
      render(<CreateProjectModal {...defaultProps} />);
      fillValidForm();

      fireEvent.keyDown(screen.getByPlaceholderText('Project Name'), {
        key: 'a',
      });

      expect(mockCreateUserProject).not.toHaveBeenCalled();
    });

    it('shows error toast when creation fails', async () => {
      mockUnwrap.mockRejectedValue(new Error('API error'));
      render(<CreateProjectModal {...defaultProps} />);
      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to create project');
      });
      expect(mockNavigateToMentorInProject).not.toHaveBeenCalled();
    });

    it('handles missing mentors array in response gracefully', async () => {
      mockUnwrap.mockResolvedValue({ id: 7, mentors: [] });
      render(<CreateProjectModal {...defaultProps} />);
      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockNavigateToMentorInProject).toHaveBeenCalledWith(
          undefined,
          '7',
        );
      });
    });

    it('does nothing when username is missing', () => {
      mockUsername = undefined;
      render(<CreateProjectModal {...defaultProps} />);
      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(mockCreateUserProject).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('shows Creating... label and disables button while loading', () => {
      mockIsLoading = true;
      render(<CreateProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Project Name'), {
        target: { value: 'My Project' },
      });
      fireEvent.click(screen.getByTestId('select-mentor-1'));

      const saveButton = screen.getByRole('button', { name: 'Creating...' });
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  describe('cancel', () => {
    it('resets form and calls onClose when Cancel clicked', () => {
      render(<CreateProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByPlaceholderText('Project Name'), {
        target: { value: 'My Project' },
      });
      fireEvent.click(screen.getByTestId('select-mentor-1'));

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(screen.getByPlaceholderText('Project Name')).toHaveValue('');
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('');
    });
  });
});
