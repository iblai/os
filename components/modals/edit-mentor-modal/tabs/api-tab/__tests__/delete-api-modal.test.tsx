import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';

// ---- Hoisted mocks ----
const { mockDeleteApiKey, mockUnwrap, mockUseDeleteApiKeyMutation } =
  vi.hoisted(() => {
    const mockUnwrap = vi.fn();
    const mockDeleteApiKey = vi.fn(() => ({ unwrap: mockUnwrap }));
    return {
      mockUnwrap,
      mockDeleteApiKey,
      mockUseDeleteApiKeyMutation: vi.fn(() => [
        mockDeleteApiKey,
        { isLoading: false },
      ]),
    };
  });

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-123' }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useDeleteApiKeyMutation: () => mockUseDeleteApiKeyMutation(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import { DeleteApiModal } from '../delete-api-modal';

describe('DeleteApiModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    apiKey: { name: 'my-key' },
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
    mockDeleteApiKey.mockReturnValue({ unwrap: mockUnwrap });
    mockUseDeleteApiKeyMutation.mockReturnValue([
      mockDeleteApiKey,
      { isLoading: false },
    ]);
  });

  afterEach(() => cleanup());

  it('renders the confirmation message including the key name', () => {
    render(<DeleteApiModal {...baseProps} />);
    expect(screen.getByText('Delete API Key')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete the API Key/),
    ).toBeInTheDocument();
    expect(screen.getByText('my-key')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<DeleteApiModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('deletes the key, shows success toast and closes on success', async () => {
    const onClose = vi.fn();
    render(<DeleteApiModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteApiKey).toHaveBeenCalledWith({
        name: 'my-key',
        platformKey: 'test-tenant',
      });
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'API Key deleted successfully',
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error toast and does not close on failure', async () => {
    mockUnwrap.mockRejectedValue(new Error('boom'));
    const onClose = vi.fn();
    render(<DeleteApiModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to delete API Key');
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the delete button and shows Deleting label while loading', () => {
    mockUseDeleteApiKeyMutation.mockReturnValue([
      mockDeleteApiKey,
      { isLoading: true },
    ]);
    render(<DeleteApiModal {...baseProps} />);
    const deletingButton = screen.getByText('Deleting...');
    expect(deletingButton).toBeInTheDocument();
    expect(deletingButton.closest('button')).toBeDisabled();
  });

  it('calls onClose via dialog onOpenChange (Escape)', () => {
    const onClose = vi.fn();
    render(<DeleteApiModal {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
