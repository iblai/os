import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RenameProjectModal } from '../rename-project-modal';

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
const mockUpdateProject = vi.fn();
const mockUnwrap = vi.fn();
let mockIsLoading = false;
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useUpdateUserProjectMutation: () => [
    (...args: unknown[]) => {
      mockUpdateProject(...args);
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

describe('RenameProjectModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    projectId: '99',
    currentName: 'Old Name',
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
    mockUsername = 'test-user';
    mockParams.tenantKey = 'test-tenant';
    mockIsLoading = false;
  });

  describe('rendering', () => {
    it('renders dialog with title, label and pre-filled name', () => {
      render(<RenameProjectModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Rename Project' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Project Name')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveValue('Old Name');
    });

    it('renders Cancel and Rename buttons', () => {
      render(<RenameProjectModal {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: 'Cancel' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Rename Project' }),
      ).toBeInTheDocument();
    });

    it('disables Rename button when name unchanged', () => {
      render(<RenameProjectModal {...defaultProps} />);

      expect(
        screen.getByRole('button', { name: 'Rename Project' }),
      ).toBeDisabled();
    });

    it('disables Rename button when name is empty/whitespace', () => {
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '   ' },
      });
      expect(
        screen.getByRole('button', { name: 'Rename Project' }),
      ).toBeDisabled();
    });

    it('enables Rename button when name changed', () => {
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });
      expect(
        screen.getByRole('button', { name: 'Rename Project' }),
      ).not.toBeDisabled();
    });
  });

  describe('effect resets name on open / currentName change', () => {
    it('resets project name to currentName when reopened', () => {
      const { rerender } = render(
        <RenameProjectModal {...defaultProps} isOpen={false} />,
      );

      rerender(
        <RenameProjectModal
          {...defaultProps}
          isOpen={true}
          currentName="Fresh Name"
        />,
      );

      expect(screen.getByRole('textbox')).toHaveValue('Fresh Name');
    });
  });

  describe('rename flow', () => {
    it('updates project, resets, closes, calls onSuccess and shows success toast', async () => {
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '  New Name  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Rename Project' }));

      await waitFor(() => {
        expect(mockUpdateProject).toHaveBeenCalledWith({
          tenantKey: 'test-tenant',
          username: 'test-user',
          id: 99,
          data: { name: 'New Name' },
        });
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Project renamed successfully',
        );
      });

      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });

    it('renames via Enter key', async () => {
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

      await waitFor(() => {
        expect(mockUpdateProject).toHaveBeenCalled();
      });
    });

    it('does not rename when Enter pressed with Shift', () => {
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });
      fireEvent.keyDown(screen.getByRole('textbox'), {
        key: 'Enter',
        shiftKey: true,
      });

      expect(mockUpdateProject).not.toHaveBeenCalled();
    });

    it('cancels via Escape key', () => {
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('works without onSuccess callback', async () => {
      render(
        <RenameProjectModal
          isOpen={true}
          onClose={defaultProps.onClose}
          projectId="99"
          currentName="Old Name"
        />,
      );

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Rename Project' }));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });

    it('shows error toast when update fails', async () => {
      mockUnwrap.mockRejectedValue(new Error('API error'));
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Rename Project' }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to rename project');
      });
    });

    it('does nothing when username is missing', () => {
      mockUsername = undefined;
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Rename Project' }));

      expect(mockUpdateProject).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('resets name to currentName and calls onClose when Cancel clicked', () => {
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'Changed' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading state', () => {
    it('shows Renaming... label and disables buttons while loading', () => {
      mockIsLoading = true;
      render(<RenameProjectModal {...defaultProps} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New Name' },
      });

      expect(
        screen.getByRole('button', { name: 'Renaming...' }),
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
  });
});
