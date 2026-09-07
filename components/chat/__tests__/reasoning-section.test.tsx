import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

  afterEach(() => {
    cleanup();
  });

  it('returns null when reasoningContent is empty', () => {
    const { container } = render(<ReasoningSection reasoningContent="" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders reasoning content via Markdown when open', () => {
    render(<ReasoningSection reasoningContent="Let me think about this..." />);
    // Starts collapsed — click to open
    fireEvent.click(screen.getByText('Thought'));
    expect(screen.getByText('Let me think about this...')).toBeInTheDocument();
  });

  describe('label text', () => {
    it('always shows the static record label "Thought"', () => {
      render(<ReasoningSection reasoningContent="I figured it out" />);
      expect(screen.getByText('Thought')).toBeInTheDocument();
    });

    // The shimmering WorkingIndicator at the foot of the bubble owns the word
    // "Thinking" now; this trigger must never duplicate it.
    it('never shows "Thinking"', () => {
      render(<ReasoningSection reasoningContent="working..." />);
      expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
    });

    it('keeps the wording static even while the row is the live phase', () => {
      // The dots carry the liveness, never the copy.
      render(<ReasoningSection reasoningContent="working..." isActive />);
      expect(screen.getByText('Thought')).toBeInTheDocument();
      expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
    });
  });

  describe('liveness dots', () => {
    it('renders no animation for a finished record', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="working..." />,
      );
      expect(
        container.querySelector('.animate-bounce'),
      ).not.toBeInTheDocument();
      expect(container.querySelector('[class*="animate-"]')).toBeNull();
    });

    it('renders no animation when isActive is explicitly false', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="test" isActive={false} />,
      );
      expect(container.querySelector('[class*="animate-"]')).toBeNull();
    });

    it('renders three staggered bouncing dots while active', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="working..." isActive />,
      );

      const dots = container.querySelectorAll('.animate-bounce');
      expect(dots).toHaveLength(3);
      expect(dots[0].className).toContain('[animation-delay:0ms]');
      expect(dots[1].className).toContain('[animation-delay:150ms]');
      expect(dots[2].className).toContain('[animation-delay:300ms]');
    });

    it('freezes the dots for users who prefer reduced motion', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="working..." isActive />,
      );

      container.querySelectorAll('.animate-bounce').forEach((dot) => {
        expect(dot.className).toContain('motion-reduce:animate-none');
      });
    });

    it('hides the decorative dots from assistive tech', () => {
      // The polite live region on the working line is what announces progress.
      const { container } = render(
        <ReasoningSection reasoningContent="working..." isActive />,
      );

      expect(
        container.querySelector('[aria-hidden="true"] .animate-bounce'),
      ).toBeInTheDocument();
    });
  });

  describe('thought-process delimiter splitting', () => {
    it('renders two separate step blocks for content with **** and no literal **** in DOM', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="Preparing first lesson greeting****Planning first lesson content" />,
      );
      fireEvent.click(screen.getByText('Thought'));

      const blocks = container.querySelectorAll('[data-testid="markdown"]');
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toHaveTextContent('Preparing first lesson greeting');
      expect(blocks[1]).toHaveTextContent('Planning first lesson content');
      expect(container.innerHTML).not.toContain('****');
    });

    it('splits a bold span unclosed across blank lines into clean steps', () => {
      const { container } = render(
        <ReasoningSection
          reasoningContent={
            "**Assessing Portugal's World Cup match timing\n\nRequesting tournament clarification\n\nPreparing clarifying question with LaTeX**"
          }
        />,
      );
      fireEvent.click(screen.getByText('Thought'));

      const blocks = container.querySelectorAll('[data-testid="markdown"]');
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toHaveTextContent(
        "Assessing Portugal's World Cup match timing",
      );
      expect(blocks[1]).toHaveTextContent(
        'Requesting tournament clarification',
      );
      expect(blocks[2]).toHaveTextContent(
        'Preparing clarifying question with LaTeX',
      );
      expect(container.innerHTML).not.toContain('**');
    });

    it('filters mixed asterisk and blank-line delimiters into clean steps', () => {
      const { container } = render(
        <ReasoningSection reasoningContent={'a****\n****b**\n\n  **c'} />,
      );
      fireEvent.click(screen.getByText('Thought'));

      const blocks = container.querySelectorAll('[data-testid="markdown"]');
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toHaveTextContent('a');
      expect(blocks[1]).toHaveTextContent('b');
      expect(blocks[2]).toHaveTextContent('c');
      expect(container.innerHTML).not.toContain('**');
    });

    it('renders a bold-wrapped single step with asterisks stripped', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="**Just thinking**" />,
      );
      fireEvent.click(screen.getByText('Thought'));

      const blocks = container.querySelectorAll('[data-testid="markdown"]');
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toHaveTextContent('Just thinking');
      expect(container.innerHTML).not.toContain('**');
    });

    it('falls back to raw content when nothing parseable remains', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="****" />,
      );
      fireEvent.click(screen.getByText('Thought'));

      const blocks = container.querySelectorAll('[data-testid="markdown"]');
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toHaveTextContent('****');
    });

    it('renders content without **** unchanged as a single block', () => {
      const { container } = render(
        <ReasoningSection reasoningContent="Just a normal reasoning blob" />,
      );
      fireEvent.click(screen.getByText('Thought'));

      const blocks = container.querySelectorAll('[data-testid="markdown"]');
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toHaveTextContent('Just a normal reasoning blob');
    });
  });

  describe('toggle behavior', () => {
    it('toggles open/closed on click', () => {
      render(<ReasoningSection reasoningContent="Some reasoning" />);
      const trigger = screen.getByText('Thought');

      // Click to open
      fireEvent.click(trigger);
      expect(screen.getByTestId('markdown')).toBeVisible();

      // Click to close
      fireEvent.click(trigger);
    });
  });

  describe('collapsed by default', () => {
    it('starts collapsed, with the reasoning body hidden', () => {
      render(<ReasoningSection reasoningContent="thinking..." />);
      expect(screen.getByText('Thought')).toBeInTheDocument();
      expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();
    });

    it('can be manually opened by clicking', () => {
      render(<ReasoningSection reasoningContent="reasoning" />);

      // Manually reopen
      fireEvent.click(screen.getByText('Thought'));
      expect(screen.getByTestId('markdown')).toBeVisible();
    });
  });
});
