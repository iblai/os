import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import { CodeBlockBody } from '../code-block-body';

// Mock the lazy highlighter chunk so the test doesn't pull the real
// react-syntax-highlighter bundle.
vi.mock('../highlighted-code', () => ({
  default: ({ code, language }: { code: string; language: string }) => (
    <div data-testid="highlighted" data-language={language}>
      {code}
    </div>
  ),
}));

describe('CodeBlockBody', () => {
  it('shows the raw code immediately, then swaps in the highlighter', async () => {
    const { getByTestId, queryByTestId, container } = render(
      <CodeBlockBody code={'const x = 1;'} language="javascript" />,
    );

    // Before the lazy chunk loads: a plain <pre> fallback with the raw code,
    // and no highlighter yet.
    expect(container.querySelector('pre')).toBeTruthy();
    expect(queryByTestId('highlighted')).toBeNull();
    expect(container.textContent).toContain('const x = 1;');

    // Once the lazy chunk resolves, the highlighter renders with the language.
    await waitFor(() => expect(getByTestId('highlighted')).toBeTruthy());
    expect(getByTestId('highlighted').getAttribute('data-language')).toBe(
      'javascript',
    );
    expect(getByTestId('highlighted').textContent).toContain('const x = 1;');
  });
});
