import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { CustomAlertDialog } from '../custom-alert-dialog';

// The hook wires up redux + navigation; the dialog only consumes
// `triggerHandler`, so we stub it to a spy.
const mockTriggerHandler = vi.fn();
vi.mock('@/hooks/use-custom-alert-dialog', () => ({
  useCustomAlertDialog: () => ({ triggerHandler: mockTriggerHandler }),
}));

describe('CustomAlertDialog', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render content when closed', () => {
    render(
      <CustomAlertDialog
        isOpen={false}
        message="Proceed?"
        validateTrigger="DO_IT"
      />,
    );
    expect(screen.queryByText('Proceed?')).not.toBeInTheDocument();
  });

  it('renders the default title, the message and both actions when open', () => {
    render(
      <CustomAlertDialog
        isOpen
        message="Proceed with this action?"
        validateTrigger="DO_IT"
      />,
    );

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    // Falls back to the translated "Are you sure?" when no title is provided.
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Proceed with this action?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue' }),
    ).toBeInTheDocument();
  });

  it('renders a custom title when provided', () => {
    render(
      <CustomAlertDialog
        isOpen
        title="Switch mode"
        message="Are you sure?"
        validateTrigger="DO_IT"
      />,
    );

    expect(screen.getByText('Switch mode')).toBeInTheDocument();
    expect(screen.queryByText('Are you sure?')).toBe(
      screen.getByText('Are you sure?'),
    );
  });

  it('fires the validate trigger when Continue is clicked', () => {
    render(
      <CustomAlertDialog
        isOpen
        message="Proceed?"
        validateTrigger="SWITCH_TO_LEARNER"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(mockTriggerHandler).toHaveBeenCalledWith('SWITCH_TO_LEARNER');
  });

  it('fires the cancel trigger when Cancel is clicked', () => {
    render(
      <CustomAlertDialog
        isOpen
        message="Proceed?"
        validateTrigger="DO_IT"
        cancelTrigger="ABORT"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockTriggerHandler).toHaveBeenCalledWith('ABORT');
  });

  it('defaults the cancel trigger to an empty string when omitted', () => {
    render(
      <CustomAlertDialog isOpen message="Proceed?" validateTrigger="DO_IT" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockTriggerHandler).toHaveBeenCalledWith('');
  });
});
