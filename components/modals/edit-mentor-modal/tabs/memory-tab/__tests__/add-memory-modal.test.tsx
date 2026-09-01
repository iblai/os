import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { AddMemoryModal } from '../add-memory-modal';

// Dialog ⇒ render children when open; skip Radix portals/animations.
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

// Select stub: clones children to thread the onValueChange + current value so
// SelectItem clicks invoke onValueChange with their value.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value}>
      {React.Children.map(children, (child: any) =>
        child ? React.cloneElement(child, { onValueChange }) : null,
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
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

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, ...rest }: any) => (
    <textarea
      data-testid="memory-textarea"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...rest}
    />
  ),
}));

const makeProps = (overrides: Partial<any> = {}) => ({
  open: true,
  onOpenChange: vi.fn(),
  newMemoryContent: '',
  newMemoryCategory: '',
  onContentChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  categories: ['All', 'Preferences', 'Background'],
  isSaving: false,
  ...overrides,
});

describe('AddMemoryModal', () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it('renders nothing when open is false', () => {
    render(<AddMemoryModal {...makeProps({ open: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog title, labels and placeholder when open', () => {
    render(<AddMemoryModal {...makeProps()} />);
    expect(screen.getByText('Add Memory')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Select a memory category')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Enter memory content...'),
    ).toBeInTheDocument();
  });

  it('renders category options excluding "All"', () => {
    render(<AddMemoryModal {...makeProps()} />);
    const options = screen.getAllByRole('option');
    const values = options.map((o) => o.getAttribute('data-value'));
    expect(values).toContain('Preferences');
    expect(values).toContain('Background');
    expect(values).not.toContain('All');
  });

  it('shows the minimum-characters hint when content is under 10 chars', () => {
    render(<AddMemoryModal {...makeProps({ newMemoryContent: 'short' })} />);
    expect(screen.getByText('5/10 characters minimum')).toBeInTheDocument();
  });

  it('trims whitespace when computing the character hint', () => {
    render(
      <AddMemoryModal {...makeProps({ newMemoryContent: '  short  ' })} />,
    );
    // 'short' trimmed is 5 chars.
    expect(screen.getByText('5/10 characters minimum')).toBeInTheDocument();
  });

  it('shows the character count when content is 10 or more chars', () => {
    render(
      <AddMemoryModal
        {...makeProps({ newMemoryContent: 'a valid memory content' })}
      />,
    );
    expect(screen.getByText('22 characters')).toBeInTheDocument();
  });

  it('disables the save button when content is under 10 chars', () => {
    render(<AddMemoryModal {...makeProps({ newMemoryContent: 'short' })} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('enables the save button when content is long enough and not saving', () => {
    render(
      <AddMemoryModal
        {...makeProps({ newMemoryContent: 'this is long enough' })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('shows "Saving..." and disables the save button while saving', () => {
    render(
      <AddMemoryModal
        {...makeProps({
          newMemoryContent: 'this is long enough',
          isSaving: true,
        })}
      />,
    );
    const save = screen.getByRole('button', { name: 'Saving...' });
    expect(save).toBeInTheDocument();
    expect(save).toBeDisabled();
  });

  it('calls onContentChange when the textarea value changes', () => {
    const onContentChange = vi.fn();
    render(<AddMemoryModal {...makeProps({ onContentChange })} />);
    fireEvent.change(screen.getByTestId('memory-textarea'), {
      target: { value: 'new content' },
    });
    expect(onContentChange).toHaveBeenCalledWith('new content');
  });

  it('calls onCategoryChange when a category option is selected', () => {
    const onCategoryChange = vi.fn();
    render(<AddMemoryModal {...makeProps({ onCategoryChange })} />);
    fireEvent.click(screen.getByRole('option', { name: 'Preferences' }));
    expect(onCategoryChange).toHaveBeenCalledWith('Preferences');
  });

  it('calls onSave when the save button is clicked', () => {
    const onSave = vi.fn();
    render(
      <AddMemoryModal
        {...makeProps({ newMemoryContent: 'this is long enough', onSave })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<AddMemoryModal {...makeProps({ onCancel })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when the dialog dismisses', () => {
    const onOpenChange = vi.fn();
    render(<AddMemoryModal {...makeProps({ onOpenChange })} />);
    fireEvent.click(screen.getByTestId('dialog-dismiss'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
