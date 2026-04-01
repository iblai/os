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

  it('shows "Used N tools" in header for multiple tool calls', () => {
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
});
