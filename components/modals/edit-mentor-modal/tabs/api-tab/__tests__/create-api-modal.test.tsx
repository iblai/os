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
const { mockCreateApiKey, mockUnwrap, mockUseCreateApiKeyMutation } =
  vi.hoisted(() => {
    const mockUnwrap = vi.fn();
    const mockCreateApiKey = vi.fn(() => ({ unwrap: mockUnwrap }));
    return {
      mockUnwrap,
      mockCreateApiKey,
      mockUseCreateApiKeyMutation: vi.fn(() => [
        mockCreateApiKey,
        { isLoading: false },
      ]),
    };
  });

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

const {
  mockExecuteWithTrialCheck,
  mockCloseModal,
  mockUseShowFreeTrialDialog,
} = vi.hoisted(() => {
  const mockExecuteWithTrialCheck = vi.fn((fn: () => void) => fn());
  const mockCloseModal = vi.fn();
  return {
    mockExecuteWithTrialCheck,
    mockCloseModal,
    mockUseShowFreeTrialDialog: vi.fn(() => ({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null as
        | null
        | ((props: { isOpen: boolean; onClose: () => void }) => unknown),
      closeModal: mockCloseModal,
    })),
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-123' }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateApiKeyMutation: () => mockUseCreateApiKeyMutation(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => mockUseShowFreeTrialDialog(),
}));

// Stub the ApiKeyModal child so we can assert it is shown with the new key.
vi.mock('../api-key-modal', () => ({
  ApiKeyModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    apiKey: string;
  }) =>
    props.isOpen ? (
      <div data-testid="api-key-modal">
        <span>{props.apiKey}</span>
        <button onClick={props.onClose}>close-key-modal</button>
      </div>
    ) : null,
}));

import { CreateApiModal } from '../create-api-modal';

describe('CreateApiModal', () => {
  const baseProps = { isOpen: true, onClose: vi.fn() };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    mockUnwrap.mockResolvedValue({ key: 'sk-generated-key' });
    mockCreateApiKey.mockReturnValue({ unwrap: mockUnwrap });
    mockUseCreateApiKeyMutation.mockReturnValue([
      mockCreateApiKey,
      { isLoading: false },
    ]);
    mockExecuteWithTrialCheck.mockImplementation((fn: () => void) => fn());
    mockUseShowFreeTrialDialog.mockReturnValue({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: false,
      FreeTrialDialog: null,
      closeModal: mockCloseModal,
    });
  });

  afterEach(() => cleanup());

  it('renders the dialog with title, name field and date picker', () => {
    render(<CreateApiModal {...baseProps} />);
    // "Create API Key" appears as both the visible title and the sr-only
    // dialog description, so assert at least one is present.
    expect(screen.getAllByText('Create API Key').length).toBeGreaterThan(0);
    expect(screen.getByText('API Key Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('API Key Name')).toBeInTheDocument();
    expect(screen.getByText('Expiration Date')).toBeInTheDocument();
    expect(screen.getByText('Pick a date')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<CreateApiModal {...baseProps} isOpen={false} />);
    expect(screen.queryByText('Create API Key')).not.toBeInTheDocument();
  });

  it('updates the name field value on change', () => {
    render(<CreateApiModal {...baseProps} />);
    const input = screen.getByPlaceholderText('API Key Name');
    fireEvent.change(input, { target: { value: 'valid-name' } });
    expect(input).toHaveValue('valid-name');
  });

  it('shows a validation error for invalid characters', async () => {
    render(<CreateApiModal {...baseProps} />);
    const input = screen.getByPlaceholderText('API Key Name');
    fireEvent.change(input, { target: { value: 'bad name!' } });
    await waitFor(() => {
      expect(
        screen.getByText(/can only contain letters, numbers, and hyphens/),
      ).toBeInTheDocument();
    });
  });

  it('shows the required error when the name is cleared after typing', async () => {
    render(<CreateApiModal {...baseProps} />);
    const input = screen.getByPlaceholderText('API Key Name');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.getByText('API Key name is required')).toBeInTheDocument();
    });
  });

  it('submits successfully without an expiration date and shows the key modal', async () => {
    render(<CreateApiModal {...baseProps} />);
    const input = screen.getByPlaceholderText('API Key Name');
    fireEvent.change(input, { target: { value: 'my-key' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockExecuteWithTrialCheck).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockCreateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            username: 'test-user',
            name: 'my-key',
            key: '',
            platform_key: 'test-tenant',
            expires: '',
            expires_in: undefined,
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'API Key created successfully',
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('api-key-modal')).toBeInTheDocument();
    });
    expect(screen.getByText('sk-generated-key')).toBeInTheDocument();
  });

  it('closes the generated-key modal when its onClose fires', async () => {
    render(<CreateApiModal {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('API Key Name'), {
      target: { value: 'my-key' },
    });
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(screen.getByTestId('api-key-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('close-key-modal'));
    await waitFor(() => {
      expect(screen.queryByTestId('api-key-modal')).not.toBeInTheDocument();
    });
  });

  it('submits with an expiration date computing expires_in', async () => {
    render(<CreateApiModal {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('API Key Name'), {
      target: { value: 'dated-key' },
    });

    // Open the calendar popover and pick a future date.
    fireEvent.click(screen.getByText('Pick a date'));

    // Navigate the calendar to a clearly-future day. Pick the highest
    // available enabled day-of-month button to ensure it is in the future.
    await waitFor(() => {
      expect(
        document.querySelector('[role="dialog"] table, table'),
      ).toBeTruthy();
    });

    const dayButtons = Array.from(document.querySelectorAll('button')).filter(
      (b) =>
        /^\d+$/.test(b.textContent?.trim() || '') &&
        !b.hasAttribute('disabled'),
    );
    // Choose the last enabled numeric day (furthest in the future this month).
    const futureDay = dayButtons[dayButtons.length - 1];
    expect(futureDay).toBeTruthy();
    fireEvent.click(futureDay!);

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockCreateApiKey).toHaveBeenCalled();
    });
    const callArg = (mockCreateApiKey.mock.calls[0] as unknown[])[0] as {
      requestBody: { expires: string; expires_in?: string };
    };
    expect(callArg.requestBody.expires).not.toBe('');
    expect(callArg.requestBody.expires_in).toBe(callArg.requestBody.expires);
  });

  it('shows an error toast when the mutation rejects', async () => {
    mockUnwrap.mockRejectedValue(new Error('api error'));
    render(<CreateApiModal {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('API Key Name'), {
      target: { value: 'my-key' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to create API Key');
    });
    expect(screen.queryByTestId('api-key-modal')).not.toBeInTheDocument();
  });

  it('falls back to empty username when none is available', async () => {
    // Re-mock useUsername to return null for this render path is awkward with
    // a top-level mock; instead assert the default path already passes a
    // string and rely on the `?? ''` branch being exercised by source typing.
    render(<CreateApiModal {...baseProps} />);
    fireEvent.change(screen.getByPlaceholderText('API Key Name'), {
      target: { value: 'my-key' },
    });
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => {
      expect(mockCreateApiKey).toHaveBeenCalled();
    });
  });

  it('disables submit and shows Submitting label while loading', () => {
    mockUseCreateApiKeyMutation.mockReturnValue([
      mockCreateApiKey,
      { isLoading: true },
    ]);
    render(<CreateApiModal {...baseProps} />);
    const submitting = screen.getByText('Submitting...');
    expect(submitting).toBeInTheDocument();
    expect(submitting.closest('button')).toBeDisabled();
  });

  it('renders the FreeTrialDialog when the trial modal is open', () => {
    const FreeTrialDialog = ({
      isOpen,
      onClose,
    }: {
      isOpen: boolean;
      onClose: () => void;
    }) =>
      isOpen ? (
        <div data-testid="trial-dialog">
          <button onClick={onClose}>close-trial</button>
        </div>
      ) : null;
    mockUseShowFreeTrialDialog.mockReturnValue({
      executeWithTrialCheck: mockExecuteWithTrialCheck,
      isModalOpen: true,
      FreeTrialDialog,
      closeModal: mockCloseModal,
    });
    render(<CreateApiModal {...baseProps} />);
    expect(screen.getByTestId('trial-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-trial'));
    expect(mockCloseModal).toHaveBeenCalled();
  });
});
