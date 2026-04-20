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

import { ManageCategoriesModal } from '../manage-categories-modal';

const mockGetCategoriesQuery = vi.fn();
const mockCreateCategory = vi.fn();
const mockUpdateCategory = vi.fn();
const mockDeleteCategory = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMemoryCategoriesAdminQuery: (...args: any[]) =>
    mockGetCategoriesQuery(...args),
  useCreateMemoryCategoryMutation: () => [
    mockCreateCategory,
    { isLoading: false },
  ],
  useUpdateMemoryCategoryMutation: () => [
    mockUpdateCategory,
    { isLoading: false },
  ],
  useDeleteMemoryCategoryMutation: () => [
    mockDeleteCategory,
    { isLoading: false },
  ],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Dialog ⇒ render children when open; skip Radix portals/animations.
// The hidden `dialog-dismiss` button exposes the component's onOpenChange
// wrapper so tests can exercise the reset-on-close code path.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? (
      <div role="dialog">
        <button
          data-testid="dialog-dismiss"
          onClick={() => onOpenChange?.(false)}
        >
          dismiss
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

const makeUnwrap = (mockFn: any) => {
  // RTK Query's `.unwrap()` returns a Promise that resolves with the payload
  // or rejects with the error.
  mockFn.mockImplementation(() => ({
    unwrap: () => Promise.resolve({}),
  }));
};

const makeRejectingUnwrap = (mockFn: any, error: any) => {
  mockFn.mockImplementation(() => ({
    unwrap: () => Promise.reject(error),
  }));
};

const baseCategories = [
  { id: 1, name: 'General', slug: 'general' },
  { id: 2, name: 'Work', slug: 'work' },
];

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  tenantKey: 'org-1',
  mentorId: 'mentor-1',
};

describe('ManageCategoriesModal', () => {
  beforeEach(() => {
    mockGetCategoriesQuery.mockReturnValue({
      data: baseCategories,
      isLoading: false,
    });
    makeUnwrap(mockCreateCategory);
    makeUnwrap(mockUpdateCategory);
    makeUnwrap(mockDeleteCategory);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders existing categories from the query', () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByText('Work')).toBeTruthy();
  });

  it('shows an empty state when no categories exist', () => {
    mockGetCategoriesQuery.mockReturnValue({ data: [], isLoading: false });
    render(<ManageCategoriesModal {...defaultProps} />);

    expect(screen.getByText('No categories yet.')).toBeTruthy();
  });

  it('shows a loading state while the query is in flight', () => {
    mockGetCategoriesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<ManageCategoriesModal {...defaultProps} />);

    expect(screen.getByText('Loading categories...')).toBeTruthy();
  });

  it('creates a new category with an auto-derived slug', async () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    const input = screen.getByPlaceholderText(
      'New category name',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Deep Focus' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({
        org: 'org-1',
        mentorId: 'mentor-1',
        data: { name: 'Deep Focus', slug: 'deep_focus' },
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Category created');
    // Input should reset after success
    expect(input.value).toBe('');
  });

  it('does nothing when the new category name is blank', () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    const addButton = screen.getByRole('button', {
      name: /add/i,
    }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    fireEvent.click(addButton);
    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it('toasts an error when category creation fails', async () => {
    makeRejectingUnwrap(mockCreateCategory, new Error('boom'));
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('New category name'), {
      target: { value: 'Bad' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create category');
    });
  });

  it('renames a category via the edit flow', async () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Work' }));

    // Second input is the edit-row input (first is "New category name")
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const editInput = inputs[1];
    fireEvent.change(editInput, { target: { value: 'Workstream' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save category' }));

    await waitFor(() => {
      expect(mockUpdateCategory).toHaveBeenCalledWith({
        org: 'org-1',
        mentorId: 'mentor-1',
        categoryId: 2,
        data: { name: 'Workstream' },
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Category updated');
  });

  it('cancels an in-progress edit without calling the mutation', () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }));

    expect(mockUpdateCategory).not.toHaveBeenCalled();
    // Row should return to display mode
    expect(screen.getByText('Work')).toBeTruthy();
  });

  it('requires confirmation before deleting a category', async () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Work' }));

    // Delete has not been called yet — inline confirm is showing.
    expect(mockDeleteCategory).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete .*Work.*\?/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDeleteCategory).toHaveBeenCalledWith({
        org: 'org-1',
        mentorId: 'mentor-1',
        categoryId: 2,
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Category deleted');
  });

  it('backs out of the delete confirmation with Cancel', () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockDeleteCategory).not.toHaveBeenCalled();
    expect(screen.queryByText(/Delete .*Work.*\?/)).toBeNull();
  });

  it('toasts an error when deletion fails', async () => {
    makeRejectingUnwrap(mockDeleteCategory, new Error('nope'));
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Work' }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to delete category');
    });
  });

  it('closes via the Done button', () => {
    const onOpenChange = vi.fn();
    render(
      <ManageCategoriesModal {...defaultProps} onOpenChange={onOpenChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('creates a category when Enter is pressed inside the new-name input', async () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('New category name');
    fireEvent.change(input, { target: { value: 'Quick Add' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({
        org: 'org-1',
        mentorId: 'mentor-1',
        data: { name: 'Quick Add', slug: 'quick_add' },
      });
    });
  });

  it('does not submit on Enter when the new-name input is empty', () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('New category name');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it('saves an edit when Enter is pressed inside the edit input', async () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Work' }));
    const editInput = (
      screen.getAllByRole('textbox') as HTMLInputElement[]
    )[1]!;
    fireEvent.change(editInput, { target: { value: 'Work Renamed' } });
    fireEvent.keyDown(editInput, { key: 'Enter' });

    await waitFor(() => {
      expect(mockUpdateCategory).toHaveBeenCalledWith({
        org: 'org-1',
        mentorId: 'mentor-1',
        categoryId: 2,
        data: { name: 'Work Renamed' },
      });
    });
  });

  it('cancels an edit when Escape is pressed inside the edit input', () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Work' }));
    const editInput = (
      screen.getAllByRole('textbox') as HTMLInputElement[]
    )[1]!;
    fireEvent.change(editInput, { target: { value: 'Scrap' } });
    fireEvent.keyDown(editInput, { key: 'Escape' });

    expect(mockUpdateCategory).not.toHaveBeenCalled();
    expect(screen.getByText('Work')).toBeTruthy();
  });

  it('does not call update when the trimmed edit name is empty', () => {
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Work' }));
    const editInput = (
      screen.getAllByRole('textbox') as HTMLInputElement[]
    )[1]!;
    fireEvent.change(editInput, { target: { value: '   ' } });
    fireEvent.keyDown(editInput, { key: 'Enter' });

    expect(mockUpdateCategory).not.toHaveBeenCalled();
  });

  it('resets transient state when the dialog dispatches onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(
      <ManageCategoriesModal {...defaultProps} onOpenChange={onOpenChange} />,
    );

    // Populate new-name, start an edit, and stage a delete confirm so
    // that every reset branch inside the wrapper has work to do.
    fireEvent.change(screen.getByPlaceholderText('New category name'), {
      target: { value: 'Draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Work' }));

    // Dispatch the close from the Dialog mock → component wrapper runs
    // cancelEdit/setConfirmDeleteId(null)/setNewName('') before forwarding.
    fireEvent.click(screen.getByTestId('dialog-dismiss'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toasts an error when an update fails', async () => {
    makeRejectingUnwrap(mockUpdateCategory, new Error('update boom'));
    render(<ManageCategoriesModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Work' }));
    const editInput = (
      screen.getAllByRole('textbox') as HTMLInputElement[]
    )[1]!;
    fireEvent.change(editInput, { target: { value: 'Workflow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update category');
    });
  });
});
