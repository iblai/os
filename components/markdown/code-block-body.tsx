'use client';

import { useEffect, useState, type ComponentType } from 'react';

import type { HighlightedCodeProps } from './highlighted-code';

// Lazily load the syntax highlighter so react-syntax-highlighter (Prism plus
// every language grammar, ~hundreds of KB) stays out of the main chat bundle
// and is fetched only when a code block actually renders. Until it is ready the
// raw code shows in a matching <pre> so there is no blank flash, and the copy
// control in the header (rendered by the parent) works immediately.
export function CodeBlockBody({ code, language }: HighlightedCodeProps) {
  const [Highlighter, setHighlighter] =
    useState<ComponentType<HighlightedCodeProps> | null>(null);

  useEffect(() => {
    let active = true;
    void import('./highlighted-code').then((mod) => {
      if (active) setHighlighter(() => mod.default);
    });
    return () => {
      active = false;
    };
  }, []);

  if (Highlighter) {
    return <Highlighter code={code} language={language} />;
  }

  return (
    <pre className="m-0! overflow-x-auto bg-[#2d2d2d] p-4 font-mono text-sm text-[#cccccc]">
      <code>{code}</code>
    </pre>
  );
}
