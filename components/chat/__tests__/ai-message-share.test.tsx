import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { AIMessageShare } from '../ai-message-share';

// Mocks
const mockCopy = vi.fn();
const mockUpdateChatSession = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
let mockCopyStatus: 'idle' | 'success' = 'idle';
let mockMutationIsLoading = false;
let mockUsername: string | null = 'test-user';

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({
    copy: mockCopy,
    status: mockCopyStatus,
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useUpdateChatSessionSharedMutation: () => [
    mockUpdateChatSession,
    { isLoading: mockMutationIsLoading },
  ],
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername,
}));

vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

describe('AIMessageShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopyStatus = 'idle';
    mockMutationIsLoading = false;
    mockUsername = 'test-user';
    mockUpdateChatSession.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });
  });

  it('renders share button with aria-label and visible "Share" label', () => {
    const { container } = render(
      <AIMessageShare sessionId="session-123" tenantKey="main" />,
    );

    expect(screen.getByLabelText('Share this chat')).toBeInTheDocument();
    // The "Share" label is inside the button (visible at lg+, hidden below).
    const buttonLabel = container.querySelector('button > span');
    expect(buttonLabel).toHaveTextContent('Share');
  });

  it('uses the navbar-style color palette matching the notifications icon', () => {
    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    const button = screen.getByLabelText('Share this chat');
    expect(button.className).toContain('text-[#646464]');
    expect(button.className).toContain('hover:text-[#484848]');
  });

  it('hides the "Share" text on small screens via responsive CSS', () => {
    const { container } = render(
      <AIMessageShare sessionId="session-123" tenantKey="main" />,
    );

    const buttonLabel = container.querySelector('button > span');
    expect(buttonLabel).toBeTruthy();
    // `hidden lg:inline` → hidden below the lg breakpoint, inline at lg+.
    expect(buttonLabel!.className).toContain('hidden');
    expect(buttonLabel!.className).toContain('lg:inline');
  });

  it('calls updateChatSession and copies URL on click', async () => {
    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockUpdateChatSession).toHaveBeenCalledWith({
        org: 'main',
        sessionId: 'session-123',
        userId: 'test-user',
        requestBody: {
          is_shared: true,
        },
      });
    });

    await waitFor(() => {
      expect(mockCopy).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Share link copied to clipboard',
      );
    });
  });

  it('shows error toast on mutation failure', async () => {
    mockUpdateChatSession.mockReturnValue({
      unwrap: () => Promise.reject(new Error('API Error')),
    });

    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to share chat');
    });

    // Copy is called before the API call (for Safari clipboard gesture support)
    expect(mockCopy).toHaveBeenCalledWith(
      'http://localhost:3000/share/chat/session-123',
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('displays correct tooltip text', () => {
    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Share');
  });

  it('shows the loading spinner and "Sharing..." tooltip while the mutation is in flight', () => {
    mockMutationIsLoading = true;
    const { container } = render(
      <AIMessageShare sessionId="session-123" tenantKey="main" />,
    );

    const spinner = container.querySelector('svg.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'Sharing...',
    );
    expect(screen.getByLabelText('Share this chat')).toBeDisabled();
  });

  it('shows the copied checkmark icon and "Copied" tooltip after a successful share', () => {
    mockCopyStatus = 'success';
    const { container } = render(
      <AIMessageShare sessionId="session-123" tenantKey="main" />,
    );

    const check = container.querySelector('svg.text-blue-500');
    expect(check).toBeInTheDocument();
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Copied');
  });

  it('falls back to the anonymous username when the user is not logged in', async () => {
    mockUsername = null;
    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockUpdateChatSession).toHaveBeenCalledWith(
        expect.objectContaining({ userId: expect.any(String) }),
      );
    });

    const call = mockUpdateChatSession.mock.calls[0][0];
    expect(call.userId).not.toBe('test-user');
    expect(call.userId.length).toBeGreaterThan(0);
  });

  it('logs the error to console when the mutation rejects', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockUpdateChatSession.mockReturnValue({
      unwrap: () => Promise.reject(new Error('API Error')),
    });

    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error sharing chat:',
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
