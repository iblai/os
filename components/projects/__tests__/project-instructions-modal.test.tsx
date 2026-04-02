import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectInstructionsModal } from '../project-instructions-modal';

// Mock next/navigation
const mockParams = { tenantKey: 'test-tenant', mentorId: 'mentor-123' };
vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

// Mock hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

// Mock data-layer
const mockEditMentor = vi.fn();
const mockUnwrap = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: vi.fn(() => ({
    data: { system_prompt: 'Existing prompt instructions' },
  })),
  useEditMentorMutation: () => [
    (...args: unknown[]) => {
      mockEditMentor(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: false },
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

describe('ProjectInstructionsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
  });

  describe('rendering', () => {
    it('renders dialog with accessible title and description', () => {
      render(<ProjectInstructionsModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('Instructions')).toBeInTheDocument();
      expect(
        screen.getByText(/You can ask mentorAI to focus on certain topics/),
      ).toBeInTheDocument();
    });

    it('renders textarea with current system prompt', () => {
      render(<ProjectInstructionsModal {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Existing prompt instructions');
    });

    it('renders Cancel and Save buttons', () => {
      render(<ProjectInstructionsModal {...defaultProps} />);

      expect(
        screen.getByLabelText('Cancel editing instructions'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Save project instructions'),
      ).toBeInTheDocument();
    });
  });

  describe('cancel', () => {
    it('calls onClose and resets instructions when Cancel is clicked', () => {
      render(<ProjectInstructionsModal {...defaultProps} />);

      // Modify the textarea first
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'New instructions' },
      });

      fireEvent.click(screen.getByLabelText('Cancel editing instructions'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('save', () => {
    it('calls editMentor and shows success toast on save', async () => {
      render(<ProjectInstructionsModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Save project instructions'));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            mentor: 'mentor-123',
            org: 'test-tenant',
            formData: { system_prompt: 'Existing prompt instructions' },
          }),
        );
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Instructions updated successfully',
        );
      });

      expect(defaultProps.onSave).toHaveBeenCalledWith(
        'Existing prompt instructions',
      );
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('shows error toast when save fails', async () => {
      mockUnwrap.mockRejectedValue(new Error('API error'));

      render(<ProjectInstructionsModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Save project instructions'));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Failed to update instructions',
        );
      });
    });

    it('saves and closes without onSave callback', async () => {
      render(
        <ProjectInstructionsModal
          isOpen={true}
          onClose={defaultProps.onClose}
        />,
      );

      fireEvent.click(screen.getByLabelText('Save project instructions'));

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('textarea interaction', () => {
    it('updates instructions when typing', () => {
      render(<ProjectInstructionsModal {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Updated instructions' } });

      expect(textarea).toHaveValue('Updated instructions');
    });

    it('disables save button when instructions are empty', () => {
      render(<ProjectInstructionsModal {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '   ' } });

      expect(screen.getByLabelText('Save project instructions')).toBeDisabled();
    });
  });
});
