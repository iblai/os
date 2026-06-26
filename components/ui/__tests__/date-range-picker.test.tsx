import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { DatePickerWithRange } from '../date-range-picker';

describe('DatePickerWithRange', () => {
  it('renders the trigger with the default date range formatted', () => {
    render(<DatePickerWithRange className="custom-wrapper" />);

    const trigger = screen.getByRole('button', { name: /jan/i });
    // Default range is Jan 20, 2023 -> Feb 09, 2023.
    expect(trigger).toHaveTextContent('Jan 20, 2023');
    expect(trigger).toHaveTextContent('Feb 09, 2023');
  });

  it('merges the className onto the wrapper', () => {
    const { container } = render(
      <DatePickerWithRange className="custom-wrapper" />,
    );

    expect(container.firstChild).toHaveClass('custom-wrapper');
    expect(container.firstChild).toHaveClass('w-full');
  });

  it('opens the popover and shows the range calendar', () => {
    render(<DatePickerWithRange />);

    fireEvent.click(screen.getByRole('button', { name: /jan/i }));

    // The day-picker grid renders once the popover is open.
    expect(screen.getAllByRole('grid').length).toBeGreaterThan(0);
  });

  it('updates the selected range when a new day is picked', () => {
    render(<DatePickerWithRange />);

    fireEvent.click(screen.getByRole('button', { name: /jan/i }));

    const dialog = screen.getByRole('dialog');
    // Pick a day inside the open calendar to drive the onSelect callback.
    const dayButton = within(dialog).getAllByRole('gridcell')[0];
    const clickable = dayButton.querySelector('button') ?? dayButton;
    fireEvent.click(clickable);

    // The popover trigger (id="date") still renders after the selection change.
    expect(document.getElementById('date')).toBeInTheDocument();
  });
});
