import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { DefaultTag } from '../default-tag';
import type { Prompt } from '@iblai/iblai-js/web-utils';

// Mock the Markdown component so we can assert the content is routed through
// it rather than rendered as a plain <span>/<p>. See issue #1179.
vi.mock('@/components/markdown', () => ({
  default: ({
    children,
    className,
  }: {
    children: string;
    className?: string;
  }) => (
    <div data-testid="markdown-content" className={className}>
      {children}
    </div>
  ),
}));

// The component calls `useSelector(selectActiveTab)` — mock the selector to
// return a known tab and avoid pulling the full iblai-js store.
vi.mock('@iblai/iblai-js/web-utils', () => ({
  selectActiveTab: () => 'chat',
}));

function renderWithStore(ui: React.ReactElement) {
  const store = configureStore({
    reducer: { noop: (state = {}) => state },
  });
  return render(<Provider store={store}>{ui}</Provider>);
}

describe('DefaultTag', () => {
  const mockOnPromptSelect = vi.fn();

  const prompts: Prompt[] = [
    {
      content: 'Explore [docs](https://example.com)',
      icon: 'book',
    } as Prompt,
    {
      content: '**Bold** tip',
      icon: 'bulb',
    } as Prompt,
  ];

  beforeEach(() => {
    cleanup();
    mockOnPromptSelect.mockReset();
  });

  // Issue #1179 — prompt.content authored in the prompts editor must render
  // through the Markdown component so links / bold / etc. come through.
  it('renders every prompt through the Markdown component (issue #1179)', () => {
    renderWithStore(
      <DefaultTag prompts={prompts} onPromptSelect={mockOnPromptSelect} />,
    );

    const markdownNodes = screen.getAllByTestId('markdown-content');
    expect(markdownNodes).toHaveLength(prompts.length);
    expect(markdownNodes[0]).toHaveTextContent(
      'Explore [docs](https://example.com)',
    );
    expect(markdownNodes[1]).toHaveTextContent('**Bold** tip');
  });

  it('applies the compact text styling to the Markdown wrapper', () => {
    renderWithStore(
      <DefaultTag prompts={[prompts[0]]} onPromptSelect={mockOnPromptSelect} />,
    );

    const markdown = screen.getByTestId('markdown-content');
    expect(markdown.className).toContain('text-sm');
    expect(markdown.className).toContain('leading-relaxed');
    expect(markdown.className).toContain('text-gray-700');
  });

  it('calls onPromptSelect with the active tab and prompt content on click', () => {
    renderWithStore(
      <DefaultTag prompts={prompts} onPromptSelect={mockOnPromptSelect} />,
    );

    fireEvent.click(
      screen.getAllByTestId('markdown-content')[0].parentElement!,
    );

    expect(mockOnPromptSelect).toHaveBeenCalledWith(
      'chat',
      'Explore [docs](https://example.com)',
    );
  });

  it('renders nothing when the prompts list is empty', () => {
    const { container } = renderWithStore(
      <DefaultTag prompts={[]} onPromptSelect={mockOnPromptSelect} />,
    );

    expect(
      container.querySelectorAll('[data-testid="markdown-content"]'),
    ).toHaveLength(0);
  });

  it('falls back to an empty string when prompt content is undefined', () => {
    const incomplete = [{ content: undefined } as unknown as Prompt];
    renderWithStore(
      <DefaultTag prompts={incomplete} onPromptSelect={mockOnPromptSelect} />,
    );

    fireEvent.click(
      screen.getAllByTestId('markdown-content')[0].parentElement!,
    );
    expect(mockOnPromptSelect).toHaveBeenCalledWith('chat', '');
  });
});
