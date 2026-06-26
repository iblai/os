import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteProjectModal } from '../delete-project-modal';

// Mock next/navigation
const mockParams: { tenantKey?: string } = { tenantKey: 'test-tenant' };
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush }),
}));

// Mock use-user
let mockUsername: string | undefined = 'test-user';
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

// Mock data-layer
const mockDeleteProject = vi.fn();
const mockUnwrap = vi.fn();
let mockIsLoading = false;
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useDeleteUserProjectMutation: () => [
    (...args: unknown[]) => {
      mockDeleteProject(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: mockIsLoading },
  ],
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

describe('DeleteProjectModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    projectId: '99',
    projectName: 'My Project',
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
    mockUsername = 'test-user';
    mockParams.tenantKey = 'test-tenant';
    mockIsLoading = false;
    // Reset pathname to not match the project route by default
    window.history.pushState({}, '', '/platform/test-tenant/explore');
  });

  describe('rendering', () => {
    it('renders dialog with title and description including project name', () => {
      render(<DeleteProjectModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Delete Project' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete "My Project"/),
      ).toBeInTheDocument();
    });

    it('renders Cancel and Delete buttons', () => {
      render(<DeleteProjectModal {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Delete Project' }),
      ).toBeInTheDocument();
    });
  });

  describe('cancel', () => {
    it('calls onClose when Cancel clicked', () => {
      render(<DeleteProjectModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete flow', () => {
    it('deletes project, closes, shows success toast and calls onSuccess (no redirect when not on project page)', async () => {
      render(<DeleteProjectModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

      await waitFor(() => {
        expect(mockDeleteProject).toHaveBeenCalledWith({
          tenantKey: 'test-tenant',
          username: 'test-user',
          id: 99,
        });
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Project deleted successfully',
        );
      });

      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(defaultProps.onSuccess).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('redirects to explore when currently viewing the deleted project', async () => {
      window.history.pushState({}, '', '/platform/test-tenant/projects/99');
      render(<DeleteProjectModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/platform/test-tenant/explore');
      });
    });

    it('works without onSuccess callback', async () => {
      render(
        <DeleteProjectModal
          isOpen={true}
          onClose={defaultProps.onClose}
          projectId="99"
          projectName="My Project"
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });

    it('shows error toast when deletion fails', async () => {
      mockUnwrap.mockRejectedValue(new Error('API error'));
      render(<DeleteProjectModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to delete project');
      });
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    });

    it('does nothing when username is missing', async () => {
      mockUsername = undefined;
      render(<DeleteProjectModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

      await waitFor(() => {
        expect(mockDeleteProject).not.toHaveBeenCalled();
      });
    });

    it('does nothing when tenantKey is missing', async () => {
      mockParams.tenantKey = undefined;
      render(<DeleteProjectModal {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Delete Project' }));

      await waitFor(() => {
        expect(mockDeleteProject).not.toHaveBeenCalled();
      });
    });
  });

  describe('loading state', () => {
    it('shows Deleting... label and disables both buttons while loading', () => {
      mockIsLoading = true;
      render(<DeleteProjectModal {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: 'Deleting...' }),
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
  });
});
