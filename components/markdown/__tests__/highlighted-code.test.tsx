import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Stub the heavy highlighter so the test doesn't load every Prism grammar.
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language }: { children: string; language: string }) => (
    <pre data-testid="prism" data-language={language}>
      {children}
    </pre>
  ),
}));
vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  tomorrow: {},
}));

import HighlightedCode from '../highlighted-code';

describe('HighlightedCode', () => {
  it('renders the Prism highlighter with the code and language', () => {
    const { getByTestId } = render(
      <HighlightedCode code={'print(1)'} language="python" />,
    );
    const el = getByTestId('prism');
    expect(el.getAttribute('data-language')).toBe('python');
    expect(el.textContent).toContain('print(1)');
  });
});
