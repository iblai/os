import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { HistoryTab } from '../history-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockUsername = vi.fn();
const mockUseIsMobile = vi.fn();

const mockUseHistoryWithPagination = vi.fn();
const mockUseExportChatHistory = vi.fn();
const mockHandleExport = vi.fn();
const mockHandlePageChange = vi.fn();
const mockSetFilters = vi.fn();

const mockGetMentorPublicSettingsQuery = vi.fn();
const mockGetMentorSummariesQuery = vi.fn();
const mockGetConversationMemoriesQuery = vi.fn();

// next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// hooks
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('@/hooks/use-history', () => ({
  useHistoryWithPagination: () => mockUseHistoryWithPagination(),
}));

vi.mock('@/hooks/use-history/use-export-chat-history', () => ({
  useExportChatHistory: () => mockUseExportChatHistory(),
}));

// data-layer hooks
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorPublicSettingsQuery: (...args: unknown[]) =>
    mockGetMentorPublicSettingsQuery(...args),
  useGetMentorSummariesQuery: (...args: unknown[]) =>
    mockGetMentorSummariesQuery(...args),
  useGetConversationMemoriesQuery: (...args: unknown[]) =>
    mockGetConversationMemoriesQuery(...args),
}));

// Markdown – keep it simple so it doesn't drag in remark/rehype ESM.
vi.mock('@/components/markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

// IblPagination
vi.mock('@/components/ibl-pagination', () => ({
  default: ({ disableNumberedButtons, onPageChange }: any) => (
    <div
      data-testid="ibl-pagination"
      data-disable-numbered={String(disableNumberedButtons)}
    >
      <button onClick={() => onPageChange(2)}>go-page-2</button>
    </div>
  ),
}));

vi.mock('@/components/spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

// UI primitives – avoid Radix jsdom issues by rendering them inline.
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value}>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div
      role="option"
      aria-selected={false}
      data-value={value}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
  PopoverTrigger: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: (props: any) => (
    <input data-testid="command-input" {...props} />
  ),
  CommandItem: ({ children, value, onSelect }: any) => (
    <div
      role="option"
      aria-selected={false}
      data-value={value}
      onClick={() => onSelect?.(value)}
    >
      {children}
    </div>
  ),
  CommandList: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="preview-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: any) => (
    <button
      data-testid="calendar"
      onClick={() => onSelect?.({ from: new Date(), to: new Date() })}
    >
      calendar
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  textTruncate: (s: string, n: number) =>
    s.length > n ? s.slice(0, n) + '...' : s,
}));

// ============================================================================
// TEST DATA
// ============================================================================

const baseConversation = {
  id: 'conv-1',
  messages: [{ human: 'Hello there mentor', ai: 'Hi, how can I help?' }],
  topics: [{ name: 'general' }],
  sentiment: 'positive',
  mentor: 'm1',
  student: 's1',
  email: 'student@example.com',
  model: 'gpt',
  rating: 5,
  platform: 'web',
  lti_email: '',
  lti_username: '',
  inserted_at: '2024-01-01T10:00:00Z',
  memory_tracked: false,
};

function defaultHistory(overrides: Record<string, unknown> = {}) {
  return {
    chatHistory: { results: [baseConversation] },
    isChatHistoryLoading: false,
    isChatHistoryFetching: false,
    currentPage: 1,
    totalPages: 1,
    handlePageChange: mockHandlePageChange,
    chatHistoryFilter: {
      users: [{ username: 'jdoe', email: 'jdoe@example.com' }],
      topics: [{ name: 'general' }, { name: 'billing' }],
    },
    setFilters: mockSetFilters,
    filters: {},
    ...overrides,
  };
}

// ============================================================================
// SETUP
// ============================================================================

describe('HistoryTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    // default to desktop
    window.innerWidth = 1200;

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockUsername.mockReturnValue('testuser');
    mockUseIsMobile.mockReturnValue(false);

    mockHandleExport.mockReset();
    mockUseExportChatHistory.mockReturnValue({
      handleExport: mockHandleExport,
      isExporting: false,
    });

    mockUseHistoryWithPagination.mockReturnValue(defaultHistory());

    mockGetMentorPublicSettingsQuery.mockReturnValue({
      data: { enable_memory_component: true },
    });

    mockGetMentorSummariesQuery.mockReturnValue({
      data: {
        rating: 4.2,
        summary: 'This is a mentor summary.',
        tags: ['math', 'science'],
      },
      isLoading: false,
    });

    mockGetConversationMemoriesQuery.mockReturnValue({
      data: { entries: [] },
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Header / summaries
  // ==========================================================================
  it('renders the header', () => {
    render(<HistoryTab />);
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('shows a spinner while mentor summaries are loading', () => {
    mockGetMentorSummariesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<HistoryTab />);
    expect(screen.getAllByTestId('spinner').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the rating and summary when summaries are loaded', () => {
    render(<HistoryTab />);
    expect(screen.getByText('4.2 out of 5')).toBeInTheDocument();
    expect(screen.getByText('This is a mentor summary.')).toBeInTheDocument();
  });

  it('shows "Summary not available" when summary is absent', () => {
    mockGetMentorSummariesQuery.mockReturnValue({
      data: { rating: 0, summary: '', tags: [] },
      isLoading: false,
    });
    render(<HistoryTab />);
    expect(screen.getByText('Summary not available')).toBeInTheDocument();
  });

  it('renders topic tags when present', () => {
    render(<HistoryTab />);
    expect(screen.getByText('math')).toBeInTheDocument();
    expect(screen.getByText('science')).toBeInTheDocument();
  });

  it('does not render the tags box when there are no tags', () => {
    mockGetMentorSummariesQuery.mockReturnValue({
      data: { rating: 3, summary: 'x', tags: [] },
      isLoading: false,
    });
    render(<HistoryTab />);
    expect(screen.queryByText('math')).not.toBeInTheDocument();
  });

  // ==========================================================================
  // User search combobox
  // ==========================================================================
  it('renders the user list in the search combobox', () => {
    render(<HistoryTab />);
    expect(screen.getByText('jdoe@example.com')).toBeInTheDocument();
    expect(screen.getByText('All Users')).toBeInTheDocument();
  });

  it('shows the selected user email on the trigger when a user is filtered', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({ filters: { users: 'jdoe' } }),
    );
    render(<HistoryTab />);
    // appears on the trigger AND in the list
    expect(
      screen.getAllByText('jdoe@example.com').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('calls setFilters when selecting a user', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('jdoe@example.com'));
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ users: 'jdoe' }),
    );
  });

  it('calls setFilters with undefined users when selecting "All Users"', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('All Users'));
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ users: undefined }),
    );
  });

  // ==========================================================================
  // Sentiment & topic selects (both desktop + mobile rows in DOM)
  // ==========================================================================
  it('updates sentiment filter to a concrete value', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getAllByRole('option', { name: 'Positive' })[0]);
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ sentiment: 'positive' }),
    );
  });

  it('resets sentiment filter to empty when selecting "All Sentiments"', () => {
    render(<HistoryTab />);
    fireEvent.click(
      screen.getAllByRole('option', { name: 'All Sentiments' })[0],
    );
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ sentiment: '' }),
    );
  });

  it('updates topic filter to a concrete value', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getAllByRole('option', { name: 'billing' })[0]);
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ topics: 'billing' }),
    );
  });

  it('resets topic filter to empty when selecting "All Topics"', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getAllByRole('option', { name: 'All Topics' })[0]);
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ topics: '' }),
    );
  });

  // ==========================================================================
  // Date range
  // ==========================================================================
  it('renders a date range label when a range is set', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        filters: {
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-01-05'),
          },
        },
      }),
    );
    render(<HistoryTab />);
    expect(screen.getByText(/Jan 01 - Jan 0/)).toBeInTheDocument();
  });

  it('calls setFilters when a date range is selected', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getByTestId('calendar'));
    expect(mockSetFilters).toHaveBeenCalledWith(
      expect.objectContaining({ dateRange: expect.anything() }),
    );
  });

  // ==========================================================================
  // Export
  // ==========================================================================
  it('calls handleExport when Export is clicked', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(mockHandleExport).toHaveBeenCalled();
  });

  it('shows "Exporting..." while exporting', () => {
    mockUseExportChatHistory.mockReturnValue({
      handleExport: mockHandleExport,
      isExporting: true,
    });
    render(<HistoryTab />);
    expect(screen.getByText('Exporting...')).toBeInTheDocument();
  });

  // ==========================================================================
  // Chat history list
  // ==========================================================================
  it('shows "No conversations found" when there is no history', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({ chatHistory: { results: [] } }),
    );
    render(<HistoryTab />);
    expect(screen.getByText('No conversations found')).toBeInTheDocument();
  });

  it('shows a spinner while chat history is loading', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: { results: [] },
        isChatHistoryLoading: true,
      }),
    );
    render(<HistoryTab />);
    expect(screen.getAllByTestId('spinner').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a conversation row with email name and truncated preview', () => {
    render(<HistoryTab />);
    expect(screen.getByText('student@example.com')).toBeInTheDocument();
    expect(screen.getByText('Hello there mentor')).toBeInTheDocument();
  });

  it('falls back to lti_email then "Anonymous" name and message fallbacks', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: {
          results: [
            {
              ...baseConversation,
              id: 'conv-anon',
              email: '',
              lti_email: '',
              messages: [{ human: '', ai: '' }],
            },
          ],
        },
      }),
    );
    render(<HistoryTab />);
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(screen.getByText('No response available')).toBeInTheDocument();
  });

  it('uses lti_email when present', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: {
          results: [
            { ...baseConversation, id: 'conv-lti', lti_email: 'lti@x.com' },
          ],
        },
      }),
    );
    render(<HistoryTab />);
    expect(screen.getByText('lti@x.com')).toBeInTheDocument();
  });

  // ==========================================================================
  // Conversation selection / preview
  // ==========================================================================
  it('selects a conversation on desktop without opening the modal', () => {
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('Hello there mentor'));
    // right-column preview now shows the AI markdown + AI Agent label
    expect(screen.getAllByText('AI Agent').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('preview-dialog')).not.toBeInTheDocument();
  });

  it('opens the preview modal on mobile width', () => {
    window.innerWidth = 500;
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('Hello there mentor'));
    expect(screen.getByTestId('preview-dialog')).toBeInTheDocument();
  });

  it('renders the avatar initial fallback "A" for anonymous selected conversation', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: {
          results: [
            {
              ...baseConversation,
              id: 'conv-anon2',
              email: '',
              lti_email: '',
            },
          ],
        },
      }),
    );
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('Hello there mentor'));
    expect(screen.getAllByText('A').length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // Conversation memory
  // ==========================================================================
  it('toggles conversation memory and shows "No conversation memory available."', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: {
          results: [{ ...baseConversation, memory_tracked: true }],
        },
      }),
    );
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('Hello there mentor'));

    const toggle = screen.getByText('Show Conversation Memory');
    fireEvent.click(toggle);
    expect(
      screen.getByText('No conversation memory available.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Hide Conversation Memory')).toBeInTheDocument();
  });

  it('shows a spinner while conversation memory is loading', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: {
          results: [{ ...baseConversation, memory_tracked: true }],
        },
      }),
    );
    mockGetConversationMemoriesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('Hello there mentor'));
    fireEvent.click(screen.getByText('Show Conversation Memory'));
    expect(screen.getAllByTestId('spinner').length).toBeGreaterThanOrEqual(1);
  });

  it('renders memory entries when present', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: {
          results: [{ ...baseConversation, memory_tracked: true }],
        },
      }),
    );
    mockGetConversationMemoriesQuery.mockReturnValue({
      data: {
        entries: [{ key: 'Preference', value: 'Likes short answers' }],
      },
      isLoading: false,
    });
    render(<HistoryTab />);
    fireEvent.click(screen.getByText('Hello there mentor'));
    fireEvent.click(screen.getByText('Show Conversation Memory'));
    expect(screen.getByText('Preference')).toBeInTheDocument();
    expect(screen.getByText('Likes short answers')).toBeInTheDocument();
  });

  // ==========================================================================
  // Pagination
  // ==========================================================================
  it('renders IblPagination when totalPages > 1', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({ totalPages: 3 }),
    );
    render(<HistoryTab />);
    const pagination = screen.getByTestId('ibl-pagination');
    expect(pagination).toBeInTheDocument();
    expect(pagination).toHaveAttribute('data-disable-numbered', 'false');
    fireEvent.click(screen.getByText('go-page-2'));
    expect(mockHandlePageChange).toHaveBeenCalledWith(2);
  });

  it('passes disableNumberedButtons=true when on mobile', () => {
    mockUseIsMobile.mockReturnValue(true);
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({ totalPages: 3 }),
    );
    render(<HistoryTab />);
    expect(screen.getByTestId('ibl-pagination')).toHaveAttribute(
      'data-disable-numbered',
      'true',
    );
  });

  it('hides pagination when totalPages <= 1', () => {
    render(<HistoryTab />);
    expect(screen.queryByTestId('ibl-pagination')).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Edge: username fallback to anonymous
  // ==========================================================================
  it('falls back to ANONYMOUS_USERNAME for public settings when username is null', () => {
    mockUsername.mockReturnValue(null);
    render(<HistoryTab />);
    expect(mockGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'anonymous' }),
    );
  });
});
