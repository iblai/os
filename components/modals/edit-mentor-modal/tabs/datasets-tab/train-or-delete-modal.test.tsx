import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { TrainOrDeleteModal } from './train-or-delete-modal';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  DialogFooter: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));

describe('TrainOrDeleteModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onTrain: vi.fn(),
    onDelete: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog title and description when open', () => {
    render(<TrainOrDeleteModal {...defaultProps} />);

    expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
    expect(
      screen.getByText(/This dataset is currently untrained/),
    ).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<TrainOrDeleteModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText('What would you like to do?'),
    ).not.toBeInTheDocument();
  });

  it('calls onDelete when Delete button is clicked', () => {
    render(<TrainOrDeleteModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onTrain when Train button is clicked', () => {
    render(<TrainOrDeleteModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Train'));
    expect(defaultProps.onTrain).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isLoading is true', () => {
    render(<TrainOrDeleteModal {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Delete').closest('button')).toBeDisabled();
    expect(screen.getByText('Training...').closest('button')).toBeDisabled();
  });

  it('shows "Training..." text when isLoading is true', () => {
    render(<TrainOrDeleteModal {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Training...')).toBeInTheDocument();
    expect(screen.queryByText('Train')).not.toBeInTheDocument();
  });

  it('shows "Train" text when isLoading is false', () => {
    render(<TrainOrDeleteModal {...defaultProps} isLoading={false} />);

    expect(screen.getByText('Train')).toBeInTheDocument();
    expect(screen.queryByText('Training...')).not.toBeInTheDocument();
  });
});
