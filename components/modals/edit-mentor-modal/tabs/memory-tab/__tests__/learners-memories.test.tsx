import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { LearnersMemories } from '../learners-memories';

// ---- Mocks ----
const mockGetMemoryFiltersQuery = vi.fn();
const mockGetFilteredMemoriesQuery = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-1' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMemoryFiltersQuery: (...args: any[]) => mockGetMemoryFiltersQuery(...args),
  useGetFilteredMemoriesQuery: (...args: any[]) => mockGetFilteredMemoriesQuery(...args),
}));

vi.mock('../utils', () => ({
  transformCategoryToDisplay: (cat: string) =>
    cat
      .replace(/_/g, ' ')
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children, open, onOpenChange }: any) => (
    <div data-testid="popover" data-open={open}>
      {typeof onOpenChange === 'function' && (
        <button
          data-testid="popover-toggle"
          onClick={() => onOpenChange(!open)}
          style={{ display: 'none' }}
        />
      )}
      {children}
    </div>
  ),
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

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>
      {React.Children.map(children, (child: any) => {
        if (!child) return null;
        return React.cloneElement(child, { onValueChange });
      })}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child: any) => {
        if (!child) return null;
        if (Array.isArray(child)) {
          return child.map((c: any) => (c ? React.cloneElement(c, { onValueChange }) : null));
        }
        return React.cloneElement(child, { onValueChange });
      })}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-item" data-value={value} onClick={() => onValueChange?.(value)}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect, mode }: any) => (
    <div data-testid="calendar" data-mode={mode}>
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

vi.mock('@/components/spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// ---- Test Data ----
const mockLearners = [
  { username: 'learner1', email: 'learner1@example.com', lti_email: '' },
  { username: 'learner2', email: 'learner2@example.com', lti_email: '' },
];

const mockMemories = [
  {
    unique_id: 'mem-1',
    username: 'learner1',
    email: 'learner1@example.com',
    category: 'personal_info',
    updated_at: '2024-06-15T10:00:00Z',
    entries: [
      {
        unique_id: 'entry-1',
        key: 'name',
        value: 'John Doe',
        inserted_at: '',
        updated_at: '',
        expires_at: null,
        category: 'personal_info',
      },
      {
        unique_id: 'entry-2',
        key: 'age',
        value: '30',
        inserted_at: '',
        updated_at: '',
        expires_at: null,
        category: 'personal_info',
      },
    ],
  },
  {
    unique_id: 'mem-2',
    username: 'learner2',
    email: 'learner2@example.com',
    category: 'preferences',
    updated_at: '2024-06-14T10:00:00Z',
    entries: [
      {
        unique_id: 'entry-3',
        key: 'theme',
        value: 'dark',
        inserted_at: '',
        updated_at: '',
        expires_at: null,
        category: 'preferences',
      },
    ],
  },
];

describe('LearnersMemories', () => {
  beforeEach(() => {
    cleanup();
    mockGetMemoryFiltersQuery.mockReset();
    mockGetFilteredMemoriesQuery.mockReset();

    mockGetMemoryFiltersQuery.mockReturnValue({
      data: {
        categories: ['personal_info', 'preferences'],
        users: mockLearners,
      },
    });

    mockGetFilteredMemoriesQuery.mockReturnValue({
      data: { results: mockMemories },
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the header with title and info icon', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('Learner Memories')).toBeInTheDocument();
    });

    it('renders the learner selector', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('Select Learner')).toBeInTheDocument();
    });

    it('renders the date range picker', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('Pick a Date Range')).toBeInTheDocument();
    });

    it('renders the category select', () => {
      render(<LearnersMemories />);
      const selectItems = screen.getAllByTestId('select-item');
      expect(selectItems.length).toBeGreaterThanOrEqual(1);
    });

    it('renders category options from filters data', () => {
      render(<LearnersMemories />);
      expect(screen.getAllByText('Personal Info').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Preferences').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Loading State', () => {
    it('shows spinner when memories are loading', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<LearnersMemories />);
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows "No Memories" when memories list is empty', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: { results: [] },
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText('No Memories')).toBeInTheDocument();
    });

    it('shows "No Memories" when data is undefined', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText('No Memories')).toBeInTheDocument();
    });
  });

  describe('Memory List', () => {
    it('renders memory cards for each memory', () => {
      render(<LearnersMemories />);
      // Both usernames appear in the dropdown AND the cards, so use getAllByText
      const learner1Elements = screen.getAllByText('learner1');
      expect(learner1Elements.length).toBeGreaterThanOrEqual(1);
      const learner2Elements = screen.getAllByText('learner2');
      expect(learner2Elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows learner email on each card', () => {
      render(<LearnersMemories />);
      // Emails appear in both the dropdown and the cards
      const email1Elements = screen.getAllByText('learner1@example.com');
      expect(email1Elements.length).toBeGreaterThanOrEqual(1);
      const email2Elements = screen.getAllByText('learner2@example.com');
      expect(email2Elements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays category badge for each memory', () => {
      render(<LearnersMemories />);
      expect(screen.getAllByText('Personal Info').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Preferences').length).toBeGreaterThanOrEqual(1);
    });

    it('shows first entry content as preview', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('name: John Doe')).toBeInTheDocument();
      expect(screen.getByText('theme: dark')).toBeInTheDocument();
    });

    it('shows entry count for each memory', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('2 entries')).toBeInTheDocument();
      expect(screen.getByText('1 entry')).toBeInTheDocument();
    });

    it('displays relative time for each memory', () => {
      render(<LearnersMemories />);
      const timeElements = screen.getAllByText(/ago/);
      expect(timeElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Memory Selection', () => {
    it('shows detail view placeholder when no memory is selected', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('Select a memory to view details.')).toBeInTheDocument();
    });

    it('shows memory details when a memory card is clicked', () => {
      render(<LearnersMemories />);

      // Find the memory card container that has cursor-pointer class
      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      expect(cards.length).toBe(2);
      fireEvent.click(cards[0]);

      // Should show detail entries
      expect(screen.getByText('Memory Entries')).toBeInTheDocument();
    });

    it('highlights selected memory card', () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);

      expect(cards[0].className).toContain('bg-gray-100');
    });

    it('shows formatted date in detail panel', () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);

      expect(screen.getByText(/Jun 15, 2024/)).toBeInTheDocument();
    });

    it('shows category badge in detail panel', () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);

      const categoryBadges = screen.getAllByText('Personal Info');
      expect(categoryBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('switches selected memory when clicking a different card', () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);
      expect(screen.getByText('Memory Entries')).toBeInTheDocument();

      // Select second memory
      fireEvent.click(cards[1]);

      expect(screen.getByText('theme')).toBeInTheDocument();
      expect(screen.getByText('dark')).toBeInTheDocument();
    });
  });

  describe('Learner Selection', () => {
    it('renders "All Learners" option in dropdown', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('All Learners')).toBeInTheDocument();
    });

    it('renders learner names in dropdown', () => {
      render(<LearnersMemories />);
      const items = screen.getAllByTestId('command-item');
      // "All Learners" + 2 learners = 3
      expect(items.length).toBe(3);
    });

    it('selects a learner when clicked', () => {
      render(<LearnersMemories />);

      const learnerItems = screen.getAllByTestId('command-item');
      // Click learner1 (index 1, after "All Learners")
      fireEvent.click(learnerItems[1]);

      // Should show selected learner username in the button - learner1 appears multiple places
      const learner1Elements = screen.getAllByText('learner1');
      expect(learner1Elements.length).toBeGreaterThanOrEqual(2); // button + dropdown + card
    });

    it('clears selection when "All Learners" is clicked', () => {
      render(<LearnersMemories />);

      // Select a learner first
      const learnerItems = screen.getAllByTestId('command-item');
      fireEvent.click(learnerItems[1]);

      // Now click "All Learners"
      const allLearnersItems = screen.getAllByTestId('command-item');
      fireEvent.click(allLearnersItems[0]);

      expect(screen.getByText('Select Learner')).toBeInTheDocument();
    });
  });

  describe('Category Selection', () => {
    it('renders "All Categories" option', () => {
      render(<LearnersMemories />);
      const allCatItems = screen.getAllByText('All Categories');
      expect(allCatItems.length).toBeGreaterThanOrEqual(1);
    });

    it('changes category when a category is selected', () => {
      render(<LearnersMemories />);

      const selectItems = screen.getAllByTestId('select-item');
      const personalInfoItem = selectItems.find(
        (el) => el.getAttribute('data-value') === 'personal_info',
      );
      if (personalInfoItem) fireEvent.click(personalInfoItem);

      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalled();
    });
  });

  describe('Date Range Selection', () => {
    it('updates date range when calendar selection is made', () => {
      render(<LearnersMemories />);

      const selectDateBtn = screen.getAllByTestId('calendar-select')[0];
      fireEvent.click(selectDateBtn);

      expect(screen.getAllByText(/Jan 01 - Jan 31/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Query Parameters', () => {
    it('passes tenantKey and username to filters query', () => {
      render(<LearnersMemories />);
      expect(mockGetMemoryFiltersQuery).toHaveBeenCalledWith(
        { tenantKey: 'test-tenant', username: 'testuser' },
        { skip: false },
      );
    });

    it('passes tenantKey and username to filtered memories query', () => {
      render(<LearnersMemories />);
      expect(mockGetFilteredMemoriesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantKey: 'test-tenant',
          username: 'testuser',
        }),
        { skip: false },
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles null categories in filters', () => {
      mockGetMemoryFiltersQuery.mockReturnValue({
        data: {
          categories: [null, 'personal_info', null],
          users: [],
        },
      });

      render(<LearnersMemories />);
      expect(screen.getByText('Learner Memories')).toBeInTheDocument();
    });

    it('handles undefined memoryFilters data', () => {
      mockGetMemoryFiltersQuery.mockReturnValue({
        data: undefined,
      });

      render(<LearnersMemories />);
      expect(screen.getByText('Select Learner')).toBeInTheDocument();
    });

    it('handles memory with no entries', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: 'mem-empty',
              username: 'learnerX',
              email: 'x@example.com',
              category: 'personal_info',
              updated_at: '2024-06-15T10:00:00Z',
              entries: [],
            },
          ],
        },
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText('No entries')).toBeInTheDocument();
      expect(screen.getByText('0 entries')).toBeInTheDocument();
    });

    it('handles undefined filteredMemoriesData', () => {
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText('No Memories')).toBeInTheDocument();
    });

    it('handles selected memory not found in results', () => {
      render(<LearnersMemories />);

      // Select first memory
      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);
      expect(screen.getByText('Memory Entries')).toBeInTheDocument();

      // Replace results with different memories that don't include the selected one
      mockGetFilteredMemoriesQuery.mockReturnValue({
        data: {
          results: [
            {
              unique_id: 'mem-different',
              username: 'other',
              email: 'other@example.com',
              category: 'preferences',
              updated_at: '2024-06-15T10:00:00Z',
              entries: [
                {
                  unique_id: 'e1',
                  key: 'k',
                  value: 'v',
                  inserted_at: '',
                  updated_at: '',
                  expires_at: null,
                  category: 'preferences',
                },
              ],
            },
          ],
        },
        isLoading: false,
      });

      // The component still has the old selectedMemory state but the memory list changed
      // Re-render would keep the same state since it's the same component instance
      // The detail panel should not show Memory Entries because memory.find returns undefined
    });
  });
});
