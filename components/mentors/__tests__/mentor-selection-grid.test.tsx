import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

import { MentorSelectionGrid } from '@/components/mentors/mentor-selection-grid';

// Shared holders populated lazily (vi.mock factories are hoisted above imports).
const hoisted = vi.hoisted(() => ({
  hookReturn: undefined as any,
  itemsPerPageArg: undefined as unknown,
  paginationProps: undefined as any,
}));

// Mock the data hook so we fully control the component's inputs.
vi.mock('@/hooks/use-mentors', () => ({
  useMentorsWithPagination: (itemsPerPage?: number) => {
    hoisted.itemsPerPageArg = itemsPerPage;
    return hoisted.hookReturn;
  },
}));

// Stub the pagination child: capture the props it receives instead of
// rendering the real Radix pagination tree.
vi.mock('@/components/ibl-pagination', () => ({
  __esModule: true,
  default: (props: any) => {
    hoisted.paginationProps = props;
    return null;
  },
}));

const defaultMentors = [
  {
    unique_id: 'm1',
    name: 'Alpha',
    description: 'First agent',
    profile_image: 'https://example.com/alpha.png',
  },
  // No profile_image → exercises the '/placeholder.svg' fallback branch.
  { unique_id: 'm2', name: 'Beta', description: 'Second agent' },
];

let setSearchQuery: ReturnType<typeof vi.fn>;
let handlePageChange: ReturnType<typeof vi.fn>;
let onMentorSelect: ReturnType<typeof vi.fn>;
let onSearchChange: ReturnType<typeof vi.fn>;

function makeHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    mentors: defaultMentors,
    isLoading: false,
    isFetching: false,
    currentPage: 1,
    totalPages: 3,
    setSearchQuery,
    handlePageChange,
    ...overrides,
  };
}

function renderGrid(props: Record<string, unknown> = {}) {
  return render(
    <MentorSelectionGrid
      selectedMentorIds={[]}
      onMentorSelect={onMentorSelect}
      searchQuery=""
      onSearchChange={onSearchChange}
      {...props}
    />,
  );
}

describe('MentorSelectionGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchQuery = vi.fn();
    handlePageChange = vi.fn();
    onMentorSelect = vi.fn();
    onSearchChange = vi.fn();
    hoisted.paginationProps = undefined;
    hoisted.itemsPerPageArg = undefined;
    hoisted.hookReturn = makeHookReturn();
  });

  it('renders the search box with the Search icon (not fetching) by default', () => {
    renderGrid();
    expect(screen.getByPlaceholderText('Search Agents')).toBeInTheDocument();
    // The fetching spinner is the non-fetching branch's counterpart — absent here.
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });

  it('shows the spinner inside the search box while fetching', () => {
    hoisted.hookReturn = makeHookReturn({ isFetching: true });
    renderGrid();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('hides the search box when showSearch is false', () => {
    renderGrid({ showSearch: false });
    expect(
      screen.queryByPlaceholderText('Search Agents'),
    ).not.toBeInTheDocument();
  });

  it('forwards the configured itemsPerPage to the data hook', () => {
    renderGrid({ itemsPerPage: 12 });
    expect(hoisted.itemsPerPageArg).toBe(12);
  });

  it('renders the loading state while mentors load', () => {
    hoisted.hookReturn = makeHookReturn({ isLoading: true });
    renderGrid();
    expect(screen.getByText('Loading agents...')).toBeInTheDocument();
  });

  it('renders the empty state when there are no mentors', () => {
    hoisted.hookReturn = makeHookReturn({ mentors: [] });
    renderGrid();
    expect(
      screen.getByText('No agents found matching your search.'),
    ).toBeInTheDocument();
  });

  it('renders one accessible button per mentor, unpressed by default', () => {
    renderGrid();
    const alpha = screen.getByRole('button', { name: 'Select agent Alpha' });
    const beta = screen.getByRole('button', { name: 'Select agent Beta' });
    expect(alpha).toHaveAttribute('aria-pressed', 'false');
    expect(beta).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks a selected mentor with aria-pressed="true"', () => {
    renderGrid({ selectedMentorIds: ['m1'] });
    expect(
      screen.getByRole('button', { name: 'Select agent Alpha' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Select agent Beta' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onMentorSelect with the mentor when its button is clicked', () => {
    renderGrid();
    fireEvent.click(screen.getByRole('button', { name: 'Select agent Beta' }));
    expect(onMentorSelect).toHaveBeenCalledTimes(1);
    expect(onMentorSelect).toHaveBeenCalledWith(
      expect.objectContaining({ unique_id: 'm2', name: 'Beta' }),
    );
  });

  it('calls onSearchChange when the user types in the search box', () => {
    renderGrid();
    fireEvent.change(screen.getByPlaceholderText('Search Agents'), {
      target: { value: 'design' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('design');
  });

  it('syncs the search query into the data hook on mount and on change', () => {
    const { rerender } = renderGrid({ searchQuery: 'hello' });
    expect(setSearchQuery).toHaveBeenCalledWith('hello');

    rerender(
      <MentorSelectionGrid
        selectedMentorIds={[]}
        onMentorSelect={onMentorSelect}
        searchQuery="world"
        onSearchChange={onSearchChange}
      />,
    );
    expect(setSearchQuery).toHaveBeenCalledWith('world');
  });

  it('passes pagination state down and forwards page changes', () => {
    hoisted.hookReturn = makeHookReturn({ currentPage: 2, totalPages: 5 });
    renderGrid();

    expect(hoisted.paginationProps.currentPage).toBe(2);
    expect(hoisted.paginationProps.totalPages).toBe(5);
    expect(hoisted.paginationProps.disabled).toBe(false);

    act(() => hoisted.paginationProps.onPageChange(3));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('disables pagination while data is loading or fetching', () => {
    hoisted.hookReturn = makeHookReturn({ isFetching: true });
    renderGrid();
    expect(hoisted.paginationProps.disabled).toBe(true);
  });

  it('handles a mentor that has no unique_id and no profile_image', () => {
    hoisted.hookReturn = makeHookReturn({
      mentors: [{ name: 'Gamma', description: 'no id, no image' }],
    });
    renderGrid();

    const gamma = screen.getByRole('button', { name: 'Select agent Gamma' });
    // unique_id falls back to '' which is not in selectedMentorIds → unpressed.
    expect(gamma).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(gamma);
    expect(onMentorSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Gamma' }),
    );
  });
});
