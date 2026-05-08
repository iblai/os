import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { toast } from 'sonner';

import { DeleteModerationLogModal } from './delete-moderation-log-modal';

// ============================================================================
// MOCKS
// ============================================================================

const mockDeleteModerationLog = vi.fn();
const mockUseParams = vi.fn();
const mockUsername = 'testuser';

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

const mockDeleteModerationLogLoading = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useDeleteModerationLogMutation: () => [
    mockDeleteModerationLog,
    { isLoading: mockDeleteModerationLogLoading() },
  ],
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  AlertDialogAction: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

// ============================================================================
// FIXTURES
// ============================================================================

const defaultParams = { tenantKey: 'test-tenant', mentorId: 'mentor-1' };

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  logId: 'log-123',
  onDeleteSuccess: vi.fn(),
};

// ============================================================================
// TESTS
// ============================================================================

describe('DeleteModerationLogModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue(defaultParams);
    mockDeleteModerationLogLoading.mockReturnValue(false);
    mockDeleteModerationLog.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when isOpen is false', () => {
    render(<DeleteModerationLogModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when isOpen is true', () => {
    render(<DeleteModerationLogModal {...defaultProps} />);
    expect(screen.getByText('Delete Moderation Log')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete this moderation log/),
    ).toBeInTheDocument();
  });

  it('shows Cancel and Delete buttons', () => {
    render(<DeleteModerationLogModal {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('shows "Deleting..." text when loading', () => {
    mockDeleteModerationLogLoading.mockReturnValue(true);
    render(<DeleteModerationLogModal {...defaultProps} />);
    expect(screen.getByText('Deleting...')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    mockDeleteModerationLogLoading.mockReturnValue(true);
    render(<DeleteModerationLogModal {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Deleting...')).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<DeleteModerationLogModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls deleteModerationLog with correct params on delete', async () => {
    const mockUnwrap = vi.fn().mockResolvedValue({});
    mockDeleteModerationLog.mockReturnValue({ unwrap: mockUnwrap });

    render(<DeleteModerationLogModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteModerationLog).toHaveBeenCalledWith({
        id: 'log-123',
        org: 'test-tenant',
        userId: 'testuser',
      });
    });
  });

  it('calls onClose and onDeleteSuccess and shows success toast after successful delete', async () => {
    const mockUnwrap = vi.fn().mockResolvedValue({});
    mockDeleteModerationLog.mockReturnValue({ unwrap: mockUnwrap });

    render(<DeleteModerationLogModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Moderation log deleted successfully',
      );
    });

    await waitFor(() => {
      expect(defaultProps.onDeleteSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast on delete failure', async () => {
    const mockUnwrap = vi.fn().mockRejectedValue(new Error('Delete failed'));
    mockDeleteModerationLog.mockReturnValue({ unwrap: mockUnwrap });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<DeleteModerationLogModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to delete moderation log',
      );
    });

    consoleSpy.mockRestore();
  });

  it('works without onDeleteSuccess callback', async () => {
    const mockUnwrap = vi.fn().mockResolvedValue({});
    mockDeleteModerationLog.mockReturnValue({ unwrap: mockUnwrap });

    render(
      <DeleteModerationLogModal
        isOpen={true}
        onClose={vi.fn()}
        logId="log-123"
      />,
    );
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Moderation log deleted successfully',
      );
    });
  });
});
