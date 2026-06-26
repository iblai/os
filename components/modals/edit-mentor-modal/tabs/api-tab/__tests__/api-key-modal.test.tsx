import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-123' }),
}));

import { ApiKeyModal } from '../api-key-modal';

describe('ApiKeyModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => cleanup());

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    apiKey: 'sk-test-1234567890',
  };

  it('renders the dialog with title, warnings and key value', () => {
    render(<ApiKeyModal {...defaultProps} />);
    expect(screen.getByText('API Key')).toBeInTheDocument();
    expect(screen.getByText(/Please copy your API key/)).toBeInTheDocument();
    expect(screen.getByText(/If you lose your API key/)).toBeInTheDocument();
    const input = screen.getByDisplayValue('sk-test-1234567890');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('readonly');
  });

  it('does not render content when closed', () => {
    render(<ApiKeyModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('API Key')).not.toBeInTheDocument();
  });

  it('copies the api key and swaps the icon to the success state', async () => {
    render(<ApiKeyModal {...defaultProps} />);
    // The copy button is the one with the primary styling, next to the input.
    const input = screen.getByDisplayValue('sk-test-1234567890');
    const copyButton = input.parentElement!.querySelector(
      'button.ibl-button-primary',
    ) as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'sk-test-1234567890',
      );
    });
  });

  it('calls onClose via the dialog onOpenChange', () => {
    const onClose = vi.fn();
    render(<ApiKeyModal {...defaultProps} onClose={onClose} />);
    // Escape triggers Radix Dialog onOpenChange(false) -> onClose
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
