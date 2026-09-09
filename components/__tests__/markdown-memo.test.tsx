import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Markdown from '../markdown';

/**
 * The streaming-performance contract of the Markdown wrapper: a chat
 * re-renders every bubble on each streaming tick, so finished messages must
 * NOT re-run markdown. Two pins:
 *  1. The wrapper is memoized — same (children, className) = no re-render.
 *  2. Streamdown's props are referentially stable across renders (an inline
 *     closure like the old urlTransform busted its internal per-block
 *     memoization, re-parsing every block of every message per tick).
 */

const { renderSpy } = vi.hoisted(() => ({ renderSpy: vi.fn() }));

vi.mock('streamdown', () => ({
  Streamdown: (props: Record<string, unknown>) => {
    renderSpy(props);
    return null;
  },
}));

describe('Markdown streaming-performance contract', () => {
  beforeEach(() => {
    renderSpy.mockClear();
  });

  it('is memoized: unchanged props never re-render the markdown tree', () => {
    const { rerender } = render(<Markdown>Hello **world**</Markdown>);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(<Markdown>Hello **world**</Markdown>);
    rerender(<Markdown>Hello **world**</Markdown>);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(<Markdown>Hello **world** more</Markdown>);
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it('hands Streamdown referentially stable props across renders', () => {
    const { rerender } = render(<Markdown>first</Markdown>);
    rerender(<Markdown>second</Markdown>);
    expect(renderSpy).toHaveBeenCalledTimes(2);

    const [first, second] = renderSpy.mock.calls.map((c) => c[0]);
    for (const key of [
      'plugins',
      'components',
      'urlTransform',
      'linkSafety',
      'controls',
      'parseMarkdownIntoBlocksFn',
    ]) {
      expect(first[key], `prop ${key} must be stable`).toBe(second[key]);
    }
  });
});
