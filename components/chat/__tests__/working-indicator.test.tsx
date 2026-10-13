import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ChatPhase } from '@iblai/iblai-js/web-utils';

import {
  WorkingIndicator,
  LONG_TURN_REASSURANCE_DELAY_MS,
  PHASE_ANNOUNCE_THROTTLE_MS,
  STALLED_STREAM_DELAY_MS,
} from '../working-indicator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CSS_CLASS_NAMES } from '@/lib/constants';

const mockMatchMedia = (matches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeEventListener: (
      _type: string,
      cb: (e: MediaQueryListEvent) => void,
    ) => listeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn(() => mql),
  });
  return {
    mql,
    emit: (next: boolean) => {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
};

type IndicatorProps = {
  restatedByVisibleRow?: boolean;
  content?: string;
};

const STILL_WORKING = 'Still working — longer tasks can take a few minutes.';

const renderIndicator = (phase: ChatPhase, props: IndicatorProps = {}) =>
  render(
    <TooltipProvider>
      <WorkingIndicator phase={phase} {...props} />
    </TooltipProvider>,
  );

describe('WorkingIndicator', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia(false);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it('renders nothing when the turn is idle', () => {
    renderIndicator({ kind: 'idle' });

    expect(
      screen.queryByTestId('chat-working-indicator'),
    ).not.toBeInTheDocument();
  });

  it('renders a polite status region with the shared css class', () => {
    renderIndicator({ kind: 'thinking' });

    const indicator = screen.getByTestId('chat-working-indicator');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).not.toHaveAttribute('aria-live', 'assertive');
    expect(indicator).toHaveClass(CSS_CLASS_NAMES.CHAT.WORKING_INDICATOR);
  });

  describe('phase labels', () => {
    it.each([
      [{ kind: 'thinking' } as ChatPhase, 'Thinking…'],
      [{ kind: 'tool', name: 'wikipedia' } as ChatPhase, 'Using wikipedia…'],
      [{ kind: 'writing' } as ChatPhase, 'Writing response…'],
      [{ kind: 'workflow' } as ChatPhase, 'Running workflow…'],
      [
        { kind: 'workflow', detail: 'Searching documents' } as ChatPhase,
        'Searching documents…',
      ],
      [
        { kind: 'file', fileName: 'notes.pdf' } as ChatPhase,
        'Processing notes.pdf…',
      ],
      [
        {
          kind: 'file',
          fileName: 'notes.pdf',
          current: 1,
          total: 3,
        } as ChatPhase,
        'Processing notes.pdf (1 of 3)…',
      ],
      [{ kind: 'media', medium: 'image' } as ChatPhase, 'Generating image…'],
      [{ kind: 'media', medium: 'video' } as ChatPhase, 'Generating video…'],
    ])('renders %j as its own label', (phase, expected) => {
      renderIndicator(phase);

      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('defaults the file phase to the generic label without a file name', () => {
      renderIndicator({ kind: 'file' });

      expect(screen.getByText('Working…')).toBeInTheDocument();
    });

    it('defaults to the generic label for an unrecognised phase', () => {
      renderIndicator({ kind: 'something-new' } as unknown as ChatPhase);

      expect(screen.getByText('Working…')).toBeInTheDocument();
    });

    it('falls back to a count of 1 when only a total is reported', () => {
      renderIndicator({ kind: 'file', fileName: 'notes.pdf', total: 2 });

      expect(
        screen.getByText('Processing notes.pdf (1 of 2)…'),
      ).toBeInTheDocument();
    });
  });

  describe('long turns', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('swaps in the reassurance copy after 20s without tokens', () => {
      renderIndicator({ kind: 'thinking' });

      expect(screen.getByText('Thinking…')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(LONG_TURN_REASSURANCE_DELAY_MS);
      });

      expect(
        screen.getByText(
          'Still working — longer tasks can take a few minutes.',
        ),
      ).toBeInTheDocument();
    });

    it('does not show the reassurance copy while tokens are arriving', () => {
      renderIndicator({ kind: 'writing' });

      act(() => {
        vi.advanceTimersByTime(LONG_TURN_REASSURANCE_DELAY_MS * 2);
      });

      expect(screen.getByText('Writing response…')).toBeInTheDocument();
      expect(
        screen.queryByText(
          'Still working — longer tasks can take a few minutes.',
        ),
      ).not.toBeInTheDocument();
    });

    it('clears the reassurance copy once tokens start arriving', () => {
      const { rerender } = renderIndicator({ kind: 'thinking' });

      act(() => {
        vi.advanceTimersByTime(LONG_TURN_REASSURANCE_DELAY_MS);
      });
      expect(
        screen.getByText(
          'Still working — longer tasks can take a few minutes.',
        ),
      ).toBeInTheDocument();

      rerender(
        <TooltipProvider>
          <WorkingIndicator phase={{ kind: 'writing' }} />
        </TooltipProvider>,
      );
      act(() => {
        vi.advanceTimersByTime(PHASE_ANNOUNCE_THROTTLE_MS);
      });

      expect(screen.getByText('Writing response…')).toBeInTheDocument();
    });

    it('throttles rapid phase changes so the live region is not flooded', () => {
      const { rerender } = renderIndicator({ kind: 'tool', name: 'wikipedia' });

      expect(screen.getByText('Using wikipedia…')).toBeInTheDocument();

      rerender(
        <TooltipProvider>
          <WorkingIndicator phase={{ kind: 'tool', name: 'web_search' }} />
        </TooltipProvider>,
      );

      // Still the previous label: the throttle window has not elapsed.
      expect(screen.getByText('Using wikipedia…')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(PHASE_ANNOUNCE_THROTTLE_MS);
      });

      expect(screen.getByText('Using web_search…')).toBeInTheDocument();
    });

    it('announces the newest phase when several land inside one window', () => {
      const { rerender } = renderIndicator({ kind: 'thinking' });

      const renderPhase = (phase: ChatPhase) =>
        rerender(
          <TooltipProvider>
            <WorkingIndicator phase={phase} />
          </TooltipProvider>,
        );

      renderPhase({ kind: 'tool', name: 'wikipedia' });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      renderPhase({ kind: 'tool', name: 'web_search' });

      act(() => {
        vi.advanceTimersByTime(PHASE_ANNOUNCE_THROTTLE_MS);
      });

      expect(screen.getByText('Using web_search…')).toBeInTheDocument();
    });
  });

  // Governing principle: the status line is only on screen when nothing else is
  // conveying progress.
  describe('standing down', () => {
    it('renders nothing once a visible row already states the phase', () => {
      renderIndicator({ kind: 'thinking' }, { restatedByVisibleRow: true });

      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();
    });

    it('renders the phase when no row is restating it', () => {
      renderIndicator({ kind: 'thinking' }, { restatedByVisibleRow: false });

      expect(screen.getByText('Thinking…')).toBeInTheDocument();
    });

    it('renders nothing while answer tokens are visible in the bubble', () => {
      renderIndicator({ kind: 'writing' }, { content: 'Here is the answer' });

      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();
    });

    it('still labels the writing phase before the first token lands', () => {
      // The phase flips off the socket frame ahead of the token reaching the
      // bubble; showing nothing in that window would be a flash of emptiness.
      renderIndicator({ kind: 'writing' }, { content: '' });

      expect(screen.getByText('Writing response…')).toBeInTheDocument();
    });

    it('counts whitespace-only content as nothing to watch', () => {
      renderIndicator({ kind: 'writing' }, { content: '   \n  ' });

      expect(screen.getByText('Writing response…')).toBeInTheDocument();
    });

    it('keeps non-writing phases up even with text already on screen', () => {
      // A tool call after a partial answer: the text is frozen, so the line is
      // the only thing reporting progress.
      renderIndicator(
        { kind: 'tool', name: 'wikipedia' },
        { content: 'Partial answer so far' },
      );

      expect(screen.getByText('Using wikipedia…')).toBeInTheDocument();
    });
  });

  describe('stalled streams', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const renderWriting = (content: string) => {
      const utils = renderIndicator({ kind: 'writing' }, { content });
      return {
        ...utils,
        streamToken: (next: string) =>
          utils.rerender(
            <TooltipProvider>
              <WorkingIndicator phase={{ kind: 'writing' }} content={next} />
            </TooltipProvider>,
          ),
      };
    };

    it('brings the line back once the text has visibly stopped moving', () => {
      // The phase sticks at `writing` after the last token, so this is the only
      // signal a mid-turn grind produces.
      renderWriting('Two sentences so far.');
      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS);
      });

      expect(screen.getByText(STILL_WORKING)).toBeInTheDocument();
    });

    it('keeps the stall clock running for the whole window while hidden', () => {
      // Nothing unmounts the component to hide it, so the timer started by the
      // first token is the one that fires — and not a moment early.
      renderWriting('One.');

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS - 1);
      });
      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByTestId('chat-working-indicator')).toBeInTheDocument();
    });

    it('restarts the clock on every fresh token', () => {
      const { streamToken } = renderWriting('One.');

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS - 1_000);
      });
      streamToken('One. Two.');
      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS - 1_000);
      });

      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByText(STILL_WORKING)).toBeInTheDocument();
    });

    it('stands down again when tokens resume after a stall', () => {
      const { streamToken } = renderWriting('One.');

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS);
      });
      expect(screen.getByText(STILL_WORKING)).toBeInTheDocument();

      streamToken('One. Two.');

      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();
    });

    it('does not stall a writing turn that has produced no text', () => {
      renderIndicator({ kind: 'writing' }, { content: '' });

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS);
      });

      expect(screen.getByText('Writing response…')).toBeInTheDocument();
      expect(screen.queryByText(STILL_WORKING)).not.toBeInTheDocument();
    });

    it('leaves non-writing phases on their own label inside the window', () => {
      // 15s is the budget for text that stopped moving; a tool call gets the
      // longer 20s reassurance instead.
      renderIndicator(
        { kind: 'tool', name: 'wikipedia' },
        { content: 'Partial answer' },
      );

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS);
      });

      expect(screen.getByText('Using wikipedia…')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(
          LONG_TURN_REASSURANCE_DELAY_MS - STALLED_STREAM_DELAY_MS,
        );
      });

      expect(screen.getByText(STILL_WORKING)).toBeInTheDocument();
    });

    it('restarts the clock when a long tool call hands back to writing', () => {
      // Otherwise a turn that spent a minute in a tool would come back from it
      // already declared stalled, on text it never had a chance to extend.
      const { rerender } = renderIndicator(
        { kind: 'tool', name: 'wikipedia' },
        { content: 'One.' },
      );

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS * 2);
      });

      rerender(
        <TooltipProvider>
          <WorkingIndicator phase={{ kind: 'writing' }} content="One." />
        </TooltipProvider>,
      );

      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS);
      });

      expect(screen.getByText(STILL_WORKING)).toBeInTheDocument();
    });

    it('drops the stall clock when the turn goes idle', () => {
      renderIndicator({ kind: 'idle' }, { content: 'Finished answer.' });

      act(() => {
        vi.advanceTimersByTime(STALLED_STREAM_DELAY_MS * 2);
      });

      expect(
        screen.queryByTestId('chat-working-indicator'),
      ).not.toBeInTheDocument();
    });
  });

  describe('reduced motion', () => {
    it('shimmers the label by default', () => {
      const { container } = renderIndicator({ kind: 'thinking' });

      const label = container.querySelector('.ibl-text-shimmer');
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent('Thinking…');
      // Belt and braces alongside the CSS media query.
      expect(label).toHaveClass('motion-reduce:animate-none');
    });

    it('renders flat static text when reduced motion is preferred', () => {
      mockMatchMedia(true);
      const { container } = renderIndicator({ kind: 'thinking' });

      expect(
        container.querySelector('.ibl-text-shimmer'),
      ).not.toBeInTheDocument();
      const label = screen.getByText('Thinking…');
      expect(label).toHaveClass('text-muted-foreground');
    });

    it('reacts to the preference changing while a turn is running', () => {
      const { emit } = mockMatchMedia(false);
      const { container } = renderIndicator({ kind: 'thinking' });

      expect(container.querySelector('.ibl-text-shimmer')).toBeInTheDocument();

      act(() => {
        emit(true);
      });

      expect(
        container.querySelector('.ibl-text-shimmer'),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Thinking…')).toHaveClass(
        'text-muted-foreground',
      );
    });

    it('degrades to motion when matchMedia is unavailable', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: undefined,
      });

      const { container } = renderIndicator({ kind: 'thinking' });

      expect(container.querySelector('.ibl-text-shimmer')).toBeInTheDocument();
    });
  });

  it('does not render its own Stop control — the composer owns that', () => {
    renderIndicator({ kind: 'tool', name: 'wikipedia' });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
