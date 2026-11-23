import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DateRange } from 'react-day-picker';
import { FlaggedPromptsFilters } from '../flagged-prompts-filters';

// ============================================================================
// HELPERS
// ============================================================================

function renderFilters(
  overrides: Partial<React.ComponentProps<typeof FlaggedPromptsFilters>> = {},
) {
  const props = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    filterType: 'moderation',
    onFilterTypeChange: vi.fn(),
    dateRange: undefined as DateRange | undefined,
    onDateRangeChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<FlaggedPromptsFilters {...props} />) };
}

describe('FlaggedPromptsFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search input with its placeholder', () => {
    renderFilters();
    expect(screen.getByPlaceholderText('Search for User')).toBeInTheDocument();
  });

  it('renders the search input with the provided search query value', () => {
    renderFilters({ searchQuery: 'john' });
    expect(screen.getByPlaceholderText('Search for User')).toHaveValue('john');
  });

  it('calls onSearchChange when the search input changes', () => {
    const { props } = renderFilters();
    fireEvent.change(screen.getByPlaceholderText('Search for User'), {
      target: { value: 'alice' },
    });
    expect(props.onSearchChange).toHaveBeenCalledWith('alice');
  });

  it('shows the "Pick a Date Range" label when no date range is selected', () => {
    renderFilters();
    expect(screen.getByText('Pick a Date Range')).toBeInTheDocument();
  });

  it('shows the formatted date range when from and to are set', () => {
    renderFilters({
      dateRange: {
        from: new Date('2026-01-15T00:00:00'),
        to: new Date('2026-01-20T00:00:00'),
      },
    });
    expect(screen.getByText('Jan 15 - Jan 20')).toBeInTheDocument();
  });

  it('shows the selected type on both type filter triggers', () => {
    renderFilters();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    for (const trigger of screen.getAllByRole('combobox')) {
      expect(trigger).toHaveTextContent('Moderation');
    }
  });

  it('renders the type options once a select is opened', async () => {
    const user = userEvent.setup();
    renderFilters();

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]);

    expect(
      await screen.findByRole('option', { name: 'Moderation' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'Safety' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('calls onFilterTypeChange when a type option is selected', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters();

    // Open the first (desktop) select trigger.
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]);

    const safetyOption = await screen.findByRole('option', {
      name: 'Safety',
    });
    await user.click(safetyOption);

    expect(props.onFilterTypeChange).toHaveBeenCalledWith('safety');
  });

  it('opens the calendar popover and forwards date selection to onDateRangeChange', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters();

    await user.click(screen.getByText('Pick a Date Range'));

    // The calendar renders day buttons; clicking one fires onSelect -> onDateRangeChange.
    const dayButtons = await screen.findAllByRole('gridcell');
    const clickableDay = dayButtons
      .map((cell) => cell.querySelector('button'))
      .find((btn): btn is HTMLButtonElement => btn !== null);

    expect(clickableDay).toBeTruthy();
    await user.click(clickableDay!);

    expect(props.onDateRangeChange).toHaveBeenCalled();
  });
});
