import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Message } from '@iblai/iblai-js/web-utils';
import { AIMessageRating } from '../ai-message-rating';
import { TooltipProvider } from '@/components/ui/tooltip';

// ============================================================================
// MOCKS
// ============================================================================

const mockUpdateFeedback = vi.fn();
const mockUnwrap = vi.fn();
let mockIsLoading = false;

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useUpdateMessageFeedbackMutation: () => [
    (...args: unknown[]) => {
      mockUpdateFeedback(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: mockIsLoading },
  ],
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'test-user',
}));

const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

const messages: Message[] = [
  { id: 'm1', role: 'user', content: 'first user question' } as Message,
  { id: 'm2', role: 'assistant', content: 'assistant reply 1' } as Message,
  { id: 'm3', role: 'user', content: 'second user question' } as Message,
  {
    id: 'session-1',
    role: 'assistant',
    content: 'current ai reply',
  } as Message,
];

function renderRating(
  overrides: Partial<React.ComponentProps<typeof AIMessageRating>> = {},
) {
  const props = {
    content: 'current ai reply',
    messages,
    sessionId: 'session-1',
    mentorId: 'mentor-123',
    tenantKey: 'test-tenant',
    ...overrides,
  };
  return render(
    <TooltipProvider>
      <AIMessageRating {...props} />
    </TooltipProvider>,
  );
}

describe('AIMessageRating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockUnwrap.mockResolvedValue({});
  });

  it('renders thumbs up and thumbs down buttons with screen-reader text', () => {
    renderRating();
    expect(screen.getByText('Positive Feedback Thumbs Up')).toBeInTheDocument();
    expect(
      screen.getByText('Negative Feedback Thumbs Down'),
    ).toBeInTheDocument();
  });

  it('submits a positive rating and marks the thumbs-up as selected', async () => {
    const user = userEvent.setup();
    renderRating();

    const upButton = screen
      .getByText('Positive Feedback Thumbs Up')
      .closest('button')!;
    await user.click(upButton);

    await waitFor(() => {
      expect(mockUpdateFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          org: 'test-tenant',
          userId: 'test-user',
          requestBody: expect.objectContaining({
            rating: 1,
            ai_response: 'current ai reply',
            user_text: 'second user question',
            session: 'session-1',
            mentor: 'mentor-123',
            username: 'test-user',
            reason: 'Good response',
            additional_feedback: 'Good response',
          }),
        }),
      );
    });

    // Selected styling applied to the thumbs-up icon
    await waitFor(() => {
      const svg = upButton.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('fill-gray-400');
    });
  });

  it('submits a negative rating with the bad-response reason', async () => {
    const user = userEvent.setup();
    renderRating();

    const downButton = screen
      .getByText('Negative Feedback Thumbs Down')
      .closest('button')!;
    await user.click(downButton);

    await waitFor(() => {
      expect(mockUpdateFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            rating: -1,
            reason: 'Bad response',
            additional_feedback: 'Bad response',
          }),
        }),
      );
    });

    await waitFor(() => {
      const svg = downButton.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('fill-gray-400');
    });
  });

  it('shows an error toast when feedback submission fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUnwrap.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderRating();

    const upButton = screen
      .getByText('Positive Feedback Thumbs Up')
      .closest('button')!;
    await user.click(upButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to update message feedback',
      );
    });

    // The rating should NOT be marked selected on failure
    const svg = upButton.querySelector('svg');
    expect(svg?.getAttribute('class')).not.toContain('fill-gray-400');

    consoleSpy.mockRestore();
  });

  it('disables both buttons while the mutation is loading', () => {
    mockIsLoading = true;
    renderRating();

    expect(
      screen.getByText('Positive Feedback Thumbs Up').closest('button'),
    ).toBeDisabled();
    expect(
      screen.getByText('Negative Feedback Thumbs Down').closest('button'),
    ).toBeDisabled();
  });

  it('falls back to empty user_text when no preceding user message exists', async () => {
    const user = userEvent.setup();
    renderRating({
      messages: [
        {
          id: 'session-1',
          role: 'assistant',
          content: 'only reply',
        } as Message,
      ],
    });

    const upButton = screen
      .getByText('Positive Feedback Thumbs Up')
      .closest('button')!;
    await user.click(upButton);

    await waitFor(() => {
      expect(mockUpdateFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ user_text: '' }),
        }),
      );
    });
  });

  it('shows the positive feedback tooltip on hover', async () => {
    const user = userEvent.setup();
    renderRating();

    await user.hover(
      screen.getByText('Positive Feedback Thumbs Up').closest('button')!,
    );

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Positive Feedback');
  });
});
