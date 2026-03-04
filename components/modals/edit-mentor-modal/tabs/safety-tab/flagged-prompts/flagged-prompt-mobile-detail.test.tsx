import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { FlaggedPromptMobileDetail } from './flagged-prompt-mobile-detail';
import { FlaggedPrompt } from './types';

// ============================================================================
// MOCKS
// ============================================================================

let capturedDeleteModalProps: any = {};

vi.mock('./delete-moderation-log-modal', () => ({
  DeleteModerationLogModal: (props: any) => {
    capturedDeleteModalProps = props;
    return props.isOpen ? (
      <div data-testid="delete-modal">
        <button onClick={() => props.onDeleteSuccess?.()} data-testid="confirm-delete">
          Confirm Delete
        </button>
        <button onClick={props.onClose} data-testid="cancel-delete">
          Cancel Delete
        </button>
      </div>
    ) : null;
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  DialogTitle: ({ children, className }: any) => <h2 className={className}>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Trash2: ({ className }: any) => <span data-testid="trash-icon" className={className} />,
}));

// ============================================================================
// FIXTURES
// ============================================================================

const mockPrompt: FlaggedPrompt = {
  id: 'prompt-1',
  userId: 'user-1',
  userEmail: 'jane@example.com',
  userFullName: 'Jane Smith',
  type: 'Safety',
  prompt: 'This is the flagged content',
  systemResponse: 'Response was blocked for safety',
  timestamp: 'February 1, 2025, 2:00 PM',
  timeAgo: '1 hour ago',
  fullDate: 'February 1, 2025, 2:00 PM',
};

// ============================================================================
// TESTS
// ============================================================================

describe('FlaggedPromptMobileDetail', () => {
  const defaultProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    prompt: mockPrompt,
    onDeleteSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedDeleteModalProps = {};
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when isOpen is false', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Flagged Prompt Details')).toBeInTheDocument();
  });

  it('renders nothing for prompt content when prompt is null', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} prompt={null} />);
    expect(screen.getByText('Flagged Prompt Details')).toBeInTheDocument();
    expect(screen.queryByText('Flagged by')).not.toBeInTheDocument();
  });

  it('shows prompt details when prompt is provided', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    expect(screen.getByText('Flagged by Safety System')).toBeInTheDocument();
    expect(screen.getByText('February 1, 2025, 2:00 PM')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('This is the flagged content')).toBeInTheDocument();
  });

  it('shows user email initial in avatar', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('shows "A" for anonymous users with no email', () => {
    const noEmailPrompt = { ...mockPrompt, userEmail: '' };
    render(<FlaggedPromptMobileDetail {...defaultProps} prompt={noEmailPrompt} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows system response with type label', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    expect(screen.getByText('Response was blocked for safety')).toBeInTheDocument();
    expect(screen.getByText('Safety System')).toBeInTheDocument();
    expect(screen.getByText('SS')).toBeInTheDocument();
  });

  it('shows Moderation system type correctly', () => {
    const modPrompt = { ...mockPrompt, type: 'Moderation' as const };
    render(<FlaggedPromptMobileDetail {...defaultProps} prompt={modPrompt} />);
    expect(screen.getByText('Flagged by Moderation System')).toBeInTheDocument();
    expect(screen.getByText('Moderation System')).toBeInTheDocument();
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('shows delete button with trash icon', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
  });

  it('opens delete modal when delete button is clicked', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('passes correct logId to delete modal', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(capturedDeleteModalProps.logId).toBe('prompt-1');
  });

  it('closes delete modal when cancel is triggered', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-delete'));
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('calls onDeleteSuccess and closes dialog on successful delete', () => {
    render(<FlaggedPromptMobileDetail {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));

    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(defaultProps.onDeleteSuccess).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
