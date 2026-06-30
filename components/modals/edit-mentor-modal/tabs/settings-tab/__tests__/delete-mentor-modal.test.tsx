import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteMentorModal } from '../delete-mentor-modal';

// ============================================================================
// MOCKS
// ============================================================================

const mockDeleteMentor = vi.fn();
const mockUnwrap = vi.fn();
let mockIsLoading = false;

const mockRouterReplace = vi.fn();
const mockGetMentorId = vi.fn();
const mockCloseEditMentorModal = vi.fn();
const mockUseParams = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ replace: mockRouterReplace }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
    closeEditMentorModal: mockCloseEditMentorModal,
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useDeleteMentorMutation: () => [
    (...args: unknown[]) => {
      mockDeleteMentor(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: mockIsLoading },
  ],
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ============================================================================
// TESTS
// ============================================================================

function renderModal(
  props: Partial<React.ComponentProps<typeof DeleteMentorModal>> = {},
) {
  const onClose = props.onClose ?? vi.fn();
  return {
    onClose,
    ...render(
      <DeleteMentorModal isOpen={props.isOpen ?? true} onClose={onClose} />,
    ),
  };
}

describe('DeleteMentorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockUnwrap.mockResolvedValue({});
    mockUseParams.mockReturnValue({
      mentorId: 'mentor-123',
      tenantKey: 'test-tenant',
    });
    mockGetMentorId.mockReturnValue(null);
  });

  it('renders the dialog title, description and action buttons when open', () => {
    renderModal();

    expect(screen.getByText('Delete Agent')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete this agent/),
    ).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('Delete Agent')).not.toBeInTheDocument();
  });

  it('calls onClose when the Cancel button is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes the mentor and redirects to explore when deleting the current mentor', async () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteMentor).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'mentor-123',
          org: 'test-tenant',
          userId: 'test-user',
        }),
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockCloseEditMentorModal).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Agent deleted successfully',
      );
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });

  it('does not redirect when deleting a non-active mentor opened in the modal', async () => {
    // active mentor (modal) differs from the URL mentor, and equals getMentorId
    mockGetMentorId.mockReturnValue('modal-mentor-456');

    renderModal();

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteMentor).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'modal-mentor-456' }),
      );
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    // Should not redirect because activeMentorId !== mentorId
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('shows an error toast when deletion fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUnwrap.mockRejectedValue(new Error('delete failed'));

    renderModal();

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to delete agent');
    });

    expect(mockRouterReplace).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('shows "Deleting..." and disables the buttons while loading', () => {
    mockIsLoading = true;
    renderModal();

    expect(screen.getByText('Deleting...')).toBeInTheDocument();
    expect(screen.getByText('Deleting...').closest('button')).toBeDisabled();
    expect(screen.getByText('Cancel').closest('button')).toBeDisabled();
  });
});
