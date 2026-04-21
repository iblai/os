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

import { MemoryMenu } from '../memory-menu';

// ---- Data-layer hook mocks ----
const mockGetMentorMemoriesQuery = vi.fn();
const mockGetMemoryCategoriesAdminQuery = vi.fn();
const mockDeleteMentorMemory = vi.fn();
const mockUpdateMentorMemory = vi.fn();
const mockCreateMentorMemory = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorMemoriesQuery: (...args: unknown[]) =>
    mockGetMentorMemoriesQuery(...args),
  useGetMemoryCategoriesAdminQuery: (...args: unknown[]) =>
    mockGetMemoryCategoriesAdminQuery(...args),
  useDeleteMentorMemoryMutation: () => [
    mockDeleteMentorMemory,
    { isLoading: false },
  ],
  useUpdateMentorMemoryMutation: () => [
    mockUpdateMentorMemory,
    { isLoading: false },
  ],
  useCreateMentorMemoryMutation: () => [
    mockCreateMentorMemory,
    { isLoading: false },
  ],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetMentorId = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: mockGetMentorId }),
}));

const mockUserIsStudent = vi.fn();
vi.mock('@/hooks/use-user', () => ({
  useUserIsStudent: () => mockUserIsStudent(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'org-1', mentorId: 'mentor-from-params' }),
}));

// UI primitive stubs so we can drive the form without Radix portals.
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

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  // Replace Radix Select with a native <select>; SelectTrigger/SelectValue
  // are null so they don't end up as invalid children of a <select>.
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid="select-native"
      value={value ?? ''}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">--</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => (
    <option value={value}>{children}</option>
  ),
}));

const makeUnwrap = (fn: any, resolved: any = {}) => {
  fn.mockImplementation(() => ({
    unwrap: () => Promise.resolve(resolved),
  }));
};

const makeRejectingUnwrap = (fn: any, error: any) => {
  fn.mockImplementation(() => ({
    unwrap: () => Promise.reject(error),
  }));
};

const baseResponse = [
  {
    category: { id: 1, name: 'General', slug: 'general' },
    memories: [
      {
        id: 10,
        content: 'Likes tea',
        category: { id: 1, name: 'General', slug: 'general' },
        username: 'alice',
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        id: 11,
        content: 'Loves hiking',
        category: { id: 1, name: 'General', slug: 'general' },
        username: 'alice',
      },
    ],
  },
  {
    category: { id: 2, name: 'Work', slug: 'work' },
    memories: [
      {
        id: 20,
        content: 'Prefers async standups',
        category: { id: 2, name: 'Work', slug: 'work' },
        username: 'alice',
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        id: 21,
        content: 'Uses dark mode',
        category: { id: 2, name: 'Work', slug: 'work' },
      },
      {
        id: 22,
        content: 'Remote team',
        category: { id: 2, name: 'Work', slug: 'work' },
      },
    ],
  },
];

const adminCategories = [
  { id: 1, name: 'General', slug: 'general' },
  { id: 2, name: 'Work', slug: 'work' },
];

const defaultProps = {
  onClose: vi.fn(),
  tenantKey: 'org-1',
  username: 'alice',
};

describe('MemoryMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMentorId.mockReturnValue('mentor-1');
    mockUserIsStudent.mockReturnValue(false);
    mockGetMentorMemoriesQuery.mockReturnValue({
      data: baseResponse,
      isLoading: false,
    });
    mockGetMemoryCategoriesAdminQuery.mockReturnValue({
      data: adminCategories,
    });
    makeUnwrap(mockDeleteMentorMemory);
    makeUnwrap(mockUpdateMentorMemory);
    makeUnwrap(mockCreateMentorMemory);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders header, search and memories flattened from the response', () => {
    render(<MemoryMenu {...defaultProps} />);

    expect(screen.getByText('Your Memory')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search memories...'),
    ).toBeInTheDocument();
    expect(screen.getByText('Likes tea')).toBeInTheDocument();
    expect(screen.getByText('Prefers async standups')).toBeInTheDocument();
  });

  it('shows the student-specific subtitle when useUserIsStudent returns true', () => {
    mockUserIsStudent.mockReturnValue(true);
    render(<MemoryMenu {...defaultProps} />);

    expect(
      screen.getByText('Your saved memories for this mentor'),
    ).toBeInTheDocument();
  });

  it('shows a loading spinner while memories are loading', () => {
    mockGetMentorMemoriesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<MemoryMenu {...defaultProps} />);

    // Loader2 from lucide-react renders as an svg inside the scrolling area.
    expect(screen.queryByText('No memories yet.')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no memories', () => {
    mockGetMentorMemoriesQuery.mockReturnValue({ data: [], isLoading: false });
    render(<MemoryMenu {...defaultProps} />);

    expect(screen.getByText('No memories yet.')).toBeInTheDocument();
  });

  it('shows the search-empty state when the filter matches nothing', () => {
    render(<MemoryMenu {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('Search memories...'), {
      target: { value: 'zzzzz' },
    });
    expect(
      screen.getByText('No memories found matching your search.'),
    ).toBeInTheDocument();
  });

  it('filters memories by content and by category name', () => {
    render(<MemoryMenu {...defaultProps} />);

    const search = screen.getByPlaceholderText('Search memories...');

    fireEvent.change(search, { target: { value: 'hiking' } });
    expect(screen.getByText('Loves hiking')).toBeInTheDocument();
    expect(
      screen.queryByText('Prefers async standups'),
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'work' } });
    expect(screen.getByText('Prefers async standups')).toBeInTheDocument();
  });

  it('calls onClose when the header X button is clicked', () => {
    const onClose = vi.fn();
    render(<MemoryMenu {...defaultProps} onClose={onClose} />);

    // The second icon button in the header is the close X.
    const headerButtons = screen
      .getByText('Your Memory')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(headerButtons[1]!);

    expect(onClose).toHaveBeenCalled();
  });

  it('opens the add-memory form and creates a new memory', async () => {
    render(<MemoryMenu {...defaultProps} />);

    // First header icon button is Plus (add)
    const headerButtons = screen
      .getByText('Your Memory')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(headerButtons[0]!);

    expect(screen.getByText('Add New Memory')).toBeInTheDocument();

    const contentArea = screen.getByPlaceholderText('Memory content...');
    fireEvent.change(contentArea, { target: { value: 'Prefers SSH' } });

    // Pick a category
    const select = screen.getAllByTestId('select-native')[0]!;
    fireEvent.change(select, { target: { value: 'work' } });

    // Click save (first Save button in the form)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateMentorMemory).toHaveBeenCalledWith({
        org: 'org-1',
        userId: 'alice',
        mentorId: 'mentor-1',
        data: { category_slug: 'work', content: 'Prefers SSH' },
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Memory created');
  });

  it('falls back to the general slug when no category picked', async () => {
    render(<MemoryMenu {...defaultProps} />);

    const headerButtons = screen
      .getByText('Your Memory')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(headerButtons[0]!);

    fireEvent.change(screen.getByPlaceholderText('Memory content...'), {
      target: { value: 'default cat test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateMentorMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { category_slug: 'general', content: 'default cat test' },
        }),
      );
    });
  });

  it('disables save when content is blank and cancels the add form', () => {
    render(<MemoryMenu {...defaultProps} />);

    const headerButtons = screen
      .getByText('Your Memory')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(headerButtons[0]!);

    const saveBtn = screen.getByRole('button', {
      name: 'Save',
    }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    fireEvent.click(saveBtn);
    expect(mockCreateMentorMemory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Add New Memory')).not.toBeInTheDocument();
  });

  it('toasts an error when creation fails', async () => {
    makeRejectingUnwrap(mockCreateMentorMemory, new Error('boom'));
    render(<MemoryMenu {...defaultProps} />);

    const headerButtons = screen
      .getByText('Your Memory')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(headerButtons[0]!);

    fireEvent.change(screen.getByPlaceholderText('Memory content...'), {
      target: { value: 'will fail' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create memory');
    });
  });

  it('edits a memory and saves it with a changed category', async () => {
    render(<MemoryMenu {...defaultProps} />);

    const memoryCard = screen.getByText('Likes tea').closest('div')!
      .parentElement!.parentElement!;
    // Find the Edit3 icon button within this card — it's the first action button.
    const actionButtons = within(memoryCard).getAllByRole('button');
    fireEvent.click(actionButtons[0]!);

    const editArea = screen.getByPlaceholderText('Memory content...');
    fireEvent.change(editArea, { target: { value: 'Likes herbal tea' } });

    // Change category to work
    const select = screen.getAllByTestId('select-native')[0]!;
    fireEvent.change(select, { target: { value: 'work' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateMentorMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId: 10,
          data: expect.objectContaining({
            content: 'Likes herbal tea',
            category_slug: 'work',
          }),
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith('Memory updated');
  });

  it('omits category_slug when unchanged during an edit', async () => {
    render(<MemoryMenu {...defaultProps} />);

    const memoryCard = screen.getByText('Likes tea').closest('div')!
      .parentElement!.parentElement!;
    const actionButtons = within(memoryCard).getAllByRole('button');
    fireEvent.click(actionButtons[0]!);

    const editArea = screen.getByPlaceholderText('Memory content...');
    fireEvent.change(editArea, { target: { value: 'Likes strong tea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const call = mockUpdateMentorMemory.mock.calls[0]![0];
      expect(call.data.content).toBe('Likes strong tea');
      expect(call.data.category_slug).toBeUndefined();
    });
  });

  it('cancels an in-progress edit without mutating', () => {
    render(<MemoryMenu {...defaultProps} />);

    const memoryCard = screen.getByText('Likes tea').closest('div')!
      .parentElement!.parentElement!;
    fireEvent.click(within(memoryCard).getAllByRole('button')[0]!);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockUpdateMentorMemory).not.toHaveBeenCalled();
    expect(screen.getByText('Likes tea')).toBeInTheDocument();
  });

  it('toasts an error when edit fails', async () => {
    makeRejectingUnwrap(mockUpdateMentorMemory, new Error('nope'));
    render(<MemoryMenu {...defaultProps} />);

    const memoryCard = screen.getByText('Likes tea').closest('div')!
      .parentElement!.parentElement!;
    fireEvent.click(within(memoryCard).getAllByRole('button')[0]!);
    fireEvent.change(screen.getByPlaceholderText('Memory content...'), {
      target: { value: 'still tea' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update memory');
    });
  });

  it('deletes a memory and shows a success toast', async () => {
    render(<MemoryMenu {...defaultProps} />);

    const memoryCard = screen.getByText('Likes tea').closest('div')!
      .parentElement!.parentElement!;
    const actionButtons = within(memoryCard).getAllByRole('button');
    // Second action button is delete (Trash2)
    fireEvent.click(actionButtons[1]!);

    await waitFor(() => {
      expect(mockDeleteMentorMemory).toHaveBeenCalledWith({
        org: 'org-1',
        userId: 'alice',
        mentorId: 'mentor-1',
        memoryId: 10,
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Memory deleted');
  });

  it('toasts an error when delete fails', async () => {
    makeRejectingUnwrap(mockDeleteMentorMemory, new Error('nope'));
    render(<MemoryMenu {...defaultProps} />);

    const memoryCard = screen.getByText('Likes tea').closest('div')!
      .parentElement!.parentElement!;
    fireEvent.click(within(memoryCard).getAllByRole('button')[1]!);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to delete memory');
    });
  });

  it('toggles the "View All Memories" button when the list exceeds 4', () => {
    render(<MemoryMenu {...defaultProps} />);

    const viewAllBtn = screen.getByRole('button', {
      name: /view all memories \(5\)/i,
    });
    fireEvent.click(viewAllBtn);
    expect(
      screen.getByRole('button', { name: /show less/i }),
    ).toBeInTheDocument();
  });

  it('derives categories from the response when admin categories are empty', () => {
    mockGetMemoryCategoriesAdminQuery.mockReturnValue({ data: [] });
    render(<MemoryMenu {...defaultProps} />);

    // Open add form and check the category select still renders
    const headerButtons = screen
      .getByText('Your Memory')
      .parentElement!.querySelectorAll('button');
    fireEvent.click(headerButtons[0]!);
    expect(screen.getByText('Add New Memory')).toBeInTheDocument();
  });

  it('skips mentor memory query when tenantKey is missing', () => {
    render(<MemoryMenu onClose={vi.fn()} username="alice" />);

    const call = mockGetMentorMemoriesQuery.mock.calls[0]![1];
    expect(call.skip).toBe(true);
  });

  it('passes my_memory=true in params for students', () => {
    mockUserIsStudent.mockReturnValue(true);
    render(<MemoryMenu {...defaultProps} />);

    const call = mockGetMentorMemoriesQuery.mock.calls[0]![0];
    expect(call.params).toEqual({ my_memory: 'true' });
  });

  it('falls back to mentorId from params when useNavigate returns null', () => {
    mockGetMentorId.mockReturnValue(null);
    render(<MemoryMenu {...defaultProps} />);

    const call = mockGetMentorMemoriesQuery.mock.calls[0]![0];
    expect(call.mentorId).toBe('mentor-from-params');
  });

  it('falls back to the raw string when formatDistanceToNow throws on an invalid date', () => {
    mockGetMentorMemoriesQuery.mockReturnValue({
      data: [
        {
          category: { id: 5, name: 'Misc', slug: 'misc' },
          memories: [
            {
              id: 51,
              content: 'bad date memory',
              category: { id: 5, name: 'Misc', slug: 'misc' },
              created_at: 'not-a-real-date',
            },
          ],
        },
      ],
      isLoading: false,
    });
    render(<MemoryMenu {...defaultProps} />);
    expect(screen.getByText('bad date memory')).toBeInTheDocument();
    // The catch branch returns the raw string, so it must appear somewhere.
    expect(screen.getByText('not-a-real-date')).toBeInTheDocument();
  });

  it('renders a timestamp gracefully when created_at is missing or invalid', () => {
    mockGetMentorMemoriesQuery.mockReturnValue({
      data: [
        {
          category: { id: 99, name: 'Custom', slug: 'custom' },
          memories: [
            {
              id: 99,
              content: 'No date',
              category: { id: 99, name: 'Custom', slug: 'custom' },
            },
          ],
        },
      ],
      isLoading: false,
    });
    render(<MemoryMenu {...defaultProps} />);
    expect(screen.getByText('No date')).toBeInTheDocument();
  });
});
