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

import { PromptGalleryModal } from '../prompt-gallery-modal';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-123' }),
}));

let mockUserIsStudent = false;
vi.mock('@/hooks/use-user', () => ({
  useUserIsStudent: () => mockUserIsStudent,
  useUsername: () => 'test-user',
}));

let mockIsMobile = false;
vi.mock('react-responsive', () => ({
  useMediaQuery: () => mockIsMobile,
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

const mockPromptCategories = [
  { id: 1, name: 'General' },
  { id: 2, name: 'Academic' },
];

let mockCategoriesQueryReturn: {
  data: unknown;
  isLoading: boolean;
} = {
  data: mockPromptCategories,
  isLoading: false,
};

const mockUnwrap = vi.fn();
const mockUpdatePrompt = vi.fn(() => ({ unwrap: mockUnwrap }));
let mockIsEditing = false;

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetPromptCategoriesQuery: () => mockCategoriesQueryReturn,
  useUpdatePromptMutation: () => [
    mockUpdatePrompt,
    { isLoading: mockIsEditing },
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

// Stub the CategorySection so we can drive onEdit/onSelect callbacks without the
// real prompt-search data flow. It exposes buttons for both callbacks.
const mockSelectedPrompt = {
  id: 7,
  label: 'Test Prompt',
  isSystem: false,
  name: 'prompt',
  prompt: 'A prompt',
  category: 'General',
};
vi.mock('../prompt-gallery-modal/category-section', () => ({
  CategorySection: ({
    title,
    category,
    onEdit,
    onSelect,
  }: {
    title: string;
    category: string;
    onEdit: (p: unknown) => void;
    onSelect?: (text: string) => void;
  }) => (
    <div data-testid={`category-section-${category}`}>
      <span>section:{title}</span>
      <button type="button" onClick={() => onEdit(mockSelectedPrompt)}>
        trigger-edit
      </button>
      {onSelect && (
        <button type="button" onClick={() => onSelect('chosen prompt text')}>
          trigger-select
        </button>
      )}
    </div>
  ),
}));

// Stub the AddPromptModal so opening it doesn't pull in its data flow.
vi.mock('../add-prompt-modal', () => ({
  AddPromptModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="add-prompt-modal">
        <button type="button" onClick={onClose}>
          close-add
        </button>
      </div>
    ) : null,
}));

// Stub the EditPromptModal and surface its save callback so we can exercise
// handleEditPrompt without the real editor.
vi.mock('../edit-prompt-modal', () => ({
  EditPromptModal: ({
    isOpen,
    onClose,
    selectedPrompt,
    handleSave,
    isEditing,
  }: {
    isOpen: boolean;
    onClose: () => void;
    selectedPrompt: { id?: number };
    handleSave: (p: unknown, v: unknown) => void;
    isEditing: boolean;
  }) =>
    isOpen ? (
      <div data-testid="edit-prompt-modal">
        <span>editing:{String(isEditing)}</span>
        <button
          type="button"
          onClick={() =>
            handleSave(selectedPrompt, {
              category: 'General',
              prompt: 'Updated prompt',
              promptVisibility: 'viewable_by_tenant_admins',
            })
          }
        >
          trigger-save
        </button>
        <button type="button" onClick={onClose}>
          close-edit
        </button>
      </div>
    ) : null,
}));

// ============================================================================
// TESTS
// ============================================================================

describe('PromptGalleryModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
    mockUpdatePrompt.mockImplementation(() => ({ unwrap: mockUnwrap }));
    mockCategoriesQueryReturn = {
      data: mockPromptCategories,
      isLoading: false,
    };
    mockUserIsStudent = false;
    mockIsMobile = false;
    mockIsEditing = false;
    mockIsModalOpen = false;
    mockFreeTrialDialog = null;
    mockExecuteWithTrialCheck.mockImplementation((fn: () => void) => fn());
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the dialog title and description when open', () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Prompt Gallery')).toBeInTheDocument();
      expect(
        screen.getByText('View and edit custom prompts for your agent.'),
      ).toBeInTheDocument();
    });

    it('shows a spinner while categories are loading', () => {
      mockCategoriesQueryReturn = { data: undefined, isLoading: true };

      const { container } = render(
        <PromptGalleryModal isOpen={true} onClose={vi.fn()} />,
      );

      // No tabs/categories render while loading.
      expect(
        screen.queryByRole('tab', { name: 'All' }),
      ).not.toBeInTheDocument();
      // Spinner is rendered (svg role-less); assert category section absent.
      expect(
        screen.queryByTestId('category-section-All'),
      ).not.toBeInTheDocument();
      expect(container).toBeTruthy();
    });

    it('renders the desktop tabs with category names and defaults to All', async () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Academic' })).toBeInTheDocument();

      // The All section renders by default (set via effect).
      await waitFor(() => {
        expect(screen.getByTestId('category-section-All')).toBeInTheDocument();
      });
    });

    it('renders the add button for non-students on desktop', () => {
      mockUserIsStudent = false;

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByRole('button', { name: /Add/ })).toBeInTheDocument();
    });

    it('hides the add button for students', () => {
      mockUserIsStudent = true;

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.queryByRole('button', { name: /Add/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe('mobile layout', () => {
    beforeEach(() => {
      mockIsMobile = true;
    });

    it('renders a category select instead of tabs', async () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      // Combobox (Select trigger) is present on mobile.
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('category-section-All')).toBeInTheDocument();
      });
    });

    it('renders the add button for non-students on mobile', () => {
      mockUserIsStudent = false;

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByRole('button', { name: /Add/ })).toBeInTheDocument();
    });

    it('lists category options in the mobile select', () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('combobox'));

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('General')).toBeInTheDocument();
      expect(within(listbox).getByText('Academic')).toBeInTheDocument();
    });
  });

  describe('category switching', () => {
    it('renders a filtered CategorySection when a specific tab is selected', async () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      await userEvent.click(screen.getByRole('tab', { name: 'General' }));

      await waitFor(() => {
        expect(
          screen.getByTestId('category-section-General'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('category-section-All'),
      ).not.toBeInTheDocument();
    });
  });

  describe('add prompt modal', () => {
    it('opens the add modal (via trial check) when the add button is clicked', () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /Add/ }));

      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
      expect(screen.getByTestId('add-prompt-modal')).toBeInTheDocument();
    });

    it('closes the add modal when its onClose is invoked', () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /Add/ }));
      fireEvent.click(screen.getByText('close-add'));

      expect(screen.queryByTestId('add-prompt-modal')).not.toBeInTheDocument();
    });

    it('does not open the add modal when the trial check blocks the action', () => {
      mockExecuteWithTrialCheck.mockImplementation(() => null);

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /Add/ }));

      expect(screen.queryByTestId('add-prompt-modal')).not.toBeInTheDocument();
    });
  });

  describe('edit prompt modal', () => {
    it('opens the edit modal when a prompt is edited from a section', async () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('category-section-All')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('trigger-edit'));

      expect(screen.getByTestId('edit-prompt-modal')).toBeInTheDocument();
    });

    it('saves an edited prompt and shows a success toast', async () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('trigger-edit')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('trigger-edit'));
      fireEvent.click(screen.getByText('trigger-save'));

      await waitFor(() => {
        expect(mockUpdatePrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 7,
            org: 'test-tenant',
            userId: 'test-user',
            requestBody: expect.objectContaining({
              is_system: false,
              prompt: 'Updated prompt',
              category: 'General',
              prompt_visibility: 'viewable_by_tenant_admins',
            }),
          }),
        );
      });

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(
          'Agent updated successfully',
        );
      });
    });

    it('shows an error toast when editing a prompt fails', async () => {
      mockUnwrap.mockRejectedValue(new Error('nope'));

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('trigger-edit')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('trigger-edit'));
      fireEvent.click(screen.getByText('trigger-save'));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to update agent');
      });
    });

    it('closes the edit modal when its onClose is invoked', async () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('trigger-edit')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('trigger-edit'));
      fireEvent.click(screen.getByText('close-edit'));

      expect(screen.queryByTestId('edit-prompt-modal')).not.toBeInTheDocument();
    });

    it('passes the editing loading flag to the edit modal', async () => {
      mockIsEditing = true;

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('trigger-edit')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('trigger-edit'));

      expect(screen.getByText('editing:true')).toBeInTheDocument();
    });
  });

  describe('onSelectPrompt', () => {
    it('passes a select handler to the section and closes on select', async () => {
      const onSelectPrompt = vi.fn();
      const onClose = vi.fn();

      render(
        <PromptGalleryModal
          isOpen={true}
          onClose={onClose}
          onSelectPrompt={onSelectPrompt}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('trigger-select')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('trigger-select'));

      expect(onSelectPrompt).toHaveBeenCalledWith('chosen prompt text');
      expect(onClose).toHaveBeenCalled();
    });

    it('does not render a select handler when onSelectPrompt is not provided', async () => {
      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('category-section-All')).toBeInTheDocument();
      });

      expect(screen.queryByText('trigger-select')).not.toBeInTheDocument();
    });
  });

  describe('free trial dialog', () => {
    it('renders the FreeTrialDialog when the modal is open', () => {
      mockIsModalOpen = true;
      mockFreeTrialDialog = ({ isOpen }) =>
        isOpen ? <div data-testid="free-trial-dialog">Trial</div> : null;

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByTestId('free-trial-dialog')).toBeInTheDocument();
    });

    it('does not render the FreeTrialDialog when closed', () => {
      mockIsModalOpen = false;
      mockFreeTrialDialog = ({ isOpen }) =>
        isOpen ? <div data-testid="free-trial-dialog">Trial</div> : null;

      render(<PromptGalleryModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.queryByTestId('free-trial-dialog')).not.toBeInTheDocument();
    });
  });
});
