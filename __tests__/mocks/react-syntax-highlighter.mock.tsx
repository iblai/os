/**
 * Mock implementation of react-syntax-highlighter for testing.
 *
 * `vitest.config.ts` aliases the package here. The real one is the heaviest
 * module in the app — Prism plus every language grammar — and
 * `code-block-body.tsx` loads it fire-and-forget from an effect, so any test
 * that renders a markdown code block starts that load and may end before it
 * finishes, which tears the environment down underneath it
 * ("Cannot load … after the environment was torn down").
 *
 * The rendered shape matches what `components/markdown/__tests__/
 * highlighted-code.test.tsx` asserts on, so that test reads the same whether
 * it stubs the package itself or gets this.
 */
import type { ReactNode } from 'react';

type Props = { children?: ReactNode; language?: string };

const Highlighter = ({ children, language }: Props) => (
  <pre data-testid="prism" data-language={language}>
    {children}
  </pre>
);

export const Prism = Highlighter;
export const Light = Highlighter;
export const LightAsync = Highlighter;
export default Highlighter;
