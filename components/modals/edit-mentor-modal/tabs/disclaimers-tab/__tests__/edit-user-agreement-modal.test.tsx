import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { EditUserAgreementModal } from '../edit-user-agreement-modal';

describe('EditUserAgreementModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    content: 'Existing agreement',
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isSaving: false,
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders dialog with title, label and content', () => {
    render(<EditUserAgreementModal {...defaultProps} />);

    expect(screen.getByText('Edit User Agreement')).toBeInTheDocument();
    expect(screen.getByText('User Agreement Content')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Existing agreement');
  });

  it('does not render content when open is false', () => {
    render(<EditUserAgreementModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Edit User Agreement')).not.toBeInTheDocument();
  });

  it('falls back to empty string when content is undefined', () => {
    render(
      <EditUserAgreementModal
        {...defaultProps}
        content={undefined as unknown as string}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('updates value when typing in the textarea', () => {
    render(<EditUserAgreementModal {...defaultProps} />);
    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: 'New agreement text' } });

    expect(textarea).toHaveValue('New agreement text');
  });

  it('calls onCancel when Cancel is clicked', () => {
    render(<EditUserAgreementModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with the current value when Save is clicked', () => {
    render(<EditUserAgreementModal {...defaultProps} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Updated agreement' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(defaultProps.onSave).toHaveBeenCalledWith('Updated agreement');
  });

  it('disables Save button when value is only whitespace', () => {
    render(<EditUserAgreementModal {...defaultProps} content="" />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '   ' },
    });

    expect(screen.getByText('Save').closest('button')).toBeDisabled();
  });

  it('disables Save button and shows Saving label when isSaving is true', () => {
    render(<EditUserAgreementModal {...defaultProps} isSaving />);

    const saveButton = screen.getByText('Saving...').closest('button');
    expect(saveButton).toBeDisabled();
  });

  it('forwards open changes through onOpenChange', () => {
    render(<EditUserAgreementModal {...defaultProps} />);

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });

    expect(defaultProps.onOpenChange).toHaveBeenCalled();
  });
});
