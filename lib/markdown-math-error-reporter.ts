/**
 * @file markdown-math-error-reporter.ts
 * @input A hast tree after rehype-katex
 * @output The same tree, untouched. Every `span.katex-error` in it is reported
 *   to Sentry as a `MarkdownMathRenderError`.
 * @position Runs immediately after rehype-katex on both the chat
 *   (components/markdown.tsx) and canvas (lib/utils.ts) paths.
 *
 * rehype-katex swallows every KaTeX failure into a vfile message nothing reads
 * and re-renders with `throwOnError: false`, so a broken formula left no
 * telemetry at all -- the only trace was a coloured span on screen. A hast
 * plugin is the only hook available on both paths: Streamdown exposes no
 * vfile.
 *
 * Only the failing math is sent, never the surrounding prose. Streaming
 * re-renders a message on every token, so identical failures are reported once
 * per session and the signature set is capped.
 */
import * as Sentry from '@sentry/nextjs';
import type { Root } from 'hast';
import { visit } from 'unist-util-visit';

import { URL_PATTERNS } from './constants';

const TEX_LIMIT = 120;
const MAX_SIGNATURES = 50;

const occurrences = new Map<string, number>();

export class MarkdownMathRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownMathRenderError';
  }
}

/** The dedupe map is session-scoped; tests need a clean slate per case. */
export function resetMathErrorReports() {
  occurrences.clear();
}

export function rehypeReportMathErrors({ path }: { path: 'chat' | 'canvas' }) {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      const classNames = node.properties?.className;
      if (!Array.isArray(classNames) || !classNames.includes('katex-error')) {
        return;
      }
      const [text] = node.children;
      report(
        path,
        String(node.properties?.title ?? ''),
        text?.type === 'text' ? text.value : '',
      );
    });
  };
}

function report(path: 'chat' | 'canvas', message: string, tex: string) {
  try {
    if (!Sentry.getClient()) return;
    const truncated = tex.slice(0, TEX_LIMIT);
    const signature = `${path}|${message}|${truncated}`;
    const count = (occurrences.get(signature) ?? 0) + 1;
    if (count === 1 && occurrences.size >= MAX_SIGNATURES) return;
    occurrences.set(signature, count);
    if (count > 1) return;

    const platform =
      typeof window === 'undefined'
        ? null
        : window.location.pathname.match(URL_PATTERNS.PLATFORM_KEY);
    Sentry.captureException(new MarkdownMathRenderError(message), {
      tags: {
        subsystem: 'markdown',
        renderer: 'katex',
        path,
        ...(platform ? { tenant: platform[1] } : {}),
      },
      extra: {
        tex: truncated,
        texLength: tex.length,
        truncated: tex.length > TEX_LIMIT,
        occurrences: count,
      },
    });
  } catch {
    // Telemetry must never break rendering.
  }
}
