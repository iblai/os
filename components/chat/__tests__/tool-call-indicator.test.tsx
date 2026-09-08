import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ToolCallInfo } from '@iblai/iblai-js/web-utils';

vi.mock('@iblai/iblai-js/web-utils', async () => {
  const actual = await vi.importActual('@iblai/iblai-js/web-utils');
  return {
    ...actual,
    TOOL_NAME_MAP: {
      web_search_call: 'Searching the web',
      vector_search: 'Searching knowledge base',
    },
  };
});

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    cn: (...args: (string | undefined | boolean)[]) =>
      args.filter(Boolean).join(' '),
  };
});

import { ToolCallIndicator } from '../tool-call-indicator';

function makeToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: 'call_1',
    name: 'web_search_call',
    log: '',
    result: '',
    ...overrides,
  };
}

describe('ToolCallIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when toolCalls is empty', () => {
    const { container } = render(<ToolCallIndicator toolCalls={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when toolCalls is undefined', () => {
    const { container } = render(
      <ToolCallIndicator toolCalls={undefined as unknown as ToolCallInfo[]} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows "Used 1 tool" in header for a single tool call', () => {
    render(<ToolCallIndicator toolCalls={[makeToolCall()]} />);
    expect(screen.getByText('Used 1 tool')).toBeInTheDocument();
  });

  it('shows "Used N tools" in header for multiple unique tool calls', () => {
    render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({ id: '1', name: 'web_search_call' }),
          makeToolCall({ id: '2', name: 'vector_search' }),
        ]}
      />,
    );
    expect(screen.getByText('Used 2 tools')).toBeInTheDocument();
  });

  it('counts unique tool names, not total calls', () => {
    render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({ id: '1', name: 'web_search_call' }),
          makeToolCall({ id: '2', name: 'web_search_call' }),
          makeToolCall({ id: '3', name: 'web_search_call' }),
        ]}
      />,
    );
    expect(screen.getByText('Used 1 tool')).toBeInTheDocument();
  });

  it('shows tool count in the header button', () => {
    render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({ id: '1', name: 'web_search_call' }),
          makeToolCall({ id: '2', name: 'vector_search' }),
        ]}
      />,
    );
    const headerButton = screen.getByRole('button');
    expect(headerButton).toHaveTextContent('Used 2 tools');
  });

  // Only the header animates, and only while this row is the live phase — at
  // which point the shimmering WorkingIndicator has stood down, so there is
  // still exactly one animated signal on screen.
  describe('liveness dots', () => {
    it('renders no animation for a finished record', () => {
      const { container } = render(
        <ToolCallIndicator toolCalls={[makeToolCall()]} />,
      );
      fireEvent.click(screen.getByText('Used 1 tool'));
      expect(
        container.querySelector('.animate-bounce'),
      ).not.toBeInTheDocument();
      expect(container.querySelector('[class*="animate-"]')).toBeNull();
    });

    it('renders no animation when isActive is explicitly false', () => {
      const { container } = render(
        <ToolCallIndicator toolCalls={[makeToolCall()]} isActive={false} />,
      );
      expect(container.querySelector('[class*="animate-"]')).toBeNull();
    });

    it('renders three staggered bouncing dots on the header while active', () => {
      const { container } = render(
        <ToolCallIndicator toolCalls={[makeToolCall()]} isActive />,
      );

      const header = screen.getByRole('button');
      const dots = header.querySelectorAll('.animate-bounce');
      expect(dots).toHaveLength(3);
      expect(dots[0].className).toContain('[animation-delay:0ms]');
      expect(dots[1].className).toContain('[animation-delay:150ms]');
      expect(dots[2].className).toContain('[animation-delay:300ms]');
      expect(container.querySelectorAll('.animate-bounce')).toHaveLength(3);
    });

    it('never renders a pulsing dot on the last tool row, active or not', () => {
      const { container } = render(
        <ToolCallIndicator
          toolCalls={[
            makeToolCall({ id: '1', name: 'web_search_call' }),
            makeToolCall({ id: '2', name: 'vector_search' }),
          ]}
          isActive
        />,
      );
      fireEvent.click(screen.getByText('Used 2 tools'));
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });

    it('freezes the dots for users who prefer reduced motion', () => {
      const { container } = render(
        <ToolCallIndicator toolCalls={[makeToolCall()]} isActive />,
      );

      container.querySelectorAll('.animate-bounce').forEach((dot) => {
        expect(dot.className).toContain('motion-reduce:animate-none');
      });
    });

    it('hides the decorative dots from assistive tech', () => {
      const { container } = render(
        <ToolCallIndicator toolCalls={[makeToolCall()]} isActive />,
      );

      expect(
        container.querySelector('[aria-hidden="true"] .animate-bounce'),
      ).toBeInTheDocument();
    });

    it('keeps the header wording static while active', () => {
      render(<ToolCallIndicator toolCalls={[makeToolCall()]} isActive />);
      expect(screen.getByText('Used 1 tool')).toBeInTheDocument();
    });
  });

  it('expands to show individual tool calls when clicked', () => {
    render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({
            id: '1',
            name: 'web_search_call',
            input: { query: 'F1 race' },
          }),
          makeToolCall({
            id: '2',
            name: 'vector_search',
            input: { query: 'documents' },
          }),
        ]}
      />,
    );

    // Click to expand
    fireEvent.click(screen.getByText('Used 2 tools'));

    // Both tool names should be visible inside
    expect(screen.getByText('Searching the web')).toBeInTheDocument();
    expect(screen.getByText('Searching knowledge base')).toBeInTheDocument();

    // Queries should be visible
    expect(screen.getByText('F1 race')).toBeInTheDocument();
    expect(screen.getByText('documents')).toBeInTheDocument();
  });

  it('falls back to the generic wrench and the row index for a nameless call', () => {
    // Streamed tool frames can land before the name/id are filled in.
    const { container } = render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({
            id: '',
            name: undefined as unknown as string,
            input: { query: 'still searching' },
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByText('Used 1 tool'));

    expect(screen.getByText('still searching')).toBeInTheDocument();
    expect(container.querySelector('.lucide-wrench')).toBeInTheDocument();
  });

  it('starts collapsed', () => {
    render(
      <ToolCallIndicator
        toolCalls={[makeToolCall({ id: '1', input: { query: 'test' } })]}
      />,
    );

    // Starts collapsed — query not visible
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('falls back to the generic wrench icon for an unmapped tool name', () => {
    const { container } = render(
      <ToolCallIndicator
        toolCalls={[makeToolCall({ id: '1', name: 'some_custom_tool' })]}
      />,
    );
    fireEvent.click(screen.getByText('Used 1 tool'));
    // No entry in TOOL_ICONS and no entry in TOOL_NAME_MAP: the name is
    // de-underscored and sentence-cased rather than dropped.
    expect(screen.getByText('Some custom tool')).toBeInTheDocument();
    expect(container.querySelectorAll('svg.shrink-0').length).toBe(1);
  });

  it('renders a tool call with no name and no id', () => {
    const { container } = render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({
            id: '',
            name: undefined as unknown as string,
            input: { query: 'orphan query' },
          }),
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Used 1 tool'));
    // Falls back to the array index for the React key and to '' for the label,
    // so the row still renders its query instead of throwing.
    expect(screen.getByText('orphan query')).toBeInTheDocument();
    expect(container.querySelectorAll('svg.shrink-0').length).toBe(1);
  });

  // The indicator always sits inside the assistant bubble, which is
  // `bg-gray-100` (#F3F4F6) with no dark-mode override. gray-400 (#99A1AF) on
  // that background is 2.36:1 and fails WCAG AA for this 12px text; gray-600
  // (#4A5565) is 6.87:1.
  describe('description contrast', () => {
    function renderExpanded() {
      const result = render(
        <ToolCallIndicator
          toolCalls={[makeToolCall({ id: '1', input: { query: 'F1 race' } })]}
        />,
      );
      fireEvent.click(screen.getByText('Used 1 tool'));
      return result;
    }

    // Streamdown wraps its blocks in an extra div, so the element carrying the
    // <Markdown className> is one level above the nearest ancestor div.
    const markdownRootOf = (el: HTMLElement) =>
      el.closest('div')?.parentElement;

    it('renders the tool query at gray-600, not the washed-out gray-400', () => {
      renderExpanded();
      const markdownRoot = markdownRootOf(screen.getByText('F1 race'));
      // The <Markdown> override wins over prose colours on every descendant,
      // so it is the one that decides what the query actually looks like.
      expect(markdownRoot?.className).toContain('[&_*]:text-gray-600');
      expect(markdownRoot?.className).not.toContain('text-gray-400');
    });

    it('does not ship a dark-mode override that would invert on the light bubble', () => {
      renderExpanded();
      const markdownRoot = markdownRootOf(screen.getByText('F1 race'));
      const wrapper = markdownRoot?.parentElement;
      expect(markdownRoot?.className).not.toContain('dark:');
      expect(wrapper?.className).not.toContain('dark:');
    });

    it('renders the tool name darker than the icon beside it', () => {
      const { container } = renderExpanded();
      const name = screen.getByText('Searching the web');
      expect(name.parentElement?.className).toContain('text-gray-700');
      const icon = container.querySelector('svg.shrink-0');
      expect(icon?.getAttribute('class')).toContain('text-gray-500');
    });

    it('renders the collapsed header label at gray-600', () => {
      render(<ToolCallIndicator toolCalls={[makeToolCall()]} />);
      const trigger = screen.getByRole('button');
      expect(trigger.className).toContain('text-gray-600');
      expect(trigger.className).not.toContain('text-gray-500');
    });
  });

  describe('write_todos exclusion', () => {
    it('renders nothing when write_todos is the only tool call', () => {
      const { container } = render(
        <ToolCallIndicator
          toolCalls={[makeToolCall({ id: 'td', name: 'write_todos' })]}
        />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('renders nothing when every tool call is write_todos', () => {
      const { container } = render(
        <ToolCallIndicator
          toolCalls={[
            makeToolCall({ id: 'td1', name: 'write_todos' }),
            makeToolCall({ id: 'td2', name: 'write_todos' }),
          ]}
        />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('excludes write_todos from the "Used N tools" count', () => {
      render(
        <ToolCallIndicator
          toolCalls={[
            makeToolCall({ id: '1', name: 'web_search_call' }),
            makeToolCall({ id: 'td', name: 'write_todos' }),
          ]}
        />,
      );
      expect(screen.getByText('Used 1 tool')).toBeInTheDocument();
    });

    it('does not render a card for write_todos when expanded', () => {
      render(
        <ToolCallIndicator
          toolCalls={[
            makeToolCall({
              id: '1',
              name: 'web_search_call',
              input: { query: 'F1 race' },
            }),
            makeToolCall({
              id: 'td',
              name: 'write_todos',
              input: { todos: [{ content: 'Step one', status: 'pending' }] },
            }),
          ]}
        />,
      );

      fireEvent.click(screen.getByText('Used 1 tool'));

      expect(screen.getByText('Searching the web')).toBeInTheDocument();
      expect(screen.queryByText('write_todos')).not.toBeInTheDocument();
      expect(screen.queryByText('Step one')).not.toBeInTheDocument();
    });

    it('excludes write_todos even while the row is the live phase', () => {
      const { container } = render(
        <ToolCallIndicator
          toolCalls={[
            makeToolCall({
              id: '1',
              name: 'web_search_call',
              input: { query: 'F1 race' },
            }),
            makeToolCall({ id: 'td', name: 'write_todos' }),
          ]}
          isActive={true}
        />,
      );

      fireEvent.click(screen.getByText('Used 1 tool'));
      expect(screen.getByText('F1 race')).toBeInTheDocument();
      // Liveness is the header dots only — the per-row pulse is gone, so a
      // live row must not reintroduce a second animation.
      expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
    });
  });
});
