import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { FlaggedPromptsModal } from './index';
import { FlaggedPrompt } from './types';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseFlaggedPromptsWithPagination = vi.fn();

vi.mock('./use-flagged-prompts-with-pagination', () => ({
  useFlaggedPromptsWithPagination: (...args: any[]) => mockUseFlaggedPromptsWithPagination(...args),
}));

vi.mock('./flagged-prompts-summary', () => ({
  FlaggedPromptsSummary: ({ totalFlagged }: any) => (
    <div data-testid="summary">Total: {totalFlagged}</div>
  ),
}));

vi.mock('./flagged-prompts-filters', () => ({
  FlaggedPromptsFilters: (_props: any) => <div data-testid="filters">Filters</div>,
}));

vi.mock('./flagged-prompts-list', () => ({
  FlaggedPromptsList: (props: any) => {
    return (
      <div data-testid="list">
        {props.prompts.map((p: FlaggedPrompt) => (
          <button key={p.id} onClick={() => props.onPromptClick(p)} data-testid={`prompt-${p.id}`}>
            {p.userEmail}
          </button>
        ))}
      </div>
    );
  },
}));

let capturedDetailProps: any = {};
vi.mock('./flagged-prompt-detail', () => ({
  FlaggedPromptDetail: (props: any) => {
    capturedDetailProps = props;
    return (
      <div data-testid="detail">
        {props.prompt ? (
          <>
            <span>Detail: {props.prompt.userEmail}</span>
            <button onClick={props.onContactUser} data-testid="contact-user-btn">
              Contact
            </button>
            <button onClick={props.onDeleteSuccess} data-testid="delete-success-btn">
              Delete Success
            </button>
          </>
        ) : (
          <span>No selection</span>
        )}
      </div>
    );
  },
}));

vi.mock('next/dynamic', () => ({
  default: (importFn: () => Promise<any>, _options?: any) => {
    // Call the import function so the .then() callback in index.tsx line 18 is covered
    importFn().catch(() => {});
    // Return a simple mock component
    return (props: any) => {
      if (!props.isOpen) return null;
      return (
        <div data-testid="mobile-detail">
          <span>Mobile: {props.prompt?.userEmail}</span>
          <button onClick={() => props.onDeleteSuccess?.()} data-testid="mobile-delete-success">
            Mobile Delete Success
          </button>
        </div>
      );
    };
  },
}));

let capturedNotificationProps: any = {};
vi.mock('@/components/modals/send-notification-dialog', () => ({
  SendNotificationDialog: (props: any) => {
    capturedNotificationProps = props;
    return props.open ? (
      <div data-testid="notification-dialog">
        <span>Send Notification</span>
        <button onClick={() => props.onOpenChange(false)} data-testid="close-notification">
          Close Notification
        </button>
      </div>
    ) : null;
  },
}));

vi.mock('@/components/ibl-pagination', () => ({
  IblPagination: (props: any) => (
    <div data-testid="pagination">
      Page {props.currentPage} of {props.totalPages}
      <button onClick={() => props.onPageChange(2)} data-testid="next-page">
        Next
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogTitle: ({ children, className }: any) => <h2 className={className}>{children}</h2>,
}));

// ============================================================================
// FIXTURES
// ============================================================================

const mockPrompts: FlaggedPrompt[] = [
  {
    id: 'p1',
    userId: 'user-1',
    userEmail: 'alice@example.com',
    userFullName: 'Alice Smith',
    type: 'Moderation',
    prompt: 'Bad content here',
    systemResponse: 'Blocked for moderation',
    timestamp: 'Jan 10, 2025',
    timeAgo: '5 days ago',
    fullDate: 'January 10, 2025, 3:00 PM',
  },
  {
    id: 'p2',
    userId: 'user-2',
    userEmail: 'bob@example.com',
    userFullName: 'Bob Jones',
    type: 'Safety',
    prompt: 'Unsafe query',
    systemResponse: 'Blocked for safety',
    timestamp: 'Jan 11, 2025',
    timeAgo: '4 days ago',
    fullDate: 'January 11, 2025, 1:00 PM',
  },
];

const defaultHookReturn = {
  paginatedPrompts: mockPrompts,
  totalFlagged: 2,
  searchQuery: '',
  setSearchQuery: vi.fn(),
  filterType: 'all',
  setFilterType: vi.fn(),
  dateRange: undefined,
  setDateRange: vi.fn(),
  currentPage: 1,
  totalPages: 1,
  handlePageChange: vi.fn(),
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  mentorId: 'mentor-1',
  tenantKey: 'test-tenant',
  username: 'testuser',
};

// ============================================================================
// TESTS
// ============================================================================

describe('FlaggedPromptsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedDetailProps = {};
    capturedNotificationProps = {};
    mockUseFlaggedPromptsWithPagination.mockReturnValue(defaultHookReturn);
    // Default: desktop width
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when isOpen is false', () => {
    render(<FlaggedPromptsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with title when isOpen is true', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(screen.getByText('Flagged Prompts')).toBeInTheDocument();
  });

  it('renders summary, filters, list, and detail components', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(screen.getByTestId('summary')).toBeInTheDocument();
    expect(screen.getByTestId('filters')).toBeInTheDocument();
    expect(screen.getByTestId('list')).toBeInTheDocument();
    expect(screen.getByTestId('detail')).toBeInTheDocument();
  });

  it('shows "No flagged prompts found" when totalFlagged is 0', () => {
    mockUseFlaggedPromptsWithPagination.mockReturnValue({
      ...defaultHookReturn,
      paginatedPrompts: [],
      totalFlagged: 0,
    });
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(screen.getByText('No flagged prompts found')).toBeInTheDocument();
    expect(screen.queryByTestId('list')).not.toBeInTheDocument();
  });

  it('shows pagination when there are flagged prompts', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });

  it('passes correct params to useFlaggedPromptsWithPagination', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(mockUseFlaggedPromptsWithPagination).toHaveBeenCalledWith({
      tenantKey: 'test-tenant',
      username: 'testuser',
      mentorId: 'mentor-1',
      itemsPerPage: 5,
    });
  });

  it('selects a prompt when clicked on desktop', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(screen.getByText('No selection')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('prompt-p1'));
    expect(screen.getByText('Detail: alice@example.com')).toBeInTheDocument();
  });

  it('opens mobile detail when prompt clicked on mobile viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
    render(<FlaggedPromptsModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('prompt-p1'));
    expect(screen.getByTestId('mobile-detail')).toBeInTheDocument();
    expect(screen.getByText('Mobile: alice@example.com')).toBeInTheDocument();
  });

  it('does not show mobile detail on desktop', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('prompt-p1'));
    expect(screen.queryByTestId('mobile-detail')).not.toBeInTheDocument();
  });

  it('opens notification dialog when contact user is clicked', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);

    // First select a prompt
    fireEvent.click(screen.getByTestId('prompt-p1'));

    // Then click contact
    fireEvent.click(screen.getByTestId('contact-user-btn'));
    expect(screen.getByTestId('notification-dialog')).toBeInTheDocument();
  });

  it('does not show notification dialog by default', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(screen.queryByTestId('notification-dialog')).not.toBeInTheDocument();
  });

  it('passes preSelectedUser to SendNotificationDialog', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('prompt-p1'));
    fireEvent.click(screen.getByTestId('contact-user-btn'));

    expect(capturedNotificationProps.preSelectedUser).toEqual({
      id: 'user-1',
      name: 'Alice Smith',
      email: 'alice@example.com',
      avatar: undefined,
    });
  });

  it('clears selected prompt on delete success', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);

    // Select a prompt
    fireEvent.click(screen.getByTestId('prompt-p1'));
    expect(screen.getByText('Detail: alice@example.com')).toBeInTheDocument();

    // Trigger delete success
    fireEvent.click(screen.getByTestId('delete-success-btn'));
    expect(screen.getByText('No selection')).toBeInTheDocument();
  });

  it('clears selected prompt on mobile delete success', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
    render(<FlaggedPromptsModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('prompt-p1'));
    expect(screen.getByTestId('mobile-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-delete-success'));
    // selectedPrompt should be null now
    expect(capturedDetailProps.prompt).toBeNull();
  });

  it('passes preSelectedUser as undefined when no prompt is selected', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(capturedNotificationProps.preSelectedUser).toBeUndefined();
  });

  it('renders total flagged count in summary', () => {
    render(<FlaggedPromptsModal {...defaultProps} />);
    expect(screen.getByText('Total: 2')).toBeInTheDocument();
  });
});
