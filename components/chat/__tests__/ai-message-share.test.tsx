import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { AIMessageShare } from '../ai-message-share';

// Mocks
const mockCopy = vi.fn();
const mockUpdateChatSession = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/hooks/use-copy-to-clipboard', () => ({
  useCopyToClipboard: () => ({
    copy: mockCopy,
    status: 'idle',
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useUpdateChatSessionSharedMutation: () => [mockUpdateChatSession, { isLoading: false }],
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
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
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
}));

describe('AIMessageShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateChatSession.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });
  });

  it('renders share button', () => {
    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Share this chat')).toBeInTheDocument();
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
      expect(mockToastSuccess).toHaveBeenCalledWith('Share link copied to clipboard');
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
    expect(mockCopy).toHaveBeenCalledWith('http://localhost:3000/share/chat/session-123');
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('displays correct tooltip text', () => {
    render(<AIMessageShare sessionId="session-123" tenantKey="main" />);

    expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Share');
  });
});
