import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

import { LearnersMemories } from '../learners-memories';

// ---- Query hook mocks ----
const mockGetMentorMemoriesQuery = vi.fn();
const mockGetMemoryCategoriesAdminQuery = vi.fn();

// `useParams` and `useUsername` and `useNavigate().getMentorId` are the three
// inputs that drive the component's mentor/tenant/user context. We expose
// overridable variables so individual tests can reshape them.
let mockTenantKey: string | undefined = 'test-tenant';
let mockMentorIdParam: string | undefined = 'mentor-1';
let mockUsername: string | null = 'testuser';
let mockGetMentorIdReturn: string | undefined = undefined;

vi.mock('next/navigation', () => ({
  useParams: () => ({
    tenantKey: mockTenantKey,
    mentorId: mockMentorIdParam,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorIdReturn,
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorMemoriesQuery: (...args: unknown[]) =>
    mockGetMentorMemoriesQuery(...args),
  useGetMemoryCategoriesAdminQuery: (...args: unknown[]) =>
    mockGetMemoryCategoriesAdminQuery(...args),
}));

// ---- UI primitive stubs ----
// Rather than mocking each shadcn component individually, we stub them to
// render their children directly. This preserves visible text and event
// wiring while keeping the test DOM small and assertable.
vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef(({ children, onClick, ...rest }: any, ref: any) => (
    <button ref={ref} onClick={onClick} {...rest}>
      {children}
    </button>
  )),
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
    <div data-testid="command-item" role="option" onClick={() => onSelect?.()}>
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

vi.mock('@/components/spinner', () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// ---- Test data ----
const mockCategory = (id: number, name: string, slug: string) => ({
  id,
  name,
  slug,
});

const mockMemory = (overrides: Partial<any> = {}) => ({
  id: overrides.id ?? 1,
  content: overrides.content ?? 'Memory content',
  category: overrides.category ?? mockCategory(1, 'Preferences', 'preferences'),
  username: overrides.username ?? 'alice',
  created_at: overrides.created_at ?? '2024-01-15T10:30:00.000Z',
});

const byCategoryResponse = (
  entries: Array<{
    category: { id: number; name: string; slug: string };
    memories: any[];
  }>,
) => entries;

const defaultResponse = byCategoryResponse([
  {
    category: mockCategory(1, 'Preferences', 'preferences'),
    memories: [
      mockMemory({
        id: 1,
        content: 'Loves dark mode',
        category: mockCategory(1, 'Preferences', 'preferences'),
        username: 'alice',
      }),
      mockMemory({
        id: 2,
        content: 'Prefers vim keybindings',
        category: mockCategory(1, 'Preferences', 'preferences'),
        username: 'bob',
      }),
    ],
  },
  {
    category: mockCategory(2, 'Background', 'background'),
    memories: [
      mockMemory({
        id: 3,
        content: 'Former backend dev',
        category: mockCategory(2, 'Background', 'background'),
        username: 'alice',
      }),
    ],
  },
]);

const defaultAdminCategories = [
  { id: 1, name: 'Preferences', slug: 'preferences' },
  { id: 2, name: 'Background', slug: 'background' },
  { id: 3, name: 'Goals', slug: 'goals' },
];

describe('LearnersMemories', () => {
  beforeEach(() => {
    cleanup();
    mockGetMentorMemoriesQuery.mockReset();
    mockGetMemoryCategoriesAdminQuery.mockReset();
    mockTenantKey = 'test-tenant';
    mockMentorIdParam = 'mentor-1';
    mockUsername = 'testuser';
    mockGetMentorIdReturn = undefined;

    mockGetMentorMemoriesQuery.mockReturnValue({
      data: defaultResponse,
      isLoading: false,
    });
    mockGetMemoryCategoriesAdminQuery.mockReturnValue({
      data: defaultAdminCategories,
    });
  });

  afterEach(() => cleanup());

  describe('Rendering', () => {
    it('renders the header with title and info icon', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('Learner Memories')).toBeInTheDocument();
    });

    it('renders the learner selector with default label', () => {
      render(<LearnersMemories />);
      // The learner trigger button carries role="combobox", whose accessible
      // name is derived from aria-label (not text content), so we assert the
      // label text directly and sanity-check that a combobox exists.
      expect(screen.getByText('Select Learner')).toBeInTheDocument();
      expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
    });

    it('renders the date range picker with default label', () => {
      render(<LearnersMemories />);
      expect(
        screen.getByRole('button', { name: /Pick a Date Range/i }),
      ).toBeInTheDocument();
    });

    it('renders the desktop category selector defaulting to "All"', () => {
      render(<LearnersMemories />);
      // The category button label starts at "All" on mount.
      const allButtons = screen.getAllByRole('button');
      const categoryButton = allButtons.find((b) =>
        /^All/.test(b.textContent ?? ''),
      );
      expect(categoryButton).toBeDefined();
    });

    it('renders category options from adminCategories data', () => {
      render(<LearnersMemories />);
      // Category command items include "All" + the 3 admin categories.
      const items = screen.getAllByTestId('command-item');
      const labels = items.map((el) => el.textContent);
      expect(labels.filter((l) => l?.includes('All')).length).toBeGreaterThan(
        0,
      );
      expect(labels.some((l) => l?.includes('Preferences'))).toBe(true);
      expect(labels.some((l) => l?.includes('Background'))).toBe(true);
      expect(labels.some((l) => l?.includes('Goals'))).toBe(true);
    });

    it('falls back to response-derived categories when adminCategories is empty', () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({ data: [] });
      render(<LearnersMemories />);
      const items = screen.getAllByTestId('command-item');
      const labels = items.map((el) => el.textContent);
      // Derived from the response's two category groups.
      expect(labels.some((l) => l?.includes('Preferences'))).toBe(true);
      expect(labels.some((l) => l?.includes('Background'))).toBe(true);
    });
  });

  describe('Loading state', () => {
    it('shows the spinner while memories are loading', () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      render(<LearnersMemories />);
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows "No Memories" when the response array is empty', () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });
      render(<LearnersMemories />);
      expect(screen.getByText('No Memories')).toBeInTheDocument();
    });

    it('shows "No Memories" when the response is undefined', () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      render(<LearnersMemories />);
      expect(screen.getByText('No Memories')).toBeInTheDocument();
    });
  });

  describe('Memory list rendering', () => {
    it('flattens memories from all category groups into individual cards', () => {
      render(<LearnersMemories />);
      expect(screen.getByText('Loves dark mode')).toBeInTheDocument();
      expect(screen.getByText('Prefers vim keybindings')).toBeInTheDocument();
      expect(screen.getByText('Former backend dev')).toBeInTheDocument();
    });

    it('shows the username on each memory card', () => {
      render(<LearnersMemories />);
      // Usernames appear in BOTH the memory cards and the learner-filter
      // popover command items, so we use getAllByText.
      expect(screen.getAllByText('alice').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('bob').length).toBeGreaterThanOrEqual(1);
    });

    it('renders "Unknown" when a memory has no username', () => {
      // Build the memory object directly rather than going through
      // `mockMemory`, because `??` in the helper would coerce `undefined`
      // back to the default 'alice'. The source falls through to 'Unknown'
      // via `memory.username || 'Unknown'`, which treats any falsy value
      // (undefined, null, empty string) the same way.
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: byCategoryResponse([
          {
            category: mockCategory(1, 'Preferences', 'preferences'),
            memories: [
              {
                id: 99,
                content: 'Anonymous memory',
                category: mockCategory(1, 'Preferences', 'preferences'),
                username: undefined,
                created_at: '2024-01-15T10:30:00.000Z',
              },
            ],
          },
        ]),
        isLoading: false,
      });
      render(<LearnersMemories />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders a category badge for each memory', () => {
      render(<LearnersMemories />);
      // Preferences badge appears on the two Preferences memories,
      // Background on the one Background memory. At least one of each.
      expect(screen.getAllByText('Preferences').length).toBeGreaterThanOrEqual(
        1,
      );
      expect(screen.getAllByText('Background').length).toBeGreaterThanOrEqual(
        1,
      );
    });
  });

  describe('Memory selection', () => {
    it('shows the placeholder when no memory is selected', () => {
      render(<LearnersMemories />);
      expect(
        screen.getByText('Select a memory to view details.'),
      ).toBeInTheDocument();
    });

    it('shows the detail panel with content when a memory card is clicked', () => {
      render(<LearnersMemories />);
      const card = screen.getByText('Loves dark mode').closest('div');
      expect(card).not.toBeNull();
      fireEvent.click(card!);

      // The "Memory Content" heading only appears in the detail panel.
      expect(screen.getByText('Memory Content')).toBeInTheDocument();
      // Placeholder should disappear.
      expect(
        screen.queryByText('Select a memory to view details.'),
      ).not.toBeInTheDocument();
    });

    it('switches the selected memory when a different card is clicked', () => {
      render(<LearnersMemories />);
      fireEvent.click(screen.getByText('Loves dark mode').closest('div')!);
      fireEvent.click(screen.getByText('Former backend dev').closest('div')!);

      // The detail panel should now reflect "Former backend dev" — which
      // means the content appears at least twice: once in the card list and
      // once in the detail panel.
      expect(
        screen.getAllByText('Former backend dev').length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Learner dropdown derivation', () => {
    it('derives unique learners from the unfiltered response', () => {
      render(<LearnersMemories />);
      // Click the "All Learners" command item would clear the selection.
      // Learner usernames appear in the popover's command items.
      const items = screen.getAllByTestId('command-item');
      const labels = items.map((el) => el.textContent ?? '');
      expect(labels.some((l) => l.includes('alice'))).toBe(true);
      expect(labels.some((l) => l.includes('bob'))).toBe(true);
    });

    it('deduplicates learners even if they appear in multiple memories', () => {
      render(<LearnersMemories />);
      const items = screen.getAllByTestId('command-item');
      const aliceItems = items.filter((el) =>
        el.textContent?.includes('alice'),
      );
      // alice should appear in exactly one learner option (even though
      // she has two memories in the response).
      expect(aliceItems.length).toBe(1);
    });
  });

  describe('Query skip logic', () => {
    it('passes skip=true to the memories query when tenantKey is missing', () => {
      mockTenantKey = undefined;
      render(<LearnersMemories />);
      // First call is the filtered memories query.
      const firstCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(firstCall[1]).toEqual(expect.objectContaining({ skip: true }));
    });

    it('passes skip=true to the memories query when username is missing', () => {
      mockUsername = null;
      render(<LearnersMemories />);
      const firstCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(firstCall[1]).toEqual(expect.objectContaining({ skip: true }));
    });

    it('passes skip=true to the memories query when no active mentor id can be resolved', () => {
      mockMentorIdParam = undefined;
      mockGetMentorIdReturn = undefined;
      render(<LearnersMemories />);
      const firstCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(firstCall[1]).toEqual(expect.objectContaining({ skip: true }));
    });

    it('passes skip=false when tenant, username, and mentor id are all present', () => {
      render(<LearnersMemories />);
      const firstCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(firstCall[1]).toEqual(expect.objectContaining({ skip: false }));
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from useNavigate over the URL mentorId', () => {
      mockGetMentorIdReturn = 'mentor-from-modal-stack';
      mockMentorIdParam = 'mentor-from-url';
      render(<LearnersMemories />);
      const firstCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(firstCall[0]).toEqual(
        expect.objectContaining({ mentorId: 'mentor-from-modal-stack' }),
      );
    });

    it('falls back to the URL mentorId when getMentorId() returns undefined', () => {
      mockGetMentorIdReturn = undefined;
      mockMentorIdParam = 'mentor-from-url';
      render(<LearnersMemories />);
      const firstCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(firstCall[0]).toEqual(
        expect.objectContaining({ mentorId: 'mentor-from-url' }),
      );
    });

    it('passes tenantKey and username straight through to the query', () => {
      mockTenantKey = 'some-tenant';
      mockUsername = 'some-user';
      render(<LearnersMemories />);
      const firstCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(firstCall[0]).toEqual(
        expect.objectContaining({
          org: 'some-tenant',
          userId: 'some-user',
        }),
      );
    });

    it('passes the same context to the admin-categories query', () => {
      render(<LearnersMemories />);
      const call = mockGetMemoryCategoriesAdminQuery.mock.calls[0];
      expect(call[0]).toEqual(
        expect.objectContaining({
          org: 'test-tenant',
          mentorId: 'mentor-1',
        }),
      );
    });
  });

  describe('Date range filter', () => {
    it('includes start_date and end_date in the query params once a range is picked', () => {
      render(<LearnersMemories />);

      // Initially no date params are sent.
      const initialCall = mockGetMentorMemoriesQuery.mock.calls[0];
      expect(initialCall[0]).not.toHaveProperty('params');

      // Trigger the calendar's onSelect.
      fireEvent.click(screen.getByTestId('calendar-select'));

      // The filtered query (the one passing `params`) should now include
      // start_date and end_date derived from the selected range.
      const calls = mockGetMentorMemoriesQuery.mock.calls;
      const lastWithParams = calls
        .map((c) => c[0])
        .reverse()
        .find((arg) => arg?.params);
      expect(lastWithParams?.params).toEqual(
        expect.objectContaining({
          start_date: expect.stringMatching(/^2024-01-01$/),
          end_date: expect.stringMatching(/^2024-01-31$/),
        }),
      );
    });
  });
});
