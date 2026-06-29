import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { DeleteMemoryModal } from '../delete-memory-modal';

// Dialog ⇒ render children when open; skip Radix portals/animations.
// The hidden `dialog-dismiss` button exposes the component's onOpenChange
// wrapper so tests can exercise the close path.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? (
      <div role="dialog">
        <button
          data-testid="dialog-dismiss"
          onClick={() => onOpenChange?.(false)}
        >
          dismiss
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

const makeProps = (overrides: Partial<any> = {}) => ({
  open: true,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  isDeleting: false,
  ...overrides,
});

describe('DeleteMemoryModal', () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it('renders nothing when open is false', () => {
    render(<DeleteMemoryModal {...makeProps({ open: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the title and confirmation message when open', () => {
    render(<DeleteMemoryModal {...makeProps()} />);
    expect(screen.getByText('Delete Memory')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Are you sure you want to delete this memory? This action cannot be undone.',
      ),
    ).toBeInTheDocument();
  });

  it('shows "Delete" on the confirm button when not deleting', () => {
    render(<DeleteMemoryModal {...makeProps({ isDeleting: false })} />);
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeInTheDocument();
    expect(confirm).not.toBeDisabled();
  });

  it('shows "Deleting..." and disables the confirm button while deleting', () => {
    render(<DeleteMemoryModal {...makeProps({ isDeleting: true })} />);
    const confirm = screen.getByRole('button', { name: 'Deleting...' });
    expect(confirm).toBeInTheDocument();
    expect(confirm).toBeDisabled();
  });

  it('calls onConfirm when the delete button is clicked', () => {
    const onConfirm = vi.fn();
    render(<DeleteMemoryModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<DeleteMemoryModal {...makeProps({ onCancel })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when the dialog dismisses', () => {
    const onOpenChange = vi.fn();
    render(<DeleteMemoryModal {...makeProps({ onOpenChange })} />);
    fireEvent.click(screen.getByTestId('dialog-dismiss'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
