import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from '@testing-library/react';
import { toast } from 'sonner';

import { ManageMemories } from '../manage-memories';

// ---- Query hook mocks ----
const mockGetMentorMemoriesListQuery = vi.fn();
const mockGetMemoryCategoriesAdminQuery = vi.fn();

const mockDeleteMentorMemory = vi.fn();
const mockUpdateMentorMemory = vi.fn();
const mockCreateMentorMemory = vi.fn();
const mockDeleteMentorMemoryLoading = vi.fn(() => false);
const mockUpdateMentorMemoryLoading = vi.fn(() => false);
const mockCreateMentorMemoryLoading = vi.fn(() => false);

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorMemoriesListQuery: (...args: unknown[]) =>
    mockGetMentorMemoriesListQuery(...args),
  useGetMemoryCategoriesAdminQuery: (...args: unknown[]) =>
    mockGetMemoryCategoriesAdminQuery(...args),
  useDeleteMentorMemoryMutation: () => [
    mockDeleteMentorMemory,
    { isLoading: mockDeleteMentorMemoryLoading() },
  ],
  useUpdateMentorMemoryMutation: () => [
    mockUpdateMentorMemory,
    { isLoading: mockUpdateMentorMemoryLoading() },
  ],
  useCreateMentorMemoryMutation: () => [
    mockCreateMentorMemory,
    { isLoading: mockCreateMentorMemoryLoading() },
  ],
  // Category mutation hooks used by ManageCategoriesModal. The modal itself
  // is stubbed below via `vi.mock('../manage-categories-modal', ...)`, but
  // these stubs guard against any transitive resolution of the module.
  useCreateMemoryCategoryMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateMemoryCategoryMutation: () => [vi.fn(), { isLoading: false }],
  useDeleteMemoryCategoryMutation: () => [vi.fn(), { isLoading: false }],
  // Pulled in transitively via use-mentor-settings on some import chains.
  useGetMemsearchStatusQuery: () => ({ data: undefined, isLoading: false }),
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

// ---- UI primitive stubs ----
vi.mock('@/components/ui/button', () => {
  const Button = React.forwardRef(
    ({ children, onClick, disabled, ...rest }: any, ref: any) => (
      <button ref={ref} onClick={onClick} disabled={disabled} {...rest}>
        {children}
      </button>
    ),
  );
  Button.displayName = 'Button';
  return { Button };
});

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" role="menuitem" onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <>{children}</>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ placeholder }: any) => <input placeholder={placeholder} />,
  CommandList: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandItem: ({ children, onSelect }: any) => (
    <div
      data-testid="command-item"
      role="option"
      aria-selected={false}
      onClick={() => onSelect?.()}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: any) => (
    <button
      data-testid="calendar-select"
      onClick={() =>
        onSelect?.({
          from: new Date('2024-01-01T00:00:00.000Z'),
          to: new Date('2024-01-31T00:00:00.000Z'),
        })
      }
    >
      Select Date
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// ---- Dynamic modal stubs ----
// Each modal is imported via `next/dynamic`; the test stubs intercept the
// direct path imports and expose a tiny test harness with interactive
// controls (save/cancel/onOpenChange triggers).
vi.mock('../edit-memory-modal', () => ({
  EditMemoryModal: ({
    open,
    onOpenChange,
    editContent,
    editCategory,
    onContentChange,
    onCategoryChange,
    onSave,
    onCancel,
  }: any) =>
    open ? (
      <div data-testid="edit-memory-modal">
        <input
          data-testid="edit-content-input"
          value={editContent}
          onChange={(e) => onContentChange(e.target.value)}
        />
        <input
          data-testid="edit-category-input"
          value={editCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        />
        <button data-testid="edit-save" onClick={onSave}>
          Save
        </button>
        <button data-testid="edit-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="edit-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../manage-categories-modal', () => ({
  ManageCategoriesModal: ({ open }: any) =>
    open ? <div data-testid="manage-categories-modal" /> : null,
}));

vi.mock('../add-memory-modal', () => ({
  AddMemoryModal: ({
    open,
    onOpenChange,
    newMemoryContent,
    newMemoryCategory,
    onContentChange,
    onCategoryChange,
    onSave,
    onCancel,
  }: any) =>
    open ? (
      <div data-testid="add-memory-modal">
        <input
          data-testid="add-content-input"
          value={newMemoryContent}
          onChange={(e) => onContentChange(e.target.value)}
        />
        <input
          data-testid="add-category-input"
          value={newMemoryCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        />
        <button data-testid="add-save" onClick={onSave}>
          Save
        </button>
        <button data-testid="add-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="add-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../delete-memory-modal', () => ({
  DeleteMemoryModal: ({ open, onOpenChange, onConfirm, onCancel }: any) =>
    open ? (
      <div data-testid="delete-memory-modal">
        <button data-testid="delete-confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="delete-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="delete-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('../bulk-delete-memory-modal', () => ({
  BulkDeleteMemoryModal: ({
    open,
    onOpenChange,
    onConfirm,
    onCancel,
    selectedCategory,
  }: any) =>
    open ? (
      <div data-testid="bulk-delete-modal">
        <span data-testid="bulk-delete-category">{selectedCategory}</span>
        <button data-testid="bulk-delete-confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="bulk-delete-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          data-testid="bulk-delete-close"
          onClick={() => onOpenChange(false)}
        >
          Close
        </button>
      </div>
    ) : null,
}));

// ---- Test data ----
const mockCategory = (id: number, name: string, slug: string) => ({
  id,
  name,
  slug,
});

const mockMemory = (overrides: Partial<any> = {}) => ({
  id: overrides.id ?? 1,
  content: overrides.content ?? 'Default memory content',
  category: overrides.category ?? mockCategory(1, 'Preferences', 'preferences'),
  email: overrides.email ?? 'alice@example.com',
  created_at: overrides.created_at ?? '2024-01-15T10:30:00.000Z',
});

const defaultResults = [
  mockMemory({
    id: 1,
    content: 'Loves dark mode',
    category: mockCategory(1, 'Preferences', 'preferences'),
    email: 'alice@example.com',
  }),
  mockMemory({
    id: 2,
    content: 'Prefers vim keybindings',
    category: mockCategory(1, 'Preferences', 'preferences'),
    email: 'bob@example.com',
  }),
  mockMemory({
    id: 3,
    content: 'Former backend dev',
    category: mockCategory(2, 'Background', 'background'),
    email: 'alice@example.com',
  }),
];

const defaultAdminCategories = [
  { id: 1, name: 'Preferences', slug: 'preferences' },
  { id: 2, name: 'Background', slug: 'background' },
  { id: 3, name: 'Goals', slug: 'goals' },
];

const defaultProps = {
  tenantKey: 'test-tenant',
  username: 'testuser',
  mentorId: 'mentor-1',
};

// Helper: find the category tab in the desktop tabs list by text.
// The component renders each category as `<button role="tab">{name}</button>`
// — the explicit role override means getAllByRole('button') doesn't match
// these. Use the actual ARIA role.
const clickCategoryTab = (categoryName: string) => {
  const tabs = screen.getAllByRole('tab');
  const tab = tabs.find((b) => b.textContent?.trim() === categoryName);
  if (!tab) throw new Error(`Category tab "${categoryName}" not found`);
  fireEvent.click(tab);
};

describe('ManageMemories', () => {
  beforeEach(() => {
    cleanup();
    mockGetMentorMemoriesListQuery.mockReset();
    mockGetMemoryCategoriesAdminQuery.mockReset();
    mockDeleteMentorMemory.mockReset();
    mockUpdateMentorMemory.mockReset();
    mockCreateMentorMemory.mockReset();
    mockDeleteMentorMemoryLoading.mockReturnValue(false);
    mockUpdateMentorMemoryLoading.mockReturnValue(false);
    mockCreateMentorMemoryLoading.mockReturnValue(false);
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();

    // Default mock applies the same server-side filtering the real endpoint
    // does (category + email), so user-facing tests can still observe
    // tab/learner filtering through the rendered list.
    mockGetMentorMemoriesListQuery.mockImplementation(
      (args: { params?: any } = {}) => {
        const params = args.params ?? {};
        const isSnapshot = params.page_size === 1000;
        let results = defaultResults;
        if (!isSnapshot) {
          if (params.category) {
            results = results.filter(
              (m) => m.category.slug === params.category,
            );
          }
          if (params.email) {
            results = results.filter((m) => m.email === params.email);
          }
        }
        return {
          data: {
            count: results.length,
            next: null,
            previous: null,
            results,
          },
          isLoading: false,
        };
      },
    );
    mockGetMemoryCategoriesAdminQuery.mockReturnValue({
      data: defaultAdminCategories,
    });

    // Default mutation returns an object with `.unwrap()` that resolves.
    mockDeleteMentorMemory.mockImplementation(() => ({
      unwrap: () => Promise.resolve({}),
    }));
    mockUpdateMentorMemory.mockImplementation(() => ({
      unwrap: () => Promise.resolve({}),
    }));
    mockCreateMentorMemory.mockImplementation(() => ({
      unwrap: () => Promise.resolve({}),
    }));
  });

  afterEach(() => cleanup());

  describe('Rendering', () => {
    it('renders the user filter and date range section', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Search for User')).toBeInTheDocument();
      expect(screen.getByText('Pick a Date Range')).toBeInTheDocument();
    });

    it('renders one category tab per category (including the synthetic "All")', () => {
      render(<ManageMemories {...defaultProps} />);
      // The category button list lives in a dedicated flex container and
      // includes All + Preferences + Background + Goals.
      const labels = ['All', 'Preferences', 'Background', 'Goals'];
      labels.forEach((label) => {
        const matches = screen.getAllByText(label);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders the Add Memory button', () => {
      render(<ManageMemories {...defaultProps} />);
      // "Add Memory" appears on desktop; "Add" on mobile — both in the DOM.
      expect(screen.getByText('Add Memory')).toBeInTheDocument();
    });

    it('renders a memory card for every flattened memory by default (All selected)', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Loves dark mode')).toBeInTheDocument();
      expect(screen.getByText('Prefers vim keybindings')).toBeInTheDocument();
      expect(screen.getByText('Former backend dev')).toBeInTheDocument();
    });

    it('renders the email for every memory card', () => {
      render(<ManageMemories {...defaultProps} />);
      // Emails appear both on cards and in the user-filter command items.
      expect(
        screen.getAllByText('alice@example.com').length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('bob@example.com').length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Loading state', () => {
    it('shows the loading message when memories are loading', () => {
      mockGetMentorMemoriesListQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('Loading memories...')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows "No saved memories yet." when the response is an empty list', () => {
      mockGetMentorMemoriesListQuery.mockReturnValue({
        data: { count: 0, next: null, previous: null, results: [] },
        isLoading: false,
      });
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('No saved memories yet.')).toBeInTheDocument();
    });

    it('shows "No saved memories yet." when the response is undefined', () => {
      mockGetMentorMemoriesListQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('No saved memories yet.')).toBeInTheDocument();
    });
  });

  describe('Category filtering', () => {
    it('defaults to the "All" category', () => {
      render(<ManageMemories {...defaultProps} />);
      // With "All" selected, both Preferences and Background memories appear.
      expect(screen.getByText('Loves dark mode')).toBeInTheDocument();
      expect(screen.getByText('Former backend dev')).toBeInTheDocument();
    });

    it('filters memories down to a single category when that tab is clicked', () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Background');
      // Only the Background memory should remain; Preferences memories go away.
      expect(screen.getByText('Former backend dev')).toBeInTheDocument();
      expect(screen.queryByText('Loves dark mode')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Prefers vim keybindings'),
      ).not.toBeInTheDocument();
    });

    it('does not show the "Delete All" button while "All" is selected', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.queryByText('Delete All')).not.toBeInTheDocument();
    });

    it('shows the "Delete All" button after selecting a specific category with memories', () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      expect(screen.getByText('Delete All')).toBeInTheDocument();
    });

    it('does not show the "Delete All" button for a category that has no memories', () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Goals');
      // Goals exists as a category but has no memories → empty state, no bulk delete.
      expect(screen.queryByText('Delete All')).not.toBeInTheDocument();
    });
  });

  describe('Add Memory flow', () => {
    it('opens the Add Memory modal when the button is clicked', () => {
      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));
      expect(screen.getByTestId('add-memory-modal')).toBeInTheDocument();
    });

    it('pre-fills the category with the currently selected category name', () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Add Memory'));
      const categoryInput = screen.getByTestId(
        'add-category-input',
      ) as HTMLInputElement;
      expect(categoryInput.value).toBe('Preferences');
    });

    it('calls createMentorMemory with trimmed content on save', async () => {
      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));

      const contentInput = screen.getByTestId('add-content-input');
      fireEvent.change(contentInput, {
        target: { value: '  New memory content  ' },
      });
      fireEvent.click(screen.getByTestId('add-save'));

      await waitFor(() => {
        expect(mockCreateMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            org: 'test-tenant',
            userId: 'testuser',
            mentorId: 'mentor-1',
            data: expect.objectContaining({
              content: 'New memory content',
            }),
          }),
        );
      });
    });

    it('coerces the "all" category to "general" on create', async () => {
      render(<ManageMemories {...defaultProps} />);
      // With All selected, opening Add fills category with "All".
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.change(screen.getByTestId('add-content-input'), {
        target: { value: 'A memory' },
      });
      // Category input shows "All" — change it to something not in the
      // categories list so the fallback branch runs.
      fireEvent.change(screen.getByTestId('add-category-input'), {
        target: { value: 'All' },
      });
      fireEvent.click(screen.getByTestId('add-save'));

      await waitFor(() => {
        expect(mockCreateMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ category_slug: 'general' }),
          }),
        );
      });
    });

    it('does nothing when content is empty', async () => {
      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.click(screen.getByTestId('add-save'));

      // Small tick to let any async work run.
      await new Promise((r) => setTimeout(r, 0));
      expect(mockCreateMentorMemory).not.toHaveBeenCalled();
    });

    it('does nothing when content is whitespace only', async () => {
      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.change(screen.getByTestId('add-content-input'), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByTestId('add-save'));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockCreateMentorMemory).not.toHaveBeenCalled();
    });

    it('does not create when tenantKey is missing', async () => {
      render(<ManageMemories {...defaultProps} tenantKey={''} />);
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.change(screen.getByTestId('add-content-input'), {
        target: { value: 'A memory' },
      });
      fireEvent.click(screen.getByTestId('add-save'));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockCreateMentorMemory).not.toHaveBeenCalled();
    });

    it('does not create when username is null', async () => {
      render(<ManageMemories {...defaultProps} username={null} />);
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.change(screen.getByTestId('add-content-input'), {
        target: { value: 'A memory' },
      });
      fireEvent.click(screen.getByTestId('add-save'));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockCreateMentorMemory).not.toHaveBeenCalled();
    });

    it('shows a success toast after a successful create', async () => {
      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.change(screen.getByTestId('add-content-input'), {
        target: { value: 'New memory' },
      });
      fireEvent.click(screen.getByTestId('add-save'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Memory created successfully',
        );
      });
    });

    it('shows an error toast when create fails', async () => {
      mockCreateMentorMemory.mockImplementation(() => ({
        unwrap: () => Promise.reject(new Error('boom')),
      }));
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.change(screen.getByTestId('add-content-input'), {
        target: { value: 'New memory' },
      });
      fireEvent.click(screen.getByTestId('add-save'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create memory');
      });
      consoleSpy.mockRestore();
    });

    it('closes the modal when Cancel is clicked', () => {
      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));
      expect(screen.getByTestId('add-memory-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('add-cancel'));
      expect(screen.queryByTestId('add-memory-modal')).not.toBeInTheDocument();
    });

    it('closes the modal when onOpenChange(false) fires', () => {
      render(<ManageMemories {...defaultProps} />);
      fireEvent.click(screen.getByText('Add Memory'));
      fireEvent.click(screen.getByTestId('add-close'));
      expect(screen.queryByTestId('add-memory-modal')).not.toBeInTheDocument();
    });
  });

  describe('Edit Memory flow', () => {
    const openEditFor = (cardText: string) => {
      // Each card has its own dropdown with Edit + Delete menu items.
      // Click the Edit item whose card contains the matching text.
      const card = screen.getByText(cardText).closest('div.flex-1');
      expect(card).not.toBeNull();
      const container = card!.parentElement!;
      const editItem = within(container).getByText('Edit');
      fireEvent.click(editItem);
    };

    it('opens the Edit modal when "Edit" is clicked on a memory', () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      expect(screen.getByTestId('edit-memory-modal')).toBeInTheDocument();
    });

    it('pre-fills the edit modal with the memory content and category name', () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      expect(
        (screen.getByTestId('edit-content-input') as HTMLInputElement).value,
      ).toBe('Loves dark mode');
      expect(
        (screen.getByTestId('edit-category-input') as HTMLInputElement).value,
      ).toBe('Preferences');
    });

    it('calls updateMentorMemory with the updated content on save', async () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      fireEvent.change(screen.getByTestId('edit-content-input'), {
        target: { value: 'Loves dracula theme' },
      });
      fireEvent.click(screen.getByTestId('edit-save'));

      await waitFor(() => {
        expect(mockUpdateMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            org: 'test-tenant',
            userId: 'testuser',
            mentorId: 'mentor-1',
            memoryId: 1,
            data: expect.objectContaining({
              content: 'Loves dracula theme',
            }),
          }),
        );
      });
    });

    it('includes category_slug in the update when the category is changed', async () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      fireEvent.change(screen.getByTestId('edit-category-input'), {
        target: { value: 'Background' },
      });
      fireEvent.click(screen.getByTestId('edit-save'));

      await waitFor(() => {
        expect(mockUpdateMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              category_slug: 'background',
            }),
          }),
        );
      });
    });

    it('does NOT send category_slug when the category is unchanged', async () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      // Leave category as "Preferences" — the memory's current category.
      fireEvent.click(screen.getByTestId('edit-save'));

      await waitFor(() => {
        expect(mockUpdateMentorMemory).toHaveBeenCalled();
      });
      const call = mockUpdateMentorMemory.mock.calls[0][0];
      expect(call.data).not.toHaveProperty('category_slug');
    });

    it('shows a success toast after a successful edit', async () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('edit-save'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Memory updated successfully',
        );
      });
    });

    it('shows an error toast when edit fails', async () => {
      mockUpdateMentorMemory.mockImplementation(() => ({
        unwrap: () => Promise.reject(new Error('boom')),
      }));
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('edit-save'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update memory');
      });
      consoleSpy.mockRestore();
    });

    it('closes the modal on Cancel', () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('edit-cancel'));
      expect(screen.queryByTestId('edit-memory-modal')).not.toBeInTheDocument();
    });

    it('closes the modal via onOpenChange(false)', () => {
      render(<ManageMemories {...defaultProps} />);
      openEditFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('edit-close'));
      expect(screen.queryByTestId('edit-memory-modal')).not.toBeInTheDocument();
    });
  });

  describe('Delete Memory flow', () => {
    const openDeleteFor = (cardText: string) => {
      const card = screen.getByText(cardText).closest('div.flex-1');
      const container = card!.parentElement!;
      const deleteItem = within(container).getByText('Delete');
      fireEvent.click(deleteItem);
    };

    it('shows the delete confirmation modal when Delete is clicked', () => {
      render(<ManageMemories {...defaultProps} />);
      openDeleteFor('Loves dark mode');
      expect(screen.getByTestId('delete-memory-modal')).toBeInTheDocument();
    });

    it('calls deleteMentorMemory with the memory id on confirm', async () => {
      render(<ManageMemories {...defaultProps} />);
      openDeleteFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await waitFor(() => {
        expect(mockDeleteMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            org: 'test-tenant',
            userId: 'testuser',
            mentorId: 'mentor-1',
            memoryId: 1,
          }),
        );
      });
    });

    it('does not delete when tenantKey is missing', async () => {
      render(<ManageMemories {...defaultProps} tenantKey={''} />);
      openDeleteFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockDeleteMentorMemory).not.toHaveBeenCalled();
    });

    it('does not delete when username is null', async () => {
      render(<ManageMemories {...defaultProps} username={null} />);
      openDeleteFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockDeleteMentorMemory).not.toHaveBeenCalled();
    });

    it('shows a success toast after a successful delete', async () => {
      render(<ManageMemories {...defaultProps} />);
      openDeleteFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Memory deleted successfully',
        );
      });
    });

    it('shows an error toast when delete fails', async () => {
      mockDeleteMentorMemory.mockImplementation(() => ({
        unwrap: () => Promise.reject(new Error('boom')),
      }));
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(<ManageMemories {...defaultProps} />);
      openDeleteFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('delete-confirm'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete memory');
      });
      consoleSpy.mockRestore();
    });

    it('closes the modal on Cancel', () => {
      render(<ManageMemories {...defaultProps} />);
      openDeleteFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('delete-cancel'));
      expect(
        screen.queryByTestId('delete-memory-modal'),
      ).not.toBeInTheDocument();
    });

    it('closes the modal via onOpenChange(false)', () => {
      render(<ManageMemories {...defaultProps} />);
      openDeleteFor('Loves dark mode');
      fireEvent.click(screen.getByTestId('delete-close'));
      expect(
        screen.queryByTestId('delete-memory-modal'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Bulk delete flow', () => {
    it('opens the bulk delete modal when "Delete All" is clicked', () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Delete All'));
      expect(screen.getByTestId('bulk-delete-modal')).toBeInTheDocument();
    });

    it('passes the selected category name to the bulk modal', () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Delete All'));
      expect(screen.getByTestId('bulk-delete-category')).toHaveTextContent(
        'Preferences',
      );
    });

    it('calls deleteMentorMemory once per memory in the selected category on confirm', async () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Delete All'));
      fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

      await waitFor(() => {
        // Preferences has 2 memories (id 1 and id 2).
        expect(mockDeleteMentorMemory).toHaveBeenCalledTimes(2);
      });
      expect(mockDeleteMentorMemory).toHaveBeenCalledWith(
        expect.objectContaining({ memoryId: 1 }),
      );
      expect(mockDeleteMentorMemory).toHaveBeenCalledWith(
        expect.objectContaining({ memoryId: 2 }),
      );
    });

    it('does not bulk delete when tenantKey is missing', async () => {
      render(<ManageMemories {...defaultProps} tenantKey={''} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Delete All'));
      fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

      await new Promise((r) => setTimeout(r, 0));
      expect(mockDeleteMentorMemory).not.toHaveBeenCalled();
    });

    it('shows a success toast after a successful bulk delete', async () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Delete All'));
      fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('Preferences'),
        );
      });
    });

    it('shows an error toast when bulk delete fails', async () => {
      mockDeleteMentorMemory.mockImplementation(() => ({
        unwrap: () => Promise.reject(new Error('boom')),
      }));
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Delete All'));
      fireEvent.click(screen.getByTestId('bulk-delete-confirm'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete memories');
      });
      consoleSpy.mockRestore();
    });

    it('closes the modal on Cancel', () => {
      render(<ManageMemories {...defaultProps} />);
      clickCategoryTab('Preferences');
      fireEvent.click(screen.getByText('Delete All'));
      fireEvent.click(screen.getByTestId('bulk-delete-cancel'));
      expect(screen.queryByTestId('bulk-delete-modal')).not.toBeInTheDocument();
    });
  });

  describe('User filter', () => {
    it('renders the "All Users" option at the top of the user dropdown', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(screen.getByText('All Users')).toBeInTheDocument();
    });

    it('includes every unique learner email in the user dropdown', () => {
      render(<ManageMemories {...defaultProps} />);
      expect(
        screen.getAllByText('alice@example.com').length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText('bob@example.com').length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('selects a learner from the user dropdown and re-queries with email', () => {
      render(<ManageMemories {...defaultProps} />);
      const callsBefore = mockGetMentorMemoriesListQuery.mock.calls.length;

      // CommandItems render inside the user combobox; the learner items
      // come after the "All Users" item. Click the first learner item
      // (which invokes onSelect → setSelectedLearner).
      const commandItems = screen.getAllByRole('option');
      // index 0 is "All Users", index 1+ are learner items.
      fireEvent.click(commandItems[1]!);

      // After selecting a learner, the filtered query re-runs — at
      // least one of the new calls should carry email in params.
      const newCalls =
        mockGetMentorMemoriesListQuery.mock.calls.slice(callsBefore);
      const withEmail = newCalls.find(
        (call) => call[0]?.params && 'email' in call[0].params,
      );
      expect(withEmail).toBeTruthy();
    });
  });

  describe('Category fallback when admin categories are unavailable', () => {
    it('shows just "All" when admin categories are empty', () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({ data: [] });
      render(<ManageMemories {...defaultProps} />);

      // With no admin categories the derived list is just the synthetic "All".
      expect(screen.getAllByText('All').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: /^Preferences$/ })).toBe(
        null,
      );
    });

    it('falls back to just "All" when the memories response is undefined', () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({ data: [] });
      mockGetMentorMemoriesListQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      render(<ManageMemories {...defaultProps} />);
      // "All" still renders as the only category tab.
      expect(screen.getAllByText('All').length).toBeGreaterThan(0);
    });
  });

  describe('Mobile category dropdown', () => {
    it('selects a category via the mobile dropdown onClick', () => {
      render(<ManageMemories {...defaultProps} />);

      // Desktop tab renders "Background" as a <button>, mobile dropdown
      // renders each category as a DropdownMenuItem (role=menuitem).
      const backgroundMenuItem = screen
        .getAllByRole('menuitem')
        .find((el) => el.textContent === 'Background');
      expect(backgroundMenuItem).toBeTruthy();
      fireEvent.click(backgroundMenuItem!);

      // Only "Background" memories should remain visible.
      expect(screen.getByText('Former backend dev')).toBeInTheDocument();
      expect(screen.queryByText('Loves dark mode')).not.toBeInTheDocument();
    });
  });

  describe('Query skip logic', () => {
    it('skips the memories query when tenantKey is missing', () => {
      render(<ManageMemories {...defaultProps} tenantKey={''} />);
      const firstCall = mockGetMentorMemoriesListQuery.mock.calls[0];
      expect(firstCall[1]).toEqual(expect.objectContaining({ skip: true }));
    });

    it('skips the memories query when username is null', () => {
      render(<ManageMemories {...defaultProps} username={null} />);
      const firstCall = mockGetMentorMemoriesListQuery.mock.calls[0];
      expect(firstCall[1]).toEqual(expect.objectContaining({ skip: true }));
    });

    it('skips the memories query when mentorId is missing', () => {
      render(<ManageMemories {...defaultProps} mentorId={''} />);
      const firstCall = mockGetMentorMemoriesListQuery.mock.calls[0];
      expect(firstCall[1]).toEqual(expect.objectContaining({ skip: true }));
    });

    it('passes tenantKey, username, and mentorId to the memories query', () => {
      render(<ManageMemories {...defaultProps} />);
      const firstCall = mockGetMentorMemoriesListQuery.mock.calls[0];
      expect(firstCall[0]).toEqual(
        expect.objectContaining({
          org: 'test-tenant',
          userId: 'testuser',
          mentorId: 'mentor-1',
        }),
      );
    });
  });

  describe('Date range query params', () => {
    it('builds start_date and end_date params once a range is picked', () => {
      render(<ManageMemories {...defaultProps} />);

      // Initial params carry pagination but no date filters.
      const initialCall = mockGetMentorMemoriesListQuery.mock.calls[0][0];
      expect(initialCall.params).not.toHaveProperty('start_date');
      expect(initialCall.params).not.toHaveProperty('end_date');

      // Trigger the calendar's onSelect.
      fireEvent.click(screen.getByTestId('calendar-select'));

      // Find the most-recent call that includes the date filters.
      const lastWithDates = mockGetMentorMemoriesListQuery.mock.calls
        .map((c) => c[0])
        .reverse()
        .find((arg) => arg?.params?.start_date);
      expect(lastWithDates?.params).toEqual(
        expect.objectContaining({
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        }),
      );
    });
  });
});
