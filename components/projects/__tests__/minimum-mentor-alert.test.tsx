import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MinimumMentorAlert } from '../minimum-mentor-alert';

describe('MinimumMentorAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with title, description and cancel button when open', () => {
    render(<MinimumMentorAlert open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Cannot Remove Agent')).toBeInTheDocument();
    expect(
      screen.getByText(/A project must have at least one agent/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    render(<MinimumMentorAlert open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<MinimumMentorAlert open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
