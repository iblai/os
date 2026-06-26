import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { toast } from 'sonner';

import { DeleteDatasetModal } from '../delete-dataset-modal';

const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

const mockDeleteTrainingDocument = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useDeleteTrainingDocumentMutation: () => [
    mockDeleteTrainingDocument,
    { isLoading: false },
  ],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('DeleteDatasetModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    dataset: { id: 'dataset-1' },
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'mentor-123',
    });
    mockDeleteTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  it('renders title and confirmation text', () => {
    render(<DeleteDatasetModal {...defaultProps} />);

    expect(screen.getByText('Delete Dataset')).toBeInTheDocument();
    expect(
      screen.getByText(/You have successfully untrained a dataset/),
    ).toBeInTheDocument();
  });

  it('does not render content when isOpen is false', () => {
    render(<DeleteDatasetModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Delete Dataset')).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<DeleteDatasetModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('deletes the training document and shows success toast', async () => {
    render(<DeleteDatasetModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteTrainingDocument).toHaveBeenCalledWith({
        documentId: 'dataset-1',
        org: 'test-tenant',
        userId: 'test-user',
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Training document deleted successfully',
      );
    });
  });

  it('shows error toast when deletion fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockDeleteTrainingDocument.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('boom')),
    });

    render(<DeleteDatasetModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to delete training document',
      );
    });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
