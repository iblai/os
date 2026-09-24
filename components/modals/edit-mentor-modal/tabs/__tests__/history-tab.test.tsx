import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';

import {
  conversationDocuments,
  summarizeTranscriptTurns,
} from '@iblai/iblai-js/web-containers';

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

// The SDK identity helper, badges and per-turn details panel are exercised for
// real. Only the profile link is stubbed: the real one opens the shared
// Profile viewer (a whole redux-backed app surface, covered by the SDK's own
// tests), and here we only care that the tab hands it the right user.
vi.mock('@iblai/iblai-js/web-containers', async () => {
  const actual = await vi.importActual<
    typeof import('@iblai/iblai-js/web-containers')
  >('@iblai/iblai-js/web-containers');
  return {
    ...actual,
    RetrievedDocumentsButton: ({ documents, sessionId, label }: any) => (
      <button
        type="button"
        data-testid={
          documents
            ? 'retrieved-documents-button'
            : 'session-retrieved-documents-button'
        }
        data-session-id={sessionId ?? ''}
        data-document-count={documents ? String(documents.length) : ''}
      >
        {label ??
          `Retrieved Documents${documents ? ` (${documents.length})` : ''}`}
      </button>
    ),
    // The panel's internals (documents button, tool record, model badge,
    // file cards) come from the SDK bundle and are covered by its tests; the
    // stub exposes what the tab hands it.
    TranscriptTurnDetails: ({ turn }: any) => {
      const [open, setOpen] = React.useState(false);
      const documents = turn?.documents ?? [];
      const tools = turn?.tool_calls ?? [];
      const hasEntries = (v: any) => !!v && Object.keys(v).length > 0;
      if (
        !documents.length &&
        !tools.length &&
        !hasEntries(turn?.metadata) &&
        !hasEntries(turn?.request_context)
      ) {
        return null;
      }
      return (
        <div
          data-testid="transcript-turn-details"
          data-documents={String(documents.length)}
          data-tools={tools.map((t: any) => t.name).join(',')}
          data-model={turn?.metadata?.llm_model ?? ''}
          data-attachments={(turn?.human_files ?? [])
            .map((f: any) => `${f.name}:${f.url}`)
            .join(',')}
        >
          <button type="button" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide Details' : 'Show Details'}
          </button>
          {documents.length > 0 && (
            <button
              type="button"
              data-testid="retrieved-documents-button"
              data-document-count={String(documents.length)}
            >
              Retrieved Documents ({documents.length})
            </button>
          )}
        </div>
      );
    },
    LlmModelBadge: ({ model, provider }: any) => (
      <span data-testid="llm-model-badge">
        {model} by {provider}
      </span>
    ),
    TranscriptFileCards: ({ files }: any) =>
      files.length ? (
        <span data-testid="transcript-file-cards">
          {files.map((f: any) => `${f.name}:${f.url ?? 'none'}`).join(',')}
        </span>
      ) : null,
    ToolCallIndicator: ({ toolCalls, showResults }: any) => (
      <div
        data-testid="tool-call-indicator"
        data-show-results={String(showResults)}
      >
        Used {toolCalls.length} tools:{' '}
        {toolCalls.map((c: any) => c.name).join(',')}
      </div>
    ),
    UserProfileLink: ({ username, display, currentSPA, className }: any) => {
      const [open, setOpen] = React.useState(false);
      if (!username) {
        return (
          <span data-testid="owner-plain" className={className}>
            {display}
          </span>
        );
      }
      return (
        <>
          <button
            type="button"
            data-testid="owner-link"
            data-username={username}
            data-spa={currentSPA}
            className={className}
            aria-label={`View profile for ${display}`}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
          >
            {display}
          </button>
          {open && (
            <div
              data-testid="user-profile-link-dialog"
              data-username={username}
            />
          )}
        </>
      );
    },
  };
});

vi.mock('@/lib/config', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
  return {
    ...actual,
    config: { ...actual.config, iblPlatform: () => 'skills' },
  };
});

// The chat UI the details panel reuses (documents dialog, "Used N tools"
// record). Each has its own tests; here we check the turn data reaches them.

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

  it('falls back to "Anonymous" name and message fallbacks when nothing names the user', () => {
    mockUseHistoryWithPagination.mockReturnValue(
      defaultHistory({
        chatHistory: {
          results: [
            {
              ...baseConversation,
              id: 'conv-anon',
              email: '',
              lti_email: '',
              student: '',
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
              student: '',
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

  // ==========================================================================
  // Conversation owner: a real full name first, else email → username → Anonymous, and the
  // label opens the shared profile viewer (same modal as Management → Users).
  // ==========================================================================
  describe('conversation owner label', () => {
    const renderWith = (overrides: Record<string, unknown>) => {
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({
          chatHistory: { results: [{ ...baseConversation, ...overrides }] },
        }),
      );
      render(<HistoryTab />);
      fireEvent.click(screen.getByText('Hello there mentor'));
    };
    const list = () => screen.getByLabelText('Conversation list');
    const preview = () => screen.getByLabelText('Conversation preview');

    it('prefers the LTI email, then the account email', () => {
      renderWith({
        lti_email: 'lti@example.com',
        email: 'user@example.com',
        student: 'alice',
      });
      expect(list()).toHaveTextContent('lti@example.com');
      expect(preview()).toHaveTextContent('lti@example.com');
      expect(list()).not.toHaveTextContent('user@example.com');
    });

    it('falls back to the full name, then the username, when there is no email', () => {
      renderWith({
        lti_email: '',
        email: '',
        user_full_name: 'Alice Doe',
        student: 'alice',
      });
      expect(list()).toHaveTextContent('Alice Doe');
      expect(preview()).toHaveTextContent('Alice Doe');
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });

    it('falls back to the username when there is no email or full name', () => {
      renderWith({
        lti_email: '',
        email: '',
        lti_username: '',
        student: 'alice',
      });
      expect(list()).toHaveTextContent('alice');
      expect(screen.queryByText('Anonymous')).not.toBeInTheDocument();
      // The avatar initial follows the label.
      expect(preview()).toHaveTextContent('A');
    });

    it('prefers the LTI username over the platform username', () => {
      renderWith({
        lti_email: '',
        email: '',
        lti_username: 'lti-alice',
        student: 'alice',
      });
      expect(list()).toHaveTextContent('lti-alice');
    });

    it('shows Anonymous only when no email, full name or username exists', () => {
      renderWith({
        lti_email: '',
        email: '',
        user_full_name: '',
        lti_username: '',
        student: '',
      });
      expect(list()).toHaveTextContent('Anonymous');
      expect(preview()).toHaveTextContent('Anonymous');
      expect(screen.queryByTestId('owner-link')).not.toBeInTheDocument();
    });

    it('links the owner to the shared profile viewer with the platform username and the SPA', () => {
      renderWith({
        lti_email: '',
        email: 'user@example.com',
        student: 'alice',
      });
      const links = screen.getAllByRole('button', {
        name: 'View profile for user@example.com',
      });
      // One in the list row, one in the desktop preview pane.
      expect(links).toHaveLength(2);
      links.forEach((link) => {
        expect(link).toHaveAttribute('data-username', 'alice');
        expect(link).toHaveAttribute('data-spa', 'skills');
      });

      fireEvent.click(links[1]);

      expect(screen.getByTestId('user-profile-link-dialog')).toHaveAttribute(
        'data-username',
        'alice',
      );
    });

    it('links the owner in the mobile preview dialog too', () => {
      window.innerWidth = 500;
      renderWith({
        lti_email: '',
        email: 'user@example.com',
        student: 'alice',
      });
      const dialog = screen.getByTestId('preview-dialog');
      expect(
        within(dialog).getByRole('button', {
          name: 'View profile for user@example.com',
        }),
      ).toHaveAttribute('data-username', 'alice');
    });

    it('does not link the owner when there is no platform username to open', () => {
      renderWith({
        lti_email: 'lti@example.com',
        email: '',
        lti_username: 'lti-alice',
        student: '',
      });
      expect(screen.queryByTestId('owner-link')).not.toBeInTheDocument();
      expect(list()).toHaveTextContent('lti@example.com');
    });

    it('clicking the owner link does not also select the row', () => {
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({
          chatHistory: {
            results: [{ ...baseConversation, email: 'user@example.com' }],
          },
        }),
      );
      render(<HistoryTab />);
      fireEvent.click(
        within(list()).getByRole('button', {
          name: 'View profile for user@example.com',
        }),
      );
      expect(
        screen.getByTestId('user-profile-link-dialog'),
      ).toBeInTheDocument();
      // Nothing selected: the preview pane still shows its prompt.
      expect(preview()).toHaveTextContent(
        'Select a conversation to view details',
      );
    });
  });

  // ==========================================================================
  // Extended history: retrieved documents, tool calls, metadata, request context
  // ==========================================================================
  describe('extended history (retrieved documents, tool calls, metadata)', () => {
    const extendedConversation = {
      ...baseConversation,
      id: 'conv-ext',
      messages: [
        {
          human: 'What is javascript?',
          ai: 'JavaScript is a programming language.',
          documents: [
            { source: 'doc1', title: 'Doc One', snippet: 'text', score: 0.9 },
          ],
          tool_calls: [
            { name: 'search', input: { q: 'js' }, output: 'results' },
            { name: 'fetch', input: null, output: null },
          ],
          metadata: { llm_model: 'gpt-4o', llm_provider: 'openai' },
          request_context: { model: 'gpt-4o' },
        },
        // A turn with nothing extra adds nothing to the badges and gets no panel.
        {
          human: 'Thanks',
          ai: 'You are welcome',
          documents: null,
          tool_calls: [],
        },
      ],
    };

    it('sums documents and tool calls over the turns, treating null/empty as zero', () => {
      expect(summarizeTranscriptTurns(extendedConversation.messages)).toEqual({
        documentsCount: 1,
        toolCallsCount: 2,
      });
      expect(summarizeTranscriptTurns(null)).toEqual({
        documentsCount: 0,
        toolCallsCount: 0,
      });
      expect(
        summarizeTranscriptTurns([null, { documents: null, tool_calls: null }]),
      ).toEqual({ documentsCount: 0, toolCallsCount: 0 });
    });

    it('badges list rows with the document and tool-call totals of their turns', () => {
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({
          chatHistory: { results: [extendedConversation, baseConversation] },
        }),
      );
      render(<HistoryTab />);

      const list = screen.getByLabelText('Conversation list');
      // The Documents chip is the chat's documents dialog, one click away…
      const sources = within(list).getByRole('button', {
        name: 'Documents · 1',
      });
      expect(sources).toHaveAttribute('data-document-count', '1');
      // …and the tools chip is a badge.
      expect(list).toHaveTextContent('Tools · 2');
      // Only the extended conversation carries chips.
      expect(screen.getAllByTestId('transcript-rollup-badges')).toHaveLength(1);
      expect(
        within(list).getAllByTestId('retrieved-documents-button'),
      ).toHaveLength(1);
    });

    it('offers every document the conversation retrieved from the preview header, repeats included', () => {
      const doc = {
        source: 'doc1',
        title: 'Doc One',
        snippet: 'text',
        score: 0.9,
      };
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({
          chatHistory: {
            results: [
              {
                ...extendedConversation,
                messages: [
                  { human: 'a', ai: 'b', documents: [doc] },
                  {
                    human: 'c',
                    ai: 'd',
                    documents: [doc, { ...doc, source: 'doc2' }],
                  },
                ],
              },
            ],
          },
        }),
      );
      render(<HistoryTab />);
      fireEvent.click(screen.getByText('a'));
      const preview = screen.getByLabelText('Conversation preview');
      // The header button carries every document the turns retrieved (3, a
      // repeat included, as the backend counts), keyed on the session too, so
      // it never depends on the per-user lookup.
      const header = within(preview).getAllByTestId(
        'retrieved-documents-button',
      )[0];
      expect(header).toHaveAttribute('data-document-count', '3');
      expect(header).toHaveAttribute('data-session-id', 'conv-ext');
      expect(
        conversationDocuments([
          { documents: [doc] },
          null,
          { documents: [doc, { ...doc, source: 'doc2' }] },
          { documents: null },
        ]),
      ).toHaveLength(3);
    });

    it('counts every retrieval, repeats included, matching the dialog', () => {
      const doc = {
        source: 'doc1',
        title: 'Doc One',
        snippet: 'text',
        score: 0.9,
      };
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({
          chatHistory: {
            results: [
              {
                ...extendedConversation,
                messages: [
                  { human: 'a', ai: 'b', documents: [doc] },
                  {
                    human: 'c',
                    ai: 'd',
                    documents: [doc, { ...doc, source: 'doc2' }],
                  },
                ],
              },
            ],
          },
        }),
      );
      render(<HistoryTab />);
      const list = screen.getByLabelText('Conversation list');
      expect(
        within(list).getByRole('button', { name: 'Documents · 3' }),
      ).toHaveAttribute('data-document-count', '3');
    });

    it('shows a collapsible per-turn details panel in the desktop preview', () => {
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({ chatHistory: { results: [extendedConversation] } }),
      );
      render(<HistoryTab />);

      fireEvent.click(screen.getByText('What is javascript?'));

      const preview = screen.getByLabelText('Conversation preview');
      const toggles = within(preview).getAllByRole('button', {
        name: 'Show Details',
      });
      // One panel for the turn with extended data; none for the plain turn.
      expect(toggles).toHaveLength(1);
      expect(within(preview).queryByText(/Doc One/)).not.toBeInTheDocument();

      fireEvent.click(toggles[0]);

      // Sources open the chat's own Retrieved Documents dialog: once for the
      // conversation (header) and once for the turn, next to Show Details…
      const documentButtons = within(preview).getAllByTestId(
        'retrieved-documents-button',
      );
      expect(documentButtons).toHaveLength(2);
      documentButtons.forEach((button) =>
        expect(button).toHaveTextContent('Retrieved Documents (1)'),
      );
      // …and the panel receives the turn's tool calls and model.
      const panel = within(preview).getByTestId('transcript-turn-details');
      expect(panel).toHaveAttribute('data-tools', 'search,fetch');
      expect(panel).toHaveAttribute('data-model', 'gpt-4o');
      // …and the conversation header offers the chat's Retrieved Documents
      // button with the conversation's own documents.
      expect(
        within(preview).getAllByTestId('retrieved-documents-button')[0],
      ).toHaveAttribute('data-session-id', 'conv-ext');
      expect(
        within(preview).getByRole('button', { name: 'Hide Details' }),
      ).toBeInTheDocument();
    });

    it('shows the details panel in the mobile preview dialog too', () => {
      window.innerWidth = 500;
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({ chatHistory: { results: [extendedConversation] } }),
      );
      render(<HistoryTab />);

      fireEvent.click(screen.getByText('What is javascript?'));

      const dialog = screen.getByTestId('preview-dialog');
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Show Details' }),
      );
      expect(
        within(dialog).getAllByTestId('retrieved-documents-button').length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('shows turn attachments as chat file cards and lets file references open via them', () => {
      const attachment = {
        id: 812,
        name: 'transcript-test-2537.png',
        file_size: 225,
        content_type: 'image/png',
        url: 'https://files.test/signed/transcript-test-2537.png',
      };
      mockUseHistoryWithPagination.mockReturnValue(
        defaultHistory({
          chatHistory: {
            results: [
              {
                ...baseConversation,
                id: 'conv-files',
                messages: [
                  {
                    human: '',
                    ai: 'The image you uploaded is a solid red rectangle.',
                    human_files: [attachment],
                    ai_files: [],
                    documents: null,
                    tool_calls: [],
                    metadata: {
                      llm_model: 'claude-sonnet-4-6',
                      llm_provider: 'anthropic',
                    },
                    request_context: {
                      session_id: 'conv-files',
                      file_references: [
                        {
                          file_id: '233cb674',
                          file_key: 'chat/233cb674/transcript-test-2537.png',
                          file_name: 'transcript-test-2537.png',
                          file_size: 225,
                          content_type: 'image/png',
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        }),
      );
      render(<HistoryTab />);
      fireEvent.click(screen.getByText('Conversation'));

      const preview = screen.getByLabelText('Conversation preview');
      // The human turn's attachment, as a chat file card with its presigned URL.
      const cards = within(preview).getAllByTestId('transcript-file-cards');
      expect(cards[0]).toHaveTextContent(
        'transcript-test-2537.png:https://files.test/signed/transcript-test-2537.png',
      );
      // The panel gets the attachments too, so file references resolve to
      // the same URL (the resolution itself is covered by the SDK tests).
      expect(
        within(preview).getByTestId('transcript-turn-details'),
      ).toHaveAttribute(
        'data-attachments',
        'transcript-test-2537.png:https://files.test/signed/transcript-test-2537.png',
      );
    });

    it('renders no badges or panel when the turns carry no extended data', () => {
      render(<HistoryTab />);

      fireEvent.click(screen.getByText('Hello there mentor'));

      expect(
        screen.queryByTestId('transcript-rollup-badges'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Show Details' }),
      ).not.toBeInTheDocument();
    });
  });
});
