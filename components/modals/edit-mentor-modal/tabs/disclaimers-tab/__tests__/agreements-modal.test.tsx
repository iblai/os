import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { AgreementsModal } from '../agreements-modal';

const mockUseGetDisclaimerAgreementsQuery = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetDisclaimerAgreementsQuery: (...args: unknown[]) =>
    mockUseGetDisclaimerAgreementsQuery(...args),
}));

// Debounce is a pass-through so typing reaches the query synchronously; the
// 300ms delay itself belongs to `use-debounce`, not to this component.
vi.mock('use-debounce', () => ({
  useDebounce: (value: string) => [value],
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));

// Every committed render's page, in order. RTK Query only fires requests from
// effects, so a page that never reaches a commit never reaches the network.
const committedPages: number[] = [];

vi.mock('@/components/ibl-pagination', () => {
  function MockPagination({
    currentPage,
    totalPages,
    onPageChange,
    disabled,
  }: any) {
    React.useEffect(() => {
      committedPages.push(currentPage);
    });
    return totalPages > 1 ? (
      <div data-testid="pagination" data-disabled={String(disabled)}>
        <span data-testid="current-page">{currentPage}</span>
        <button onClick={() => onPageChange(currentPage + 1)}>next</button>
      </div>
    ) : null;
  }
  return { default: MockPagination };
});

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  org: 'test-tenant',
  userId: 'admin',
  mentorId: 'test-mentor',
  disclaimerId: '7',
};

const agreement = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  user: 10,
  user_id: 'alice',
  user_full_name: 'Alice Anderson',
  user_email: 'alice@example.com',
  disclaimer: 7,
  agreed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  platform_key: 'test-tenant',
  ...overrides,
});

function lastQueryArgs() {
  return mockUseGetDisclaimerAgreementsQuery.mock.calls.at(-1)![0] as {
    org: string;
    userId: string;
    params: Record<string, unknown>;
  };
}

describe('AgreementsModal', () => {
  beforeEach(() => {
    cleanup();
    committedPages.length = 0;
    mockUseGetDisclaimerAgreementsQuery.mockReset();
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: { count: 0, next: null, previous: null, results: [] },
      isLoading: false,
      isFetching: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('queries the agreements scoped to the org, user, mentor and disclaimer', () => {
    render(<AgreementsModal {...baseProps} />);
    expect(lastQueryArgs()).toEqual({
      org: 'test-tenant',
      userId: 'admin',
      params: {
        disclaimer: '7',
        mentor_id: 'test-mentor',
        username: undefined,
        page: 1,
        page_size: 20,
      },
    });
  });

  it('renders nothing while closed', () => {
    render(<AgreementsModal {...baseProps} open={false} />);
    expect(
      screen.queryByTestId('disclaimer-agreements'),
    ).not.toBeInTheDocument();
    expect(mockUseGetDisclaimerAgreementsQuery).not.toHaveBeenCalled();
  });

  it('starts clean -- page 1, empty search -- when reopened', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: { count: 45, next: 'x', previous: null, results: [agreement()] },
      isLoading: false,
      isFetching: false,
    });
    const { rerender } = render(<AgreementsModal {...baseProps} />);

    fireEvent.click(screen.getByText('next'));
    fireEvent.change(screen.getByTestId('disclaimer-agreements-search'), {
      target: { value: 'ali' },
    });
    fireEvent.click(screen.getByText('next'));
    expect(lastQueryArgs().params).toMatchObject({ username: 'ali', page: 2 });

    rerender(<AgreementsModal {...baseProps} open={false} />);
    rerender(<AgreementsModal {...baseProps} />);

    expect(lastQueryArgs().params).toMatchObject({
      username: undefined,
      page: 1,
    });
    expect(screen.getByTestId('disclaimer-agreements-search')).toHaveValue('');
  });

  it('always refetches on mount so agreements made in other clients show up', () => {
    render(<AgreementsModal {...baseProps} />);
    expect(mockUseGetDisclaimerAgreementsQuery.mock.calls.at(-1)![1]).toEqual({
      refetchOnMountOrArgChange: true,
    });
  });

  it('shows a loading skeleton while the first page loads', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
    });
    render(<AgreementsModal {...baseProps} />);
    expect(
      screen.getByTestId('disclaimer-agreements-loading'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('disclaimer-agreements-empty'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('disclaimer-agreements-count')).toHaveTextContent(
      '0 Total Agreements',
    );
  });

  it('renders the empty state when no one has agreed', () => {
    render(<AgreementsModal {...baseProps} />);
    expect(screen.getByTestId('disclaimer-agreements')).toBeInTheDocument();
    const empty = screen.getByTestId('disclaimer-agreements-empty');
    expect(empty).toHaveTextContent('No agreements yet');
    expect(empty).toHaveTextContent(
      'Users who accept the User Agreement will appear here with the time they agreed.',
    );
    expect(
      screen.getByTestId('disclaimer-agreements-banner'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('disclaimer-agreement-row'),
    ).not.toBeInTheDocument();
  });

  it('renders a row per agreement with the username and relative time', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          agreement(),
          agreement({
            id: 2,
            user_id: 'bob',
            agreed_at: new Date(
              Date.now() - 3 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        ],
      },
      isLoading: false,
      isFetching: false,
    });
    render(<AgreementsModal {...baseProps} />);

    const rows = screen.getAllByTestId('disclaimer-agreement-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-username', 'alice');
    expect(rows[0]).toHaveTextContent('Alice Anderson');
    expect(rows[0]).toHaveTextContent('about 2 hours ago');
    expect(rows[1]).toHaveAttribute('data-username', 'bob');
    expect(rows[1]).toHaveTextContent('3 days ago');
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Agreed at')).toBeInTheDocument();
  });

  it('shows a title-only header and the summary card above the search', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: { count: 1, next: null, previous: null, results: [agreement()] },
      isLoading: false,
      isFetching: false,
    });
    render(<AgreementsModal {...baseProps} />);
    const dialog = screen.getByRole('dialog', { name: 'Agreements' });
    // Header carries the title only; the count lives in the summary card.
    const header = dialog.querySelector('h2')!.parentElement!;
    expect(header).not.toContainElement(
      screen.getByTestId('disclaimer-agreements-count'),
    );
    const summary = screen.getByTestId('disclaimer-agreements-summary');
    expect(summary).toContainElement(
      screen.getByTestId('disclaimer-agreements-count'),
    );
    expect(screen.getByTestId('disclaimer-agreements-count')).toHaveTextContent(
      '1 Total Agreements',
    );
    const banner = screen.getByTestId('disclaimer-agreements-banner');
    expect(summary).toContainElement(banner);
    expect(banner).toHaveAttribute('role', 'note');
    expect(banner).toHaveTextContent(
      "Review the users who have accepted this agent's User Agreement. Each entry shows the user's name, email and when they agreed. Users who haven't accepted yet aren't listed. Search matches the exact username.",
    );
    // Summary card is the first thing in the body, directly above the search.
    expect(summary.previousElementSibling).toBeNull();
    expect(
      summary.nextElementSibling!.contains(
        screen.getByTestId('disclaimer-agreements-search'),
      ),
    ).toBe(true);
    expect(screen.getAllByTestId('disclaimer-agreement-row')).toHaveLength(1);
  });

  describe('User cell', () => {
    function renderRow(overrides: Partial<Record<string, unknown>>) {
      mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [agreement(overrides)],
        },
        isLoading: false,
        isFetching: false,
      });
      render(<AgreementsModal {...baseProps} />);
      return screen.getByTestId('disclaimer-agreement-row');
    }

    it('shows the full name with the email beneath it', () => {
      const row = renderRow({});
      const userCell = row.querySelector('td')!;
      expect(userCell.children).toHaveLength(2);
      expect(screen.getByTestId('disclaimer-agreement-user')).toHaveTextContent(
        'Alice Anderson',
      );
      expect(userCell.textContent).toBe('Alice Andersonalice@example.com');
    });

    it('falls back to the username as primary when the name is null', () => {
      const row = renderRow({ user_full_name: null });
      expect(screen.getByTestId('disclaimer-agreement-user')).toHaveTextContent(
        'alice',
      );
      expect(row).toHaveTextContent('alice@example.com');
    });

    it('shows the username as secondary when the email is null but the name is present', () => {
      const row = renderRow({ user_email: null });
      expect(screen.getByTestId('disclaimer-agreement-user')).toHaveTextContent(
        'Alice Anderson',
      );
      expect(row).toHaveTextContent('alice');
    });

    it('prints the username once, with no secondary line, when both are null', () => {
      const row = renderRow({ user_full_name: null, user_email: '' });
      const userCell = row.querySelector('td')!;
      expect(userCell.children).toHaveLength(1);
      expect(screen.getByTestId('disclaimer-agreement-user')).toHaveTextContent(
        'alice',
      );
      expect(userCell.textContent).toBe('alice');
    });
  });

  it('shows the absolute timestamp in the tooltip', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [agreement({ agreed_at: '2024-03-05T14:30:00.000Z' })],
      },
      isLoading: false,
      isFetching: false,
    });
    render(<AgreementsModal {...baseProps} />);
    // Rendered in the local timezone; only pin the date part to stay TZ-agnostic.
    expect(screen.getByText(/Mar 05, 2024 at/)).toBeInTheDocument();
  });

  it('shows the agreed count badge', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: { count: 42, next: 'x', previous: null, results: [agreement()] },
      isLoading: false,
      isFetching: false,
    });
    render(<AgreementsModal {...baseProps} />);
    expect(screen.getByTestId('disclaimer-agreements-count')).toHaveTextContent(
      '42 Total Agreements',
    );
  });

  it('passes the search term as the username filter', () => {
    render(<AgreementsModal {...baseProps} />);
    fireEvent.change(screen.getByTestId('disclaimer-agreements-search'), {
      target: { value: 'ali' },
    });
    expect(lastQueryArgs().params.username).toBe('ali');
  });

  it('shows the no-matches copy when a search returns nothing', () => {
    render(<AgreementsModal {...baseProps} />);
    fireEvent.change(screen.getByTestId('disclaimer-agreements-search'), {
      target: { value: 'nobody' },
    });
    const empty = screen.getByTestId('disclaimer-agreements-empty');
    expect(empty).toHaveTextContent('No users match your search');
    expect(empty).toHaveTextContent(
      'Search matches the exact username — try the full username.',
    );
    // The search miss swaps the Users icon for the Search icon.
    expect(empty.querySelector('svg.lucide-search')).not.toBeNull();
    expect(empty.querySelector('svg.lucide-users')).toBeNull();
    expect(
      screen.getByTestId('disclaimer-agreements-banner'),
    ).toBeInTheDocument();
  });

  it('paginates with page_size 20 and resets to page 1 on a new search', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: { count: 45, next: 'x', previous: null, results: [agreement()] },
      isLoading: false,
      isFetching: false,
    });
    render(<AgreementsModal {...baseProps} />);

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    fireEvent.click(screen.getByText('next'));
    expect(screen.getByTestId('current-page')).toHaveTextContent('2');
    expect(lastQueryArgs().params.page).toBe(2);

    fireEvent.change(screen.getByTestId('disclaimer-agreements-search'), {
      target: { value: 'ali' },
    });
    expect(lastQueryArgs().params).toMatchObject({ username: 'ali', page: 1 });
  });

  it('never commits (so never fetches) the new search term with the old page', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: { count: 45, next: 'x', previous: null, results: [agreement()] },
      isLoading: false,
      isFetching: false,
    });
    render(<AgreementsModal {...baseProps} />);
    fireEvent.click(screen.getByText('next'));
    expect(committedPages).toEqual([1, 2]);

    fireEvent.change(screen.getByTestId('disclaimer-agreements-search'), {
      target: { value: 'ali' },
    });
    // An effect-based reset would commit page 2 with the new term first.
    expect(committedPages).toEqual([1, 2, 1]);
  });

  it('disables pagination while a page is being fetched', () => {
    mockUseGetDisclaimerAgreementsQuery.mockReturnValue({
      data: { count: 45, next: 'x', previous: null, results: [agreement()] },
      isLoading: false,
      isFetching: true,
    });
    render(<AgreementsModal {...baseProps} />);
    expect(screen.getByTestId('pagination')).toHaveAttribute(
      'data-disabled',
      'true',
    );
  });
});
