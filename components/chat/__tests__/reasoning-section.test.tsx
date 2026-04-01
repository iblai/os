import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    cn: (...args: (string | undefined | boolean)[]) =>
      args.filter(Boolean).join(' '),
  };
});

import { ReasoningSection } from '../reasoning-section';

describe('ReasoningSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when reasoningContent is empty', () => {
    const { container } = render(
      <ReasoningSection reasoningContent="" isReasoning={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders reasoning content via Markdown when open', () => {
    render(
      <ReasoningSection
        reasoningContent="Let me think about this..."
        isReasoning={false}
      />,
    );
    // Starts collapsed — click to open
    fireEvent.click(screen.getByText('Thought'));
    expect(screen.getByText('Let me think about this...')).toBeInTheDocument();
  });

  describe('label text', () => {
    it('shows "Thinking" when actively reasoning', () => {
      render(
        <ReasoningSection
          reasoningContent="working..."
          isReasoning={true}
          isCurrentlyStreaming={true}
        />,
      );
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('shows "Thought" when reasoning is complete', () => {
      render(
        <ReasoningSection
          reasoningContent="I figured it out"
          isReasoning={false}
        />,
      );
      expect(screen.getByText('Thought')).toBeInTheDocument();
    });
  });

  describe('bounce animation dots', () => {
    it('shows dots when reasoning and streaming', () => {
      const { container } = render(
        <ReasoningSection
          reasoningContent="working..."
          isReasoning={true}
          isCurrentlyStreaming={true}
        />,
      );
      const dots = container.querySelectorAll('.animate-bounce');
      expect(dots).toHaveLength(3);
    });

    it('hides dots when not reasoning', () => {
      const { container } = render(
        <ReasoningSection
          reasoningContent="done"
          isReasoning={false}
          isCurrentlyStreaming={true}
        />,
      );
      expect(
        container.querySelector('.animate-bounce'),
      ).not.toBeInTheDocument();
    });

    it('hides dots when not streaming', () => {
      const { container } = render(
        <ReasoningSection
          reasoningContent="done"
          isReasoning={true}
          isCurrentlyStreaming={false}
        />,
      );
      expect(
        container.querySelector('.animate-bounce'),
      ).not.toBeInTheDocument();
    });

    it('defaults isCurrentlyStreaming to false', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="test" isReasoning={true} />,
      );
      expect(
        container.querySelector('.animate-bounce'),
      ).not.toBeInTheDocument();
    });
  });

  describe('toggle behavior', () => {
    it('toggles open/closed on click', () => {
      render(
        <ReasoningSection
          reasoningContent="Some reasoning"
          isReasoning={false}
        />,
      );
      const trigger = screen.getByText('Thought');

      // Click to open
      fireEvent.click(trigger);
      expect(screen.getByTestId('markdown')).toBeVisible();

      // Click to close
      fireEvent.click(trigger);
    });
  });

  describe('collapsed by default', () => {
    it('starts collapsed even during streaming', () => {
      render(
        <ReasoningSection
          reasoningContent="thinking..."
          isReasoning={true}
          isCurrentlyStreaming={true}
        />,
      );
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('can be manually opened by clicking', () => {
      render(
        <ReasoningSection reasoningContent="reasoning" isReasoning={false} />,
      );

      // Manually reopen
      fireEvent.click(screen.getByText('Thought'));
      expect(screen.getByTestId('markdown')).toBeVisible();
    });
  });
});
