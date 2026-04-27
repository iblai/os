import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CopyButton } from './copy-button';

const mockCopy = vi.fn();
let mockStatus: 'idle' | 'success' | 'error' = 'idle';

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: (timeout: number) => {
    mockCopy.mockImplementation(() => Promise.resolve());
    (mockCopy as unknown as { lastTimeout?: number }).lastTimeout = timeout;
    return { copy: mockCopy, status: mockStatus };
  },
}));

describe('CopyButton', () => {
  beforeEach(() => {
    mockCopy.mockReset();
    mockStatus = 'idle';
  });

  it('renders with default Copy label and aria-label in idle state', () => {
    render(<CopyButton text="hello" />);

    const button = screen.getByRole('button', {
      name: 'Copy text to clipboard',
    });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('renders Copy icon', () => {
    render(<CopyButton text="hello" />);

    const button = screen.getByRole('button', {
      name: 'Copy text to clipboard',
    });
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('h-4', 'w-4');
  });

  it('calls copy with provided text on click', async () => {
    const user = userEvent.setup();
    render(<CopyButton text="my text" />);

    await user.click(
      screen.getByRole('button', { name: 'Copy text to clipboard' }),
    );

    expect(mockCopy).toHaveBeenCalledWith('my text');
  });

  it('shows Copied label and success aria-label when status is success', () => {
    mockStatus = 'success';
    render(<CopyButton text="hello" />);

    const button = screen.getByRole('button', {
      name: 'Text copied to clipboard',
    });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('respects disabled prop', async () => {
    const user = userEvent.setup();
    render(<CopyButton text="hello" disabled />);

    const button = screen.getByRole('button', {
      name: 'Copy text to clipboard',
    });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('defaults disabled to false when not provided', () => {
    render(<CopyButton text="hello" />);

    expect(
      screen.getByRole('button', { name: 'Copy text to clipboard' }),
    ).not.toBeDisabled();
  });

  it('applies custom className alongside default classes', () => {
    render(<CopyButton text="hello" className="custom-class" />);

    const button = screen.getByRole('button', {
      name: 'Copy text to clipboard',
    });
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveClass('flex', 'h-8', 'flex-1');
  });
});
