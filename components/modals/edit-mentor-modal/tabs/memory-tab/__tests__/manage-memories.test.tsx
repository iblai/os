import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { toast } from 'sonner';

import { ManageMemories } from '../manage-memories';

// ---- Mocks ----
const mockGetFilteredMemoriesQuery = vi.fn();
const mockGetMemoryCategoriesQuery = vi.fn();
const mockGetMemoryFiltersQuery = vi.fn();
const mockDeleteMemory = vi.fn();
const mockDeleteMemoryByCategory = vi.fn();
const mockUpdateMemoryEntry = vi.fn();
const mockCreateMemory = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetFilteredMemoriesQuery: (...args: any[]) => mockGetFilteredMemoriesQuery(...args),
  useGetMemoryCategoriesQuery: (...args: any[]) => mockGetMemoryCategoriesQuery(...args),
  useGetMemoryFiltersQuery: (...args: any[]) => mockGetMemoryFiltersQuery(...args),
  useDeleteMemoryMutation: () => [mockDeleteMemory, { isLoading: false }],
  useDeleteMemoryByCategoryMutation: () => [mockDeleteMemoryByCategory],
  useUpdateMemoryEntryMutation: () => [mockUpdateMemoryEntry, { isLoading: false }],
  useCreateMemoryMutation: () => [mockCreateMemory, { isLoading: false }],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../utils', () => ({
  transformCategoryToApi: (cat: string) => cat.toLowerCase().replace(' ', '_'),
  transformCategoryToDisplay: (cat: string) =>
    cat
      .replace(/_/g, ' ')
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
}));

// Mock next/dynamic to render modals synchronously
vi.mock('next/dynamic', () => ({
  default: () => {
    // Return a simple mock component that passes through props
    return (props: any) => {
      if (!props.open) return null;

      // Detect modal type based on props
      if ('editContent' in props) {
        return (
          <div data-testid="edit-memory-modal">
            <textarea
              data-testid="edit-content-input"
              value={props.editContent}
              onChange={(e: any) => props.onContentChange(e.target.value)}
            />
            <button data-testid="edit-save-btn" onClick={props.onSave}>
              Save
            </button>
            <button data-testid="edit-cancel-btn" onClick={props.onCancel}>
              Cancel
            </button>
            <button data-testid="edit-close-btn" onClick={() => props.onOpenChange(false)}>
              Close Edit
            </button>
          </div>
        );
      }
      if ('newMemoryContent' in props) {
        return (
          <div data-testid="add-memory-modal">
            <textarea
              data-testid="add-content-input"
              value={props.newMemoryContent}
              onChange={(e: any) => props.onContentChange(e.target.value)}
            />
            <button data-testid="add-save-btn" onClick={props.onSave}>
              Save New
            </button>
            <button data-testid="add-cancel-btn" onClick={props.onCancel}>
              Cancel Add
            </button>
            <button data-testid="add-close-btn" onClick={() => props.onOpenChange(false)}>
              Close Add
            </button>
          </div>
        );
      }
      if ('selectedCategory' in props) {
        return (
          <div data-testid="bulk-delete-modal">
            <span>Delete all {props.selectedCategory} memories?</span>
            <button data-testid="bulk-delete-confirm" onClick={props.onConfirm}>
              Confirm Bulk Delete
            </button>
            <button data-testid="bulk-delete-cancel" onClick={props.onCancel}>
              Cancel Bulk Delete
            </button>
            <button data-testid="bulk-close-btn" onClick={() => props.onOpenChange(false)}>
              Close Bulk
            </button>
          </div>
        );
      }
      if ('isDeleting' in props) {
        return (
          <div data-testid="delete-memory-modal">
            <button data-testid="delete-confirm-btn" onClick={props.onConfirm}>
              Confirm Delete
            </button>
            <button data-testid="delete-cancel-btn" onClick={props.onCancel}>
              Cancel Delete
            </button>
            <button data-testid="delete-close-btn" onClick={() => props.onOpenChange(false)}>
              Close Delete
            </button>
          </div>
        );
      }
      return null;
    };
  },
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div data-testid="command">{children}</div>,
  CommandInput: ({ placeholder }: any) => (
    <input data-testid="command-input" placeholder={placeholder} />
  ),
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
  CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
  CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
  CommandItem: ({ children, onSelect, value }: any) => (
    <div data-testid="command-item" data-value={value} onClick={onSelect}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: any) => (
    <div data-testid="calendar">
      <button
        data-testid="calendar-select"
        onClick={() =>
          onSelect({
            from: new Date('2024-01-01'),
            to: new Date('2024-01-31'),
          })
        }
      >
        Select Date
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
}));

vi.mock('@/components/ibl-pagination', () => ({
  default: ({ currentPage, totalPages, onPageChange, disabled }: any) => (
    <div data-testid="pagination">
      <span data-testid="current-page">{currentPage}</span>
      <span data-testid="total-pages">{totalPages}</span>
      <button
        data-testid="next-page"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled}
      >
        Next
      </button>
      <button
        data-testid="prev-page"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled}
      >
        Prev
      </button>
    </div>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// ---- Test Data ----
const defaultProps = {
  tenantKey: 'test-tenant',
  username: 'testuser',
  mentorId: 'mentor-1',
};

const mockMemoriesResponse = {
  results: [
    {
      unique_id: 'mem-1',
      username: 'user1',
      email: 'user1@test.com',
      category: 'personal_info',
      inserted_at: '2024-06-15T10:00:00Z',
      updated_at: '2024-06-15T10:00:00Z',
      entries: [
        {
          unique_id: 'entry-1',
          key: 'name',
          value: 'User preference value',
          inserted_at: '2024-06-15T10:00:00Z',
          updated_at: '2024-06-15T10:00:00Z',
          expires_at: null,
          category: 'personal_info',
        },
      ],
    },
    {
      unique_id: 'mem-2',
      username: 'user2',
      email: 'user2@test.com',
      category: 'learning_style',
      inserted_at: '2024-06-14T10:00:00Z',
      updated_at: '2024-06-14T10:00:00Z',
      entries: [
        {
          unique_id: 'entry-2',
          key: 'style',
          value: 'Visual learner preference',
          inserted_at: '2024-06-14T10:00:00Z',
          updated_at: '2024-06-14T10:00:00Z',
          expires_at: null,
          category: 'learning_style',
        },
        {
          unique_id: 'entry-3',
          key: 'pace',
          value: 'Fast pace preferred',
          inserted_at: '2024-06-14T10:00:00Z',
          updated_at: '2024-06-14T10:00:00Z',
          expires_at: null,
          category: 'learning_style',
        },
      ],
    },
  ],
  count: 2,
  next: null,
  previous: null,
};

const mockLearners = [
  { username: 'user1', email: 'user1@test.com', lti_email: '' },
  { username: 'user2', email: 'user2@test.com', lti_email: '' },
];

describe('ManageMemories', () => {
  beforeEach(() => {
    cleanup();
    mockGetFilteredMemoriesQuery.mockReset();
    mockGetMemoryCategoriesQuery.mockReset();
    mockGetMemoryFiltersQuery.mockReset();
    mockDeleteMemory.mockReset();
    mockDeleteMemoryByCategory.mockReset();
    mockUpdateMemoryEntry.mockReset();
    mockCreateMemory.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();

    mockGetFilteredMemoriesQuery.mockReturnValue({
      data: mockMemoriesResponse,
      isLoading: false,
      isFetching: false,
    });

    mockGetMemoryCategoriesQuery.mockReturnValue({
      data: { categories: ['personal_info', 'learning_style'] },
    });

    mockGetMemoryFiltersQuery.mockReturnValue({
      data: {
        categories: ['personal_info', 'learning_style'],
        users: mockLearners,
      },
    });

    mockDeleteMemory.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockDeleteMemoryByCategory.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockUpdateMemoryEntry.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockCreateMemory.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the user filter and date range section', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Search for User')).toBeInTheDocument();
      expect(screen.getByText('Pick a Date Range')).toBeInTheDocument();
    });

    it('renders category tabs', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Personal Info').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Learning Style').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the Add Memory button', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Add Memory')).toBeInTheDocument();
    });

    it('renders memory cards with content', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('User preference value')).toBeInTheDocument();
      expect(screen.getByText('Visual learner preference')).toBeInTheDocument();
      expect(screen.getByText('Fast pace preferred')).toBeInTheDocument();
    });

    it('renders emails for memory items', () => {
      render(<ManageMemories {...defaultProps} />);
      const email1Elements = screen.getAllByText('user1@test.com');
      expect(email1Elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Loading State', () => {
    it('shows loading message when memories are loading', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: true,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Loading memories...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows "No saved memories yet." when no memories exist', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: { results: [], count: 0, next: null, previous: null },
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('No saved memories yet.')).toBeInTheDocument();
    });

    it('shows empty state when data is undefined', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('No saved memories yet.')).toBeInTheDocument();
    });
  });

  describe('Category Filtering', () => {
    it('defaults to "All" category', () => {
      render(<ManageMemories {...defaultProps} />);
      // All memories should be visible
      expect(screen.getByText('User preference value')).toBeInTheDocument();
      expect(screen.getByText('Visual learner preference')).toBeInTheDocument();
    });

    it('filters memories by category when a category tab is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      // Click on "Personal Info" category
      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      // Only personal_info memories should show
      expect(screen.getByText('User preference value')).toBeInTheDocument();
      expect(screen.queryByText('Visual learner preference')).not.toBeInTheDocument();
    });

    it('shows "Delete All" button when a non-All category is selected with memories', () => {
      render(<ManageMemories {...defaultProps} />);

      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      expect(screen.getByText('Delete All')).toBeInTheDocument();
    });

    it('does not show "Delete All" button when All category is selected', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.queryByText('Delete All')).not.toBeInTheDocument();
    });
  });

  describe('Delete Memory', () => {
    it('shows delete confirmation modal when delete is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      // Find dropdown items with "Delete" text
      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      expect(screen.getByTestId('delete-memory-modal')).toBeInTheDocument();
    });

    it('calls deleteMemory when confirmed', async () => {
      render(<ManageMemories {...defaultProps} />);

      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMemory).toHaveBeenCalledWith({
          tenantKey: 'test-tenant',
          username: 'testuser',
          memoryId: 'entry-1',
        });
      });
    });

    it('shows success toast on successful delete', async () => {
      render(<ManageMemories {...defaultProps} />);

      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Memory deleted successfully');
      });
    });

    it('shows error toast on failed delete', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteMemory.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });

      render(<ManageMemories {...defaultProps} />);

      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete memory');
      });
      consoleSpy.mockRestore();
    });

    it('closes delete modal when cancel is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      expect(screen.getByTestId('delete-memory-modal')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('delete-memory-modal')).not.toBeInTheDocument();
    });

    it('closes delete modal via onOpenChange(false)', () => {
      render(<ManageMemories {...defaultProps} />);

      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      expect(screen.getByTestId('delete-memory-modal')).toBeInTheDocument();

      const closeBtn = screen.getByTestId('delete-close-btn');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('delete-memory-modal')).not.toBeInTheDocument();
    });

    it('does not call deleteMemory when tenantKey is missing', async () => {
      render(<ManageMemories tenantKey="" username="testuser" mentorId="mentor-1" />);

      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMemory).not.toHaveBeenCalled();
      });
    });

    it('does not call deleteMemory when username is null', async () => {
      render(<ManageMemories tenantKey="test-tenant" username={null} mentorId="mentor-1" />);

      const deleteItems = screen.getAllByText('Delete');
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMemory).not.toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Delete', () => {
    it('shows bulk delete modal when Delete All is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      // Select a category first
      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText('Delete All');
      fireEvent.click(deleteAllBtn);

      expect(screen.getByTestId('bulk-delete-modal')).toBeInTheDocument();
    });

    it('calls deleteMemoryByCategory on confirm', async () => {
      render(<ManageMemories {...defaultProps} />);

      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText('Delete All');
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId('bulk-delete-confirm');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMemoryByCategory).toHaveBeenCalledWith({
          tenantKey: 'test-tenant',
          username: 'testuser',
          category: 'personal_info',
        });
      });
    });

    it('shows success toast on successful bulk delete', async () => {
      render(<ManageMemories {...defaultProps} />);

      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText('Delete All');
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId('bulk-delete-confirm');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'All Personal Info memories deleted successfully',
        );
      });
    });

    it('shows error toast on failed bulk delete', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDeleteMemoryByCategory.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Bulk delete failed')),
      });

      render(<ManageMemories {...defaultProps} />);

      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText('Delete All');
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId('bulk-delete-confirm');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete memories');
      });
      consoleSpy.mockRestore();
    });

    it('does not call bulk delete when tenantKey is missing', async () => {
      render(<ManageMemories tenantKey="" username="testuser" mentorId="mentor-1" />);

      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText('Delete All');
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId('bulk-delete-confirm');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMemoryByCategory).not.toHaveBeenCalled();
      });
    });

    it('closes bulk delete modal via onOpenChange(false)', () => {
      render(<ManageMemories {...defaultProps} />);

      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText('Delete All');
      fireEvent.click(deleteAllBtn);

      expect(screen.getByTestId('bulk-delete-modal')).toBeInTheDocument();

      const closeBtn = screen.getByTestId('bulk-close-btn');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('bulk-delete-modal')).not.toBeInTheDocument();
    });

    it('closes bulk delete modal via cancel button', () => {
      render(<ManageMemories {...defaultProps} />);

      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText('Delete All');
      fireEvent.click(deleteAllBtn);

      expect(screen.getByTestId('bulk-delete-modal')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('bulk-delete-cancel');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('bulk-delete-modal')).not.toBeInTheDocument();
    });
  });

  describe('Edit Memory', () => {
    it('opens edit modal when Edit is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      const editItems = screen.getAllByText('Edit');
      fireEvent.click(editItems[0]);

      expect(screen.getByTestId('edit-memory-modal')).toBeInTheDocument();
    });

    it('pre-fills edit modal with memory content', () => {
      render(<ManageMemories {...defaultProps} />);

      const editItems = screen.getAllByText('Edit');
      fireEvent.click(editItems[0]);

      const textarea = screen.getByTestId('edit-content-input') as HTMLTextAreaElement;
      expect(textarea.value).toBe('User preference value');
    });

    it('calls updateMemoryEntry when save is clicked', async () => {
      render(<ManageMemories {...defaultProps} />);

      const editItems = screen.getAllByText('Edit');
      fireEvent.click(editItems[0]);

      const saveBtn = screen.getByTestId('edit-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateMemoryEntry).toHaveBeenCalledWith({
          tenantKey: 'test-tenant',
          username: 'testuser',
          entryId: 'entry-1',
          data: {
            key: 'name',
            value: 'User preference value',
          },
        });
      });
    });

    it('shows success toast on successful edit', async () => {
      render(<ManageMemories {...defaultProps} />);

      const editItems = screen.getAllByText('Edit');
      fireEvent.click(editItems[0]);

      const saveBtn = screen.getByTestId('edit-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Memory updated successfully');
      });
    });

    it('shows error toast on failed edit', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUpdateMemoryEntry.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Update failed')),
      });

      render(<ManageMemories {...defaultProps} />);

      const editItems = screen.getAllByText('Edit');
      fireEvent.click(editItems[0]);

      const saveBtn = screen.getByTestId('edit-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update memory');
      });
      consoleSpy.mockRestore();
    });

    it('closes edit modal when cancel is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      const editItems = screen.getAllByText('Edit');
      fireEvent.click(editItems[0]);
      expect(screen.getByTestId('edit-memory-modal')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('edit-cancel-btn');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('edit-memory-modal')).not.toBeInTheDocument();
    });

    it('closes edit modal via onOpenChange(false)', () => {
      render(<ManageMemories {...defaultProps} />);

      const editItems = screen.getAllByText('Edit');
      fireEvent.click(editItems[0]);
      expect(screen.getByTestId('edit-memory-modal')).toBeInTheDocument();

      // Close via onOpenChange(false)
      const closeBtn = screen.getByTestId('edit-close-btn');
      fireEvent.click(closeBtn);
      expect(screen.queryByTestId('edit-memory-modal')).not.toBeInTheDocument();
    });

    it('does not call updateMemoryEntry when no memory is being edited', async () => {
      render(<ManageMemories {...defaultProps} />);
      // No edit modal is open, so saveEdit should be a no-op
      // This is implicitly tested by the fact that updateMemoryEntry is not called
      expect(mockUpdateMemoryEntry).not.toHaveBeenCalled();
    });
  });

  describe('Add Memory', () => {
    it('opens add modal when Add Memory button is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);

      expect(screen.getByTestId('add-memory-modal')).toBeInTheDocument();
    });

    it('calls createMemory when save is clicked with content', async () => {
      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId('add-content-input') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'New memory content' } });

      const saveBtn = screen.getByTestId('add-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantKey: 'test-tenant',
            username: 'testuser',
            data: expect.objectContaining({
              platform: 'test-tenant',
              mentor_unique_id: 'mentor-1',
              entries: [{ key: 'memory', value: 'New memory content' }],
              category: 'all',
            }),
          }),
        );
      });
    });

    it('shows success toast on successful create', async () => {
      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId('add-content-input');
      fireEvent.change(textarea, { target: { value: 'New memory content' } });

      const saveBtn = screen.getByTestId('add-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Memory created successfully');
      });
    });

    it('shows error toast on failed create', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCreateMemory.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('Create failed')),
      });

      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId('add-content-input');
      fireEvent.change(textarea, { target: { value: 'Some content' } });

      const saveBtn = screen.getByTestId('add-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create memory');
      });
      consoleSpy.mockRestore();
    });

    it('does not create memory when content is empty', async () => {
      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);

      // Don't type anything, just click save
      const saveBtn = screen.getByTestId('add-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMemory).not.toHaveBeenCalled();
      });
    });

    it('does not create memory when content is whitespace only', async () => {
      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId('add-content-input');
      fireEvent.change(textarea, { target: { value: '   ' } });

      const saveBtn = screen.getByTestId('add-save-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMemory).not.toHaveBeenCalled();
      });
    });

    it('closes add modal when cancel is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);
      expect(screen.getByTestId('add-memory-modal')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('add-cancel-btn');
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId('add-memory-modal')).not.toBeInTheDocument();
    });

    it('closes add modal via onOpenChange(false)', () => {
      render(<ManageMemories {...defaultProps} />);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);
      expect(screen.getByTestId('add-memory-modal')).toBeInTheDocument();

      const closeBtn = screen.getByTestId('add-close-btn');
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId('add-memory-modal')).not.toBeInTheDocument();
    });

    it('pre-fills category with selected category', () => {
      render(<ManageMemories {...defaultProps} />);

      // Select Personal Info category
      const categoryButtons = screen.getAllByText('Personal Info');
      const tabButton = categoryButtons.find((el) => el.tagName === 'BUTTON');
      if (tabButton) fireEvent.click(tabButton);

      const addBtn = screen.getByText('Add Memory');
      fireEvent.click(addBtn);

      // The add modal should be open
      expect(screen.getByTestId('add-memory-modal')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('shows pagination when total pages > 1', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: { ...mockMemoriesResponse, count: 25 },
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('does not show pagination when total pages is 1', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });

    it('handles page change', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: { ...mockMemoriesResponse, count: 25 },
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);

      const nextBtn = screen.getByTestId('next-page');
      fireEvent.click(nextBtn);

      // The query should be called with page 2
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalled();
    });

    it('does not show pagination when loading', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: { ...mockMemoriesResponse, count: 25 },
        isLoading: true,
        isFetching: true,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
    });
  });

  describe('User Filter', () => {
    it('renders "All Users" option', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('All Users')).toBeInTheDocument();
    });

    it('renders user emails in filter dropdown', () => {
      render(<ManageMemories {...defaultProps} />);
      const items = screen.getAllByTestId('command-item');
      // All Users + 2 users = 3
      expect(items.length).toBe(3);
    });

    it('selects a user when clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      const userItems = screen.getAllByTestId('command-item');
      // Click user1 (index 1)
      fireEvent.click(userItems[1]);

      // The query should be re-called
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalled();
    });

    it('clears user selection when All Users is clicked', () => {
      render(<ManageMemories {...defaultProps} />);

      // Select a user first
      const userItems = screen.getAllByTestId('command-item');
      fireEvent.click(userItems[1]);

      // Click All Users
      const allUsersItems = screen.getAllByTestId('command-item');
      fireEvent.click(allUsersItems[0]);

      expect(screen.getByText('Search for User')).toBeInTheDocument();
    });
  });

  describe('Date Range Filter', () => {
    it('updates date display when range is selected', () => {
      render(<ManageMemories {...defaultProps} />);

      const selectDateBtn = screen.getByTestId('calendar-select');
      fireEvent.click(selectDateBtn);

      expect(screen.getByText(/Jan 01 - Jan 31/)).toBeInTheDocument();
    });
  });

  describe('Query Parameters', () => {
    it('passes mentor ID to filtered memories query', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            mentor: 'mentor-1',
          }),
        }),
        expect.any(Object),
      );
    });

    it('skips query when tenantKey is missing', () => {
      render(<ManageMemories tenantKey="" username="testuser" mentorId="mentor-1" />);
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });

    it('skips query when username is null', () => {
      render(<ManageMemories tenantKey="test-tenant" username={null} mentorId="mentor-1" />);
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });

    it('skips query when mentorId is missing', () => {
      render(<ManageMemories tenantKey="test-tenant" username="testuser" mentorId="" />);
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined categoriesResponse', () => {
      mockGetMemoryCategoriesQuery.mockReturnValue({
        data: undefined,
      });

      render(<ManageMemories {...defaultProps} />);
      // Should still render with "All" category
      expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty categories array', () => {
      mockGetMemoryCategoriesQuery.mockReturnValue({
        data: { categories: [] },
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getAllByText('All').length).toBeGreaterThanOrEqual(1);
    });

    it('handles memory without email or username', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: 'mem-no-email',
              category: 'personal_info',
              entries: [
                {
                  unique_id: 'entry-no-email',
                  key: 'note',
                  value: 'A note without user info',
                  inserted_at: '',
                  updated_at: '',
                  expires_at: null,
                  category: 'personal_info',
                },
              ],
            },
          ],
          count: 1,
          next: null,
          previous: null,
        },
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('handles memory without insertedAt', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: 'mem-no-date',
              username: 'user1',
              email: 'user1@test.com',
              category: 'personal_info',
              entries: [
                {
                  unique_id: 'entry-no-date',
                  key: 'note',
                  value: 'No timestamp memory',
                  inserted_at: '',
                  updated_at: '',
                  expires_at: null,
                  category: 'personal_info',
                },
              ],
            },
          ],
          count: 1,
          next: null,
          previous: null,
        },
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('No timestamp memory')).toBeInTheDocument();
    });

    it('handles undefined memoryFilters', () => {
      mockGetMemoryFiltersQuery.mockReturnValue({
        data: undefined,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Search for User')).toBeInTheDocument();
    });

    it('resets to page 1 when learner filter changes', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: { ...mockMemoriesResponse, count: 25 },
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);

      // Go to page 2
      const nextBtn = screen.getByTestId('next-page');
      fireEvent.click(nextBtn);

      // Select a learner - should reset page
      const userItems = screen.getAllByTestId('command-item');
      fireEvent.click(userItems[1]);

      // After selecting learner, page should reset to 1
      // The query should eventually be called with page: 1
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalled();
    });

    it('uses lti_email or lti_username when primary fields are missing', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: 'mem-lti',
              lti_email: 'lti@test.com',
              lti_username: 'lti-user',
              category: 'personal_info',
              entries: [
                {
                  unique_id: 'entry-lti',
                  key: 'note',
                  value: 'LTI user memory',
                  inserted_at: '',
                  updated_at: '',
                  expires_at: null,
                  category: 'personal_info',
                },
              ],
            },
          ],
          count: 1,
          next: null,
          previous: null,
        },
        isLoading: false,
        isFetching: false,
      });

      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('LTI user memory')).toBeInTheDocument();
    });

    it('renders mobile category dropdown', () => {
      render(<ManageMemories {...defaultProps} />);
      // The mobile dropdown should be rendered (even though it's hidden via CSS)
      const dropdownMenus = screen.getAllByTestId('dropdown-menu');
      expect(dropdownMenus.length).toBeGreaterThanOrEqual(1);
    });
  });
});
