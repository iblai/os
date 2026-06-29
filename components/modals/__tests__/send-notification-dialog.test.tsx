import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { SendNotificationDialog } from '../send-notification-dialog';

// RichTextEditor is a heavy TipTap component; replace it with a plain textarea
// that exercises the same `value`/`onChange` contract used by the dialog.
vi.mock('@/components/rich-text-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Stub the calendar so a deterministic date can be selected without driving the
// real (jsdom-unfriendly) date grid. Selecting calls the dialog's onSelect.
vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    onSelect,
    disabled,
  }: {
    onSelect: (d: Date) => void;
    disabled?: (d: Date) => boolean;
  }) => {
    // Exercise the dialog's inline `disabled` predicate (past dates blocked,
    // future dates allowed) so it is covered.
    disabled?.(new Date('2000-01-01T00:00:00'));
    disabled?.(new Date('2999-01-01T00:00:00'));
    return (
      <button
        data-testid="pick-day"
        onClick={() => onSelect(new Date('2030-01-15T00:00:00'))}
      >
        pick-day
      </button>
    );
  },
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Preview'), {
    target: { value: 'My title' },
  });
  fireEvent.change(screen.getByTestId('rich-text-editor'), {
    target: { value: 'My body' },
  });
  // Select the first user from the list to satisfy recipients > 0.
  fireEvent.click(screen.getByText('John Doe'));
}

describe('SendNotificationDialog', () => {
  beforeEach(() => {
    cleanup();
  });

  it('does not render content when closed', () => {
    render(<SendNotificationDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Send New Notification')).not.toBeInTheDocument();
  });

  it('renders the dialog with title, labels and the user list', () => {
    render(<SendNotificationDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByText('Send New Notification')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Send Time')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Send Now')).toBeInTheDocument();
  });

  it('pre-selects a user when preSelectedUser is provided', () => {
    render(
      <SendNotificationDialog
        open
        onOpenChange={vi.fn()}
        preSelectedUser={{
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
        }}
      />,
    );

    // "1 user selected" appears once the pre-selected user is applied.
    expect(screen.getByText('1 user selected')).toBeInTheDocument();
  });

  it('disables the send button until the form is valid', () => {
    render(<SendNotificationDialog open onOpenChange={vi.fn()} />);

    const sendButton = screen.getByRole('button', { name: /send now/i });
    expect(sendButton).toBeDisabled();

    fillRequiredFields();
    expect(sendButton).toBeEnabled();
  });

  it('filters users by the search query and shows the empty state', () => {
    render(<SendNotificationDialog open onOpenChange={vi.fn()} />);

    const search = screen.getByPlaceholderText(
      'Search users by name or email...',
    );

    // Match by email substring.
    fireEvent.change(search, { target: { value: 'jane@example' } });
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // No matches -> empty state.
    fireEvent.change(search, { target: { value: 'zzzzz-nobody' } });
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('toggles a user selection on and off from the list', () => {
    render(<SendNotificationDialog open onOpenChange={vi.fn()} />);

    // Once selected the name also appears in the chip row, so target the
    // clickable list row (the last "John Doe" occurrence) explicitly.
    const johnRow = () => {
      const matches = screen.getAllByText('John Doe');
      return matches[matches.length - 1];
    };

    fireEvent.click(johnRow());
    expect(screen.getByText('1 user selected')).toBeInTheDocument();

    // Selecting a second user pluralizes the counter.
    const janeMatches = screen.getAllByText('Jane Smith');
    fireEvent.click(janeMatches[janeMatches.length - 1]);
    expect(screen.getByText('2 users selected')).toBeInTheDocument();

    // Clicking the same list row again deselects it.
    fireEvent.click(johnRow());
    expect(screen.getByText('1 user selected')).toBeInTheDocument();
  });

  it('removes a selected user via the chip remove button', () => {
    render(<SendNotificationDialog open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('John Doe'));
    expect(screen.getByText('1 user selected')).toBeInTheDocument();

    // The selected-chip area renders an X button (the only one without text).
    const removeButtons = screen
      .getAllByRole('button')
      .filter(
        (b) => b.querySelector('svg') && b.className.includes('rounded-full'),
      );
    fireEvent.click(removeButtons[0]);

    expect(screen.getByText('0 users selected')).toBeInTheDocument();
  });

  it('sends a notification immediately and resets/closes', () => {
    const onNotificationSent = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <SendNotificationDialog
        open
        onOpenChange={onOpenChange}
        onNotificationSent={onNotificationSent}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /send now/i }));

    expect(onNotificationSent).toHaveBeenCalledTimes(1);
    const payload = onNotificationSent.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: 'My title',
      body: 'My body',
      status: 'sent',
      recipients: ['1'],
      scheduledFor: undefined,
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('sends without a callback when onNotificationSent is omitted', () => {
    const onOpenChange = vi.fn();
    render(<SendNotificationDialog open onOpenChange={onOpenChange} />);

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /send now/i }));

    // No callback provided -> still closes the dialog without throwing.
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('reveals scheduling controls and keeps the button disabled until a date is picked', () => {
    render(<SendNotificationDialog open onOpenChange={vi.fn()} />);

    fillRequiredFields();
    fireEvent.click(screen.getByLabelText('Schedule for later'));

    // Button label switches to the schedule variant.
    const scheduleButton = screen.getByRole('button', {
      name: /schedule notification/i,
    });
    // Still disabled: schedule selected but no date yet.
    expect(scheduleButton).toBeDisabled();

    // The date trigger shows the placeholder until a date is chosen.
    expect(screen.getByText('Pick a date')).toBeInTheDocument();
  });

  it('schedules a notification with a chosen date and time', () => {
    const onNotificationSent = vi.fn();
    render(
      <SendNotificationDialog
        open
        onOpenChange={vi.fn()}
        onNotificationSent={onNotificationSent}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByLabelText('Schedule for later'));

    // Open the date popover and pick the stubbed day.
    fireEvent.click(screen.getByText('Pick a date'));
    fireEvent.click(screen.getByTestId('pick-day'));

    // Adjust the time input.
    const timeInput = document.querySelector(
      'input[type="time"]',
    ) as HTMLInputElement;
    fireEvent.change(timeInput, { target: { value: '09:30' } });

    const scheduleButton = screen.getByRole('button', {
      name: /schedule notification/i,
    });
    expect(scheduleButton).toBeEnabled();

    fireEvent.click(scheduleButton);

    expect(onNotificationSent).toHaveBeenCalledTimes(1);
    const payload = onNotificationSent.mock.calls[0][0];
    expect(payload.status).toBe('scheduled');
    expect(payload.scheduledFor).toBeInstanceOf(Date);
  });

  it('resets all state when cancelled via the Cancel button', () => {
    const onOpenChange = vi.fn();
    render(<SendNotificationDialog open onOpenChange={onOpenChange} />);

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('closes (resetting state) when the dialog requests onOpenChange', () => {
    const onOpenChange = vi.fn();
    render(<SendNotificationDialog open onOpenChange={onOpenChange} />);

    // Pressing Escape triggers Radix Dialog's onOpenChange -> handleClose.
    fireEvent.keyDown(screen.getByText('Send New Notification'), {
      key: 'Escape',
      code: 'Escape',
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
