import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { Todo } from '@iblai/iblai-js/web-utils';

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    cn: (...args: (string | undefined | boolean)[]) =>
      args.filter(Boolean).join(' '),
  };
});

import { AgentTodoList, TODO_ANNOUNCE_THROTTLE_MS } from '../agent-todo-list';

const todo = (content: string, status: Todo['status']): Todo => ({
  content,
  status,
});

const MIXED: Todo[] = [
  todo('Read the brief', 'completed'),
  todo('Draft the outline', 'in_progress'),
  todo('Write the summary', 'pending'),
];

describe('AgentTodoList', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('no affordance when there is nothing to show', () => {
    it('renders null when todos is undefined', () => {
      const { container } = render(<AgentTodoList todos={undefined} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders null when todos is an empty array', () => {
      const { container } = render(<AgentTodoList todos={[]} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders no live region when there are no todos', () => {
      render(<AgentTodoList todos={[]} />);
      expect(
        screen.queryByTestId('agent-todo-list-announcer'),
      ).not.toBeInTheDocument();
    });
  });

  describe('list semantics', () => {
    it('renders the todos as a real ordered list', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      const list = screen.getByRole('list');
      expect(list.tagName).toBe('OL');
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('renders one list item per todo, with its content', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      expect(screen.getByText('Read the brief')).toBeInTheDocument();
      expect(screen.getByText('Draft the outline')).toBeInTheDocument();
      expect(screen.getByText('Write the summary')).toBeInTheDocument();
    });

    it('keeps duplicate todo contents as separate rows', () => {
      render(
        <AgentTodoList
          todos={[todo('Same', 'pending'), todo('Same', 'pending')]}
          isCurrentlyStreaming
        />,
      );
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
  });

  describe('status cues (never colour alone)', () => {
    it('exposes every status to assistive tech without showing a label', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      // The status word is deliberately sr-only: sighted users read the icon
      // shape, screen readers still hear the status. Dropping the word from the
      // DOM entirely would leave colour as the only cue (WCAG 1.4.1).
      for (const label of ['Done', 'In progress', 'To do']) {
        expect(screen.getByText(label)).toHaveClass('sr-only');
      }
    });

    it('shows no status text visually on a row', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      screen.getAllByTestId('agent-todo-item').forEach((row) => {
        const visibleText = Array.from(row.querySelectorAll('span'))
          .filter((span) => !span.classList.contains('sr-only'))
          .map((span) => span.textContent)
          .join(' ');
        expect(visibleText).not.toMatch(/Done|In progress|To do/);
      });
    });

    it('marks each row with its status for styling and assertions', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      const rows = screen.getAllByTestId('agent-todo-item');
      expect(rows.map((row) => row.getAttribute('data-status'))).toEqual([
        'completed',
        'in_progress',
        'pending',
      ]);
    });

    it('shimmers only the in-progress row text', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      const shimmering = screen
        .getAllByTestId('agent-todo-item')
        .filter((row) => row.querySelector('.todo-shimmer') !== null);

      expect(shimmering).toHaveLength(1);
      expect(shimmering[0]).toHaveAttribute('data-status', 'in_progress');
    });

    it('shimmers the content text itself, not the whole row', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      const row = screen
        .getAllByTestId('agent-todo-item')
        .find((r) => r.getAttribute('data-status') === 'in_progress')!;
      const shimmer = row.querySelector('.todo-shimmer');

      // The gradient is clipped to the glyphs, so the class must sit on the
      // element holding the todo text — not the <li> and not the icon.
      expect(shimmer).toHaveTextContent('Draft the outline');
      expect(shimmer?.tagName).toBe('SPAN');
    });

    it('stops shimmering once a step completes', () => {
      const { container } = render(
        <AgentTodoList
          todos={[todo('Ship it', 'completed')]}
          isCurrentlyStreaming
        />,
      );

      expect(container.querySelector('.todo-shimmer')).not.toBeInTheDocument();
    });

    it('renders an icon alongside the label for every row', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);

      screen.getAllByTestId('agent-todo-item').forEach((row) => {
        expect(row.querySelector('svg')).toBeInTheDocument();
      });
    });

    it('renders an unknown status as pending rather than dropping the row', () => {
      render(
        <AgentTodoList
          todos={[{ content: 'Mystery step', status: 'wat' as Todo['status'] }]}
          isCurrentlyStreaming
        />,
      );

      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByText('Mystery step')).toBeInTheDocument();
      expect(screen.getByText('To do')).toBeInTheDocument();
    });
  });

  describe('progress summary', () => {
    it('summarises how many todos are done', () => {
      render(<AgentTodoList todos={MIXED} />);
      expect(screen.getByTestId('agent-todo-list-progress')).toHaveTextContent(
        '1 of 3 done',
      );
    });

    it('counts every completed todo', () => {
      render(
        <AgentTodoList
          todos={[
            todo('a', 'completed'),
            todo('b', 'completed'),
            todo('c', 'pending'),
          ]}
        />,
      );
      expect(screen.getByTestId('agent-todo-list-progress')).toHaveTextContent(
        '2 of 3 done',
      );
    });

    it('shows the panel title', () => {
      render(<AgentTodoList todos={MIXED} />);
      expect(screen.getByText('Task list')).toBeInTheDocument();
    });

    it('replaces the whole list when a new set of todos arrives', () => {
      const { rerender } = render(
        <AgentTodoList todos={MIXED} isCurrentlyStreaming />,
      );
      expect(screen.getByText('Read the brief')).toBeInTheDocument();

      rerender(
        <AgentTodoList
          todos={[todo('Brand new plan', 'in_progress')]}
          isCurrentlyStreaming
        />,
      );

      expect(screen.queryByText('Read the brief')).not.toBeInTheDocument();
      expect(screen.getByText('Brand new plan')).toBeInTheDocument();
      expect(screen.getByTestId('agent-todo-list-progress')).toHaveTextContent(
        '0 of 1 done',
      );
    });
  });

  describe('collapsing', () => {
    it('is expanded by default while the turn is still streaming', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('is collapsed by default once the turn has completed', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming={false} />);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('defaults isCurrentlyStreaming to false', () => {
      render(<AgentTodoList todos={MIXED} />);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('auto-collapses when streaming ends', () => {
      const { rerender } = render(
        <AgentTodoList todos={MIXED} isCurrentlyStreaming />,
      );
      expect(screen.getByRole('list')).toBeInTheDocument();

      rerender(<AgentTodoList todos={MIXED} isCurrentlyStreaming={false} />);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('can be expanded again by the user after it collapsed', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming={false} />);
      expect(screen.queryByRole('list')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('agent-todo-list-trigger'));
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('can be collapsed by the user while still streaming', () => {
      render(<AgentTodoList todos={MIXED} isCurrentlyStreaming />);
      fireEvent.click(screen.getByTestId('agent-todo-list-trigger'));
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
  });

  describe('live region', () => {
    it('exposes a polite, atomic, screen-reader-only status region', () => {
      render(<AgentTodoList todos={MIXED} />);

      const announcer = screen.getByTestId('agent-todo-list-announcer');
      expect(announcer).toHaveAttribute('aria-live', 'polite');
      expect(announcer).toHaveAttribute('aria-atomic', 'true');
      expect(announcer).toHaveAttribute('role', 'status');
      expect(announcer).toHaveClass('sr-only');
    });

    it('announces only the summary, never the todo contents', () => {
      render(<AgentTodoList todos={MIXED} />);

      const announcer = screen.getByTestId('agent-todo-list-announcer');
      expect(announcer).toHaveTextContent('Step 1 of 3 complete');
      expect(announcer.textContent).not.toContain('Read the brief');
      expect(announcer.textContent).not.toContain('Draft the outline');
    });

    it('throttles announcements when the agent updates rapidly', () => {
      vi.useFakeTimers();

      const { rerender } = render(<AgentTodoList todos={MIXED} />);
      const announcer = screen.getByTestId('agent-todo-list-announcer');

      // First update announces immediately.
      expect(announcer).toHaveTextContent('Step 1 of 3 complete');

      // Two more list rewrites land inside the throttle window — neither is
      // announced, so a fast-moving agent cannot spam the screen reader.
      rerender(
        <AgentTodoList
          todos={[
            todo('Read the brief', 'completed'),
            todo('Draft the outline', 'completed'),
            todo('Write the summary', 'pending'),
          ]}
        />,
      );
      expect(announcer).toHaveTextContent('Step 1 of 3 complete');

      rerender(
        <AgentTodoList
          todos={[
            todo('Read the brief', 'completed'),
            todo('Draft the outline', 'completed'),
            todo('Write the summary', 'completed'),
          ]}
        />,
      );
      expect(announcer).toHaveTextContent('Step 1 of 3 complete');

      // Once the window closes only the newest summary is announced — three
      // updates produced two announcements, not three.
      act(() => {
        vi.advanceTimersByTime(TODO_ANNOUNCE_THROTTLE_MS);
      });
      expect(announcer).toHaveTextContent('Step 3 of 3 complete');
    });

    it('announces again immediately once the throttle window has passed', () => {
      vi.useFakeTimers();

      const { rerender } = render(<AgentTodoList todos={MIXED} />);
      const announcer = screen.getByTestId('agent-todo-list-announcer');
      expect(announcer).toHaveTextContent('Step 1 of 3 complete');

      act(() => {
        vi.advanceTimersByTime(TODO_ANNOUNCE_THROTTLE_MS + 1);
      });

      rerender(
        <AgentTodoList
          todos={[
            todo('Read the brief', 'completed'),
            todo('Draft the outline', 'completed'),
            todo('Write the summary', 'pending'),
          ]}
        />,
      );
      expect(announcer).toHaveTextContent('Step 2 of 3 complete');
    });

    it('clears a pending announcement timer on unmount', () => {
      vi.useFakeTimers();
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

      const { rerender, unmount } = render(<AgentTodoList todos={MIXED} />);
      rerender(
        <AgentTodoList
          todos={[
            todo('Read the brief', 'completed'),
            todo('Draft the outline', 'completed'),
            todo('Write the summary', 'pending'),
          ]}
        />,
      );

      unmount();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });

    it('does not throw when unmounted with no pending timer', () => {
      const { unmount } = render(<AgentTodoList todos={MIXED} />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('has no axe violations while expanded', async () => {
      const { container } = render(
        <AgentTodoList todos={MIXED} isCurrentlyStreaming />,
      );

      const results = await axe(container);
      // @ts-expect-error -- vitest-axe matcher is registered in vitest.setup.ts
      expect(results).toHaveNoViolations();
    });

    it('has no axe violations while collapsed', async () => {
      const { container } = render(<AgentTodoList todos={MIXED} />);

      const results = await axe(container);
      // @ts-expect-error -- vitest-axe matcher is registered in vitest.setup.ts
      expect(results).toHaveNoViolations();
    });
  });
});
