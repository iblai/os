import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { EditDisclaimerModal } from '../edit-disclaimer-modal';

describe('EditDisclaimerModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    disclaimer: 'Existing advisory',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders dialog with title, label and content', () => {
    render(<EditDisclaimerModal {...defaultProps} />);

    expect(screen.getByText('Edit Advisory')).toBeInTheDocument();
    expect(screen.getByText('Advisory Content')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Existing advisory');
  });

  it('does not render content when open is false', () => {
    render(<EditDisclaimerModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Edit Advisory')).not.toBeInTheDocument();
  });

  it('falls back to empty string when disclaimer is undefined', () => {
    render(
      <EditDisclaimerModal
        {...defaultProps}
        disclaimer={undefined as unknown as string}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('updates content when typing in the textarea', () => {
    render(<EditDisclaimerModal {...defaultProps} />);
    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'New advisory text' } });

    expect(textarea).toHaveValue('New advisory text');
  });

  it('calls onCancel when Cancel is clicked', () => {
    render(<EditDisclaimerModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with the current content when Save is clicked', () => {
    render(<EditDisclaimerModal {...defaultProps} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Updated advisory' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(defaultProps.onSave).toHaveBeenCalledWith('Updated advisory');
  });

  it('disables Save button when content is only whitespace', () => {
    render(<EditDisclaimerModal {...defaultProps} disclaimer="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '   ' },
    });

    expect(screen.getByText('Save').closest('button')).toBeDisabled();
  });

  it('disables Save button and shows Saving label when isSaving is true', () => {
    render(<EditDisclaimerModal {...defaultProps} isSaving />);

    const saveButton = screen.getByText('Saving...').closest('button');
    expect(saveButton).toBeDisabled();
  });

  it('forwards open changes through onOpenChange', () => {
    render(<EditDisclaimerModal {...defaultProps} />);

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });

    expect(defaultProps.onOpenChange).toHaveBeenCalled();
  });
});
