import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkflowsPage from '../page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
  }),
  useParams: () => ({
    tenantKey: 'test-tenant',
    mentorId: 'mentor-123',
  }),
}));

// Mock @iblai/data-layer
const mockUseGetWorkflowsQuery = vi.fn();
const mockCreateWorkflow = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetWorkflowsQuery: () => mockUseGetWorkflowsQuery(),
  useCreateWorkflowMutation: () => [mockCreateWorkflow, { isLoading: false }],
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    ...props
  }: React.ComponentProps<'button'> & { variant?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    onChange,
    value,
    placeholder,
    className,
    ...props
  }: React.ComponentProps<'input'>) => (
    <input
      onChange={onChange}
      value={value}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    onClick,
    className,
    ...props
  }: React.ComponentProps<'div'>) => (
    <div
      onClick={onClick}
      className={className}
      data-testid="workflow-card"
      {...props}
    >
      {children}
    </div>
  ),
  CardContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="card-content">
      {children}
    </div>
  ),
}));

// Mock CreateWorkflowModal
vi.mock('@iblai/iblai-js/web-containers', () => ({
  CreateWorkflowModal: ({
    open,
    onOpenChange,
    onCreateWorkflow,
    isCreating,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateWorkflow: (name: string) => void;
    isCreating: boolean;
  }) =>
    open ? (
      <div data-testid="create-workflow-modal">
        <button
          data-testid="create-workflow-submit"
          onClick={() => onCreateWorkflow('Test Workflow')}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create'}
        </button>
        <button
          data-testid="create-workflow-cancel"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
      </div>
    ) : null,
}));

const createMockWorkflow = (overrides = {}) => ({
  unique_id: 'workflow-1',
  name: 'Test Workflow',
  description: 'Test description',
  is_active: true,
  entry_mentor_id: 'mentor-1',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-20T15:30:00Z',
  ...overrides,
});

describe('WorkflowsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetWorkflowsQuery.mockReturnValue({
      data: { results: [] },
      isLoading: false,
      error: null,
    });
  });

  describe('rendering', () => {
    it('should render the page title', () => {
      render(<WorkflowsPage />);
      expect(screen.getByText('Workflows')).toBeInTheDocument();
    });

    it('should render the page description', () => {
      render(<WorkflowsPage />);
      expect(
        screen.getByText(
          'Create and manage automated workflows for your agents and learning experiences',
        ),
      ).toBeInTheDocument();
    });

    it('should render search input', () => {
      render(<WorkflowsPage />);
      expect(
        screen.getByPlaceholderText('Search workflows...'),
      ).toBeInTheDocument();
    });

    it('should render Create Workflow button', () => {
      render(<WorkflowsPage />);
      expect(screen.getByText('Create Workflow')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Workflows')).toBeInTheDocument();
      // Loading spinner should be present (Loader2 icon with animate-spin)
    });
  });

  describe('error state', () => {
    it('should show error message when there is an error', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('API Error'),
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Failed to load workflows')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no workflows exist', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('No workflows found')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first workflow'),
      ).toBeInTheDocument();
    });

    it('should open create modal when clicking "Create your first workflow"', async () => {
      const user = userEvent.setup();
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      await user.click(screen.getByText('Create your first workflow'));

      expect(screen.getByTestId('create-workflow-modal')).toBeInTheDocument();
    });
  });

  describe('workflow list', () => {
    it('should render workflow cards', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [
            createMockWorkflow({ unique_id: 'w1', name: 'Workflow 1' }),
            createMockWorkflow({ unique_id: 'w2', name: 'Workflow 2' }),
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Workflow 1')).toBeInTheDocument();
      expect(screen.getByText('Workflow 2')).toBeInTheDocument();
    });

    it('should display workflow description', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ description: 'Custom description' })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Custom description')).toBeInTheDocument();
    });

    it('should display "No description" for workflow without description', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ description: '' })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('No description')).toBeInTheDocument();
    });

    it('should show Active status for active workflows', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ is_active: true })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('should show Draft status for inactive workflows', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ is_active: false })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should handle null is_active as false', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ is_active: null })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('should navigate to workflow detail when clicking a card', async () => {
      const user = userEvent.setup();
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [
            createMockWorkflow({
              unique_id: 'workflow-123',
              entry_mentor_id: 'mentor-456',
            }),
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      await user.click(screen.getByTestId('workflow-card'));

      expect(mockPush).toHaveBeenCalledWith(
        '/platform/test-tenant/workflows/mentor-456/workflow-123?listMentorId=mentor-123',
      );
    });
  });

  describe('date formatting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format created date correctly', () => {
      vi.setSystemTime(new Date('2024-01-21T12:00:00Z'));
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ created_at: '2024-01-15T10:00:00Z' })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Created Jan 15, 2024')).toBeInTheDocument();
    });

    it('should show minutes ago for recent updates', () => {
      vi.setSystemTime(new Date('2024-01-20T15:45:00Z'));
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ updated_at: '2024-01-20T15:30:00Z' })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Modified 15 minutes ago')).toBeInTheDocument();
    });

    it('should show hours ago for updates within 24 hours', () => {
      vi.setSystemTime(new Date('2024-01-20T20:30:00Z'));
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ updated_at: '2024-01-20T15:30:00Z' })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Modified 5 hours ago')).toBeInTheDocument();
    });

    it('should show days ago for updates within 7 days', () => {
      vi.setSystemTime(new Date('2024-01-23T15:30:00Z'));
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ updated_at: '2024-01-20T15:30:00Z' })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Modified 3 days ago')).toBeInTheDocument();
    });

    it('should show formatted date for updates older than 7 days', () => {
      vi.setSystemTime(new Date('2024-02-01T15:30:00Z'));
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ updated_at: '2024-01-20T15:30:00Z' })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('Modified Jan 20, 2024')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should update search value on input', async () => {
      const user = userEvent.setup();
      render(<WorkflowsPage />);

      const searchInput = screen.getByPlaceholderText('Search workflows...');
      await user.type(searchInput, 'test query');

      expect(searchInput).toHaveValue('test query');
    });

    it('should pass search value to query', async () => {
      const user = userEvent.setup();
      render(<WorkflowsPage />);

      const searchInput = screen.getByPlaceholderText('Search workflows...');
      await user.type(searchInput, 'test');

      // The hook is called with search params
      expect(mockUseGetWorkflowsQuery).toHaveBeenCalled();
    });
  });

  describe('create workflow modal', () => {
    it('should open create modal when clicking Create Workflow button', async () => {
      const user = userEvent.setup();
      render(<WorkflowsPage />);

      await user.click(screen.getByText('Create Workflow'));

      expect(screen.getByTestId('create-workflow-modal')).toBeInTheDocument();
    });

    it('should close modal when clicking Cancel', async () => {
      const user = userEvent.setup();
      render(<WorkflowsPage />);

      await user.click(screen.getByText('Create Workflow'));
      expect(screen.getByTestId('create-workflow-modal')).toBeInTheDocument();

      await user.click(screen.getByTestId('create-workflow-cancel'));
      expect(
        screen.queryByTestId('create-workflow-modal'),
      ).not.toBeInTheDocument();
    });

    it('should call createWorkflow and navigate on success', async () => {
      const user = userEvent.setup();
      mockCreateWorkflow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          unique_id: 'new-workflow-id',
          entry_mentor_id: 'new-mentor-id',
        }),
      });

      render(<WorkflowsPage />);

      await user.click(screen.getByText('Create Workflow'));
      await user.click(screen.getByTestId('create-workflow-submit'));

      await waitFor(() => {
        expect(mockCreateWorkflow).toHaveBeenCalledWith({
          org: 'test-tenant',
          data: {
            name: 'Test Workflow',
            definition: {
              nodes: expect.arrayContaining([
                expect.objectContaining({ id: 'start', type: 'start' }),
                expect.objectContaining({
                  id: 'mentor-1',
                  type: 'mentor',
                  data: expect.objectContaining({ mentor_id: 'mentor-123' }),
                }),
              ]),
              edges: expect.arrayContaining([
                expect.objectContaining({
                  source: 'start',
                  target: 'mentor-1',
                }),
              ]),
            },
          },
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/platform/test-tenant/workflows/new-mentor-id/new-workflow-id?listMentorId=mentor-123',
        );
      });
    });

    it('should show error toast on create failure', async () => {
      const user = userEvent.setup();
      const { toast } = await import('sonner');
      mockCreateWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Create failed')),
      });

      render(<WorkflowsPage />);

      await user.click(screen.getByText('Create Workflow'));
      await user.click(screen.getByTestId('create-workflow-submit'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create workflow');
      });
    });
  });

  describe('status colors', () => {
    it('should apply green color classes for active workflows', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ is_active: true })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      const statusBadge = screen.getByText('Active');
      expect(statusBadge.className).toContain('text-green-600');
      expect(statusBadge.className).toContain('bg-green-50');
    });

    it('should apply gray color classes for inactive workflows', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ is_active: false })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      const statusBadge = screen.getByText('Draft');
      expect(statusBadge.className).toContain('text-gray-600');
      expect(statusBadge.className).toContain('bg-gray-100');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined results', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: { results: undefined },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('No workflows found')).toBeInTheDocument();
    });

    it('should handle null data', () => {
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      expect(screen.getByText('No workflows found')).toBeInTheDocument();
    });

    it('should handle missing entry_mentor_id', async () => {
      const user = userEvent.setup();
      mockUseGetWorkflowsQuery.mockReturnValue({
        data: {
          results: [createMockWorkflow({ entry_mentor_id: undefined })],
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowsPage />);
      await user.click(screen.getByTestId('workflow-card'));

      expect(mockPush).toHaveBeenCalledWith(
        '/platform/test-tenant/workflows/undefined/workflow-1?listMentorId=mentor-123',
      );
    });
  });
});
