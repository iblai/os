/**
 * @file markdown-render-error-reporter.ts
 * @input The error a markdown render threw, plus the raw source it threw on
 * @output Nothing. One Sentry event per distinct failure per session, carrying
 *   the SHAPE of the source and never the source.
 * @position Called from components/markdown/markdown-error-boundary.tsx.
 *
 * A renderer bug used to take the whole conversation down and force a revert.
 * With the boundary it takes one message, so the cost of the next one is a
 * ticket -- provided the ticket says enough to reproduce from. The Fordham
 * crash (Sentry c47052cc) could not be: the payload had a stack and nothing
 * else, and the trigger was an em dash beside a URL.
 *
 * Message text must never reach Sentry: it is the user's conversation, and it
 * is exactly what a renderer crash makes tempting to attach. Only
 * classification tokens go out. See lib/markdown-shape-classifier.ts.
 *
 * Streaming re-renders a message on every token, so identical failures are
 * reported once per session and the signature set is capped. Mirrors the
 * `send` in lib/markdown-math-error-reporter.ts.
 */
import * as Sentry from '@sentry/nextjs';

import { URL_PATTERNS } from './constants';
import { classifyMarkdownShape } from './markdown-shape-classifier';

const MAX_SIGNATURES = 50;

const occurrences = new Map<string, number>();

export class MarkdownRenderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MarkdownRenderError';
  }
}

type Path = 'chat' | 'canvas';

/** The dedupe map is session-scoped; tests need a clean slate per case. */
export function resetMarkdownRenderReports() {
  occurrences.clear();
}

export function reportMarkdownRenderFailure(
  error: unknown,
  source: string,
  path: Path = 'chat',
) {
  try {
    if (!Sentry.getClient()) return;

    const thrown = error instanceof Error ? error : new Error(String(error));
    const shape = classifyMarkdownShape(source);
    const signature = `${path}|${thrown.name}|${thrown.message}|${shape.join(',')}`;

    const count = (occurrences.get(signature) ?? 0) + 1;
    if (count === 1 && occurrences.size >= MAX_SIGNATURES) return;
    occurrences.set(signature, count);
    if (count > 1) return;

    const platform =
      typeof window === 'undefined'
        ? null
        : window.location.pathname.match(URL_PATTERNS.PLATFORM_KEY);

    Sentry.captureException(
      new MarkdownRenderError(thrown.message, { cause: thrown }),
      {
        tags: {
          subsystem: 'markdown',
          renderer: 'boundary',
          path,
          errorName: thrown.name,
          ...(platform ? { tenant: platform[1] } : {}),
        },
        // The shape of the source and the length bucket it fell in -- never a
        // character of the source itself.
        extra: { shape, occurrences: count },
      },
    );
  } catch {
    // Telemetry must never break the fallback that replaced the render.
  }
}
