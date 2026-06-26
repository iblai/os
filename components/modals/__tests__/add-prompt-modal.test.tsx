import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AddPromptModal } from '../add-prompt-modal';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-param-123' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

const mockExecuteWithTrialCheck = vi.fn((fn: () => void) => fn());
const mockCloseModal = vi.fn();
let mockIsModalOpen = false;
let mockFreeTrialDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> | null = null;

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
    isModalOpen: mockIsModalOpen,
    FreeTrialDialog: mockFreeTrialDialog,
    closeModal: mockCloseModal,
  }),
}));

const mockGetMentorId = vi.fn<() => string | undefined>(() => undefined);
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

// Light RichTextEditor stub (the real one is a heavy ProseMirror editor).
vi.mock('@iblai/iblai-js/web-containers', () => ({
  RichTextEditor: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ),
}));

const mockPromptCategories = [
  { id: 1, name: 'General' },
  { id: 2, name: 'Academic' },
];

const mockUnwrap = vi.fn();
const mockCreatePrompt = vi.fn(() => ({ unwrap: mockUnwrap }));

let mockCategoriesQueryReturn: {
  data: unknown;
  isLoading: boolean;
} = {
  data: mockPromptCategories,
  isLoading: false,
};
let mockIsCreating = false;

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetPromptCategoriesQuery: () => mockCategoriesQueryReturn,
  useCreatePromptMutation: () => [
    mockCreatePrompt,
    { isLoading: mockIsCreating },
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

describe('AddPromptModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
    mockCreatePrompt.mockImplementation(() => ({ unwrap: mockUnwrap }));
    mockCategoriesQueryReturn = {
      data: mockPromptCategories,
      isLoading: false,
    };
    mockIsCreating = false;
    mockIsModalOpen = false;
    mockFreeTrialDialog = null;
    mockGetMentorId.mockReturnValue(undefined);
    mockExecuteWithTrialCheck.mockImplementation((fn: () => void) => fn());
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the dialog title and labels when open', () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Add New Prompt')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Visibility')).toBeInTheDocument();
      expect(screen.getByText('Prompt')).toBeInTheDocument();
    });

    it('does not render content when closed', () => {
      render(<AddPromptModal isOpen={false} onClose={vi.fn()} />);

      expect(screen.queryByText('Add New Prompt')).not.toBeInTheDocument();
    });

    it('renders the category and visibility selects with accessible labels', () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByLabelText('Select a category')).toBeInTheDocument();
      expect(screen.getByLabelText('Select visibility')).toBeInTheDocument();
    });

    it('renders the rich text editor for the prompt field', () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    });

    it('renders the submit button', () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByRole('button', { name: 'Submit' }),
      ).toBeInTheDocument();
    });
  });

  describe('category options', () => {
    it('renders category options from the query data', () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByLabelText('Select a category'));

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveTextContent('General');
      expect(listbox).toHaveTextContent('Academic');
    });

    it('renders visibility options', () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByLabelText('Select visibility'));

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveTextContent('Administrators');
      expect(listbox).toHaveTextContent('Users');
      expect(listbox).toHaveTextContent('Anyone');
    });

    it('updates the visibility value when an option is chosen', async () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByLabelText('Select visibility'));
      fireEvent.click(
        within(screen.getByRole('listbox')).getByText('Administrators'),
      );

      // The trigger reflects the selected visibility label.
      await waitFor(() => {
        expect(screen.getByLabelText('Select visibility')).toHaveTextContent(
          'Administrators',
        );
      });
    });
  });

  describe('disabled / loading states', () => {
    it('disables the selects and editor while categories are loading', () => {
      mockCategoriesQueryReturn = { data: undefined, isLoading: true };

      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByLabelText('Select a category')).toBeDisabled();
      expect(screen.getByLabelText('Select visibility')).toBeDisabled();
      expect(screen.getByTestId('rich-text-editor')).toBeDisabled();
    });

    it('shows "Submitting..." and disables the submit button while creating', () => {
      mockIsCreating = true;

      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      const submitButton = screen.getByRole('button', {
        name: 'Submitting...',
      });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('validation messages', () => {
    it('shows the prompt required error when the prompt is cleared after typing', async () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      const editor = screen.getByTestId('rich-text-editor');
      // Make field dirty then empty so the validation message renders.
      await userEvent.type(editor, 'x');
      await userEvent.clear(editor);

      await waitFor(() => {
        expect(screen.getByText('Prompt is required')).toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    const fillValidForm = async () => {
      // Select a category
      fireEvent.click(screen.getByLabelText('Select a category'));
      fireEvent.click(within(screen.getByRole('listbox')).getByText('General'));

      // Type a prompt
      const editor = screen.getByTestId('rich-text-editor');
      await userEvent.type(editor, 'My new prompt');
    };

    it('creates a prompt and shows a success toast on submit', async () => {
      const onClose = vi.fn();
      render(<AddPromptModal isOpen={true} onClose={onClose} />);

      await fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => {
        expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
        expect(mockCreatePrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            org: 'test-tenant',
            userId: 'test-user',
            requestBody: expect.objectContaining({
              prompt: 'My new prompt',
              category: 'General',
              is_system: false,
              mentor: 'mentor-param-123',
              platform: 'test-tenant',
              prompt_visibility: 'viewable_by_tenant_students',
            }),
          }),
        );
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Prompt created successfully',
        );
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('uses the mentor id from useNavigate when available', async () => {
      mockGetMentorId.mockReturnValue('navigate-mentor-999');

      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      await fillValidForm();
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => {
        expect(mockCreatePrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              mentor: 'navigate-mentor-999',
            }),
          }),
        );
      });
    });

    it('shows an error toast when prompt creation fails', async () => {
      mockUnwrap.mockRejectedValue(new Error('boom'));
      const onClose = vi.fn();

      render(<AddPromptModal isOpen={true} onClose={onClose} />);

      await fillValidForm();
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to create prompt');
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('prevents default form submission and runs the trial check', async () => {
      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      const form = screen
        .getByRole('button', { name: 'Submit' })
        .closest('form');
      expect(form).toBeInTheDocument();

      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(submitEvent, 'stopPropagation');

      form!.dispatchEvent(submitEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
    });
  });

  describe('free trial dialog', () => {
    it('renders the FreeTrialDialog when the modal is open', () => {
      mockIsModalOpen = true;
      mockFreeTrialDialog = ({ isOpen }) =>
        isOpen ? <div data-testid="free-trial-dialog">Trial</div> : null;

      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    });

    it('does not render the FreeTrialDialog when the modal is closed', () => {
      mockIsModalOpen = false;
      mockFreeTrialDialog = ({ isOpen }) =>
        isOpen ? <div data-testid="free-trial-dialog">Trial</div> : null;

      render(<AddPromptModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });
  });

  describe('onClose', () => {
    it('calls onClose when the dialog is dismissed via escape', () => {
      const onClose = vi.fn();
      render(<AddPromptModal isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(document.activeElement || document.body, {
        key: 'Escape',
        code: 'Escape',
      });

      expect(onClose).toHaveBeenCalled();
    });
  });
});
