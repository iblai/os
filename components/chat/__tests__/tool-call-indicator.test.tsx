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

  it('shows tool count in header even when streaming', () => {
    render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({ id: '1', name: 'web_search_call' }),
          makeToolCall({ id: '2', name: 'vector_search' }),
        ]}
        isCurrentlyStreaming={true}
      />,
    );
    const headerButton = screen.getByRole('button');
    expect(headerButton).toHaveTextContent('Used 2 tools');
  });

  it('shows bounce dots when streaming', () => {
    const { container } = render(
      <ToolCallIndicator
        toolCalls={[makeToolCall()]}
        isCurrentlyStreaming={true}
      />,
    );
    expect(container.querySelectorAll('.animate-bounce').length).toBe(3);
  });

  it('hides bounce dots when not streaming', () => {
    const { container } = render(
      <ToolCallIndicator
        toolCalls={[makeToolCall()]}
        isCurrentlyStreaming={false}
      />,
    );
    expect(container.querySelector('.animate-bounce')).not.toBeInTheDocument();
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

  it('starts collapsed even during streaming', () => {
    render(
      <ToolCallIndicator
        toolCalls={[makeToolCall({ id: '1', input: { query: 'test' } })]}
        isCurrentlyStreaming={true}
      />,
    );

    // Starts collapsed — query not visible
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('defaults isCurrentlyStreaming to false', () => {
    const { container } = render(
      <ToolCallIndicator toolCalls={[makeToolCall()]} />,
    );
    expect(container.querySelector('.animate-bounce')).not.toBeInTheDocument();
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

    it('renders the tool query at gray-600, not the washed-out gray-400', () => {
      renderExpanded();
      const markdownRoot = screen.getByText('F1 race').closest('div');
      // The <Markdown> override wins over prose colours on every descendant,
      // so it is the one that decides what the query actually looks like.
      expect(markdownRoot?.className).toContain('[&_*]:text-gray-600');
      expect(markdownRoot?.className).not.toContain('text-gray-400');
    });

    it('does not ship a dark-mode override that would invert on the light bubble', () => {
      renderExpanded();
      const markdownRoot = screen.getByText('F1 race').closest('div');
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
});
