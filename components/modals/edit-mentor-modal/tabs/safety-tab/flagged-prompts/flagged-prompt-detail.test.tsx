import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { FlaggedPromptDetail } from './flagged-prompt-detail';
import { FlaggedPrompt } from './types';

// ============================================================================
// MOCKS
// ============================================================================

const mockDeleteModalProps: any = {};

vi.mock('./delete-moderation-log-modal', () => ({
  DeleteModerationLogModal: (props: any) => {
    Object.assign(mockDeleteModalProps, props);
    return props.isOpen ? (
      <div data-testid="delete-modal">
        <button onClick={props.onClose}>Close Delete Modal</button>
        <button onClick={props.onDeleteSuccess}>Confirm Delete</button>
      </div>
    ) : null;
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Trash2: ({ className }: any) => (
    <span data-testid="trash-icon" className={className} />
  ),
}));

// ============================================================================
// FIXTURES
// ============================================================================

const mockPrompt: FlaggedPrompt = {
  id: 'prompt-1',
  userId: 'user-1',
  userEmail: 'john@example.com',
  userFullName: 'John Doe',
  type: 'Moderation',
  prompt: 'This is the flagged prompt content',
  systemResponse: 'This prompt was flagged for policy violation',
  timestamp: 'January 15, 2025, 10:30 AM',
  timeAgo: '2 days ago',
  fullDate: 'January 15, 2025, 10:30 AM',
};

// ============================================================================
// TESTS
// ============================================================================

describe('FlaggedPromptDetail', () => {
  const defaultProps = {
    prompt: mockPrompt,
    onContactUser: vi.fn(),
    onDeleteSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows placeholder text when no prompt is selected', () => {
    render(
      <FlaggedPromptDetail
        prompt={null}
        onContactUser={vi.fn()}
        onDeleteSuccess={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Select a flagged prompt to view details.'),
    ).toBeInTheDocument();
  });

  it('renders prompt details when a prompt is provided', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    expect(
      screen.getByText('Flagged by Moderation System'),
    ).toBeInTheDocument();
    expect(screen.getByText('January 15, 2025, 10:30 AM')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(
      screen.getByText('This is the flagged prompt content'),
    ).toBeInTheDocument();
  });

  it('shows user email initial in avatar', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('shows "A" for anonymous users with no email', () => {
    const promptNoEmail: FlaggedPrompt = {
      ...mockPrompt,
      userEmail: '',
    };
    render(
      <FlaggedPromptDetail
        prompt={promptNoEmail}
        onContactUser={vi.fn()}
        onDeleteSuccess={vi.fn()}
      />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows system response', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    expect(
      screen.getByText('This prompt was flagged for policy violation'),
    ).toBeInTheDocument();
    expect(screen.getByText('Moderation System')).toBeInTheDocument();
  });

  it('shows system type indicator with correct initial', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    // Moderation -> MS
    expect(screen.getByText('MS')).toBeInTheDocument();
  });

  it('shows Safety type system correctly', () => {
    const safetyPrompt: FlaggedPrompt = { ...mockPrompt, type: 'Safety' };
    render(
      <FlaggedPromptDetail
        prompt={safetyPrompt}
        onContactUser={vi.fn()}
        onDeleteSuccess={vi.fn()}
      />,
    );
    expect(screen.getByText('Flagged by Safety System')).toBeInTheDocument();
    expect(screen.getByText('Safety System')).toBeInTheDocument();
    expect(screen.getByText('SS')).toBeInTheDocument();
  });

  it('shows delete button with trash icon', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
  });

  it('opens delete modal when delete button is clicked', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('passes correct logId to delete modal', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(mockDeleteModalProps.logId).toBe('prompt-1');
  });

  it('closes delete modal when close is triggered', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Delete Modal'));
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('passes onDeleteSuccess to delete modal', () => {
    render(<FlaggedPromptDetail {...defaultProps} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(mockDeleteModalProps.onDeleteSuccess).toBe(
      defaultProps.onDeleteSuccess,
    );
  });
});
