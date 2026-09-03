/**
 * @file markdown-math-error-reporter.ts
 * @input A hast tree after rehype-katex, plus the vfile it was parsed from
 * @output The same tree, untouched. Three failures in it are reported to
 *   Sentry: a KaTeX error span (`MarkdownMathRenderError`), LaTeX that reached
 *   the reader unconverted (`MarkdownLatexResidueError`) and a conversion that
 *   produced nothing at all (`MarkdownDroppedContentError`).
 * @position Runs immediately after rehype-katex on both the chat
 *   (components/markdown.tsx) and canvas (lib/utils.ts) paths.
 *
 * rehype-katex swallows every KaTeX failure into a vfile message nothing reads
 * and re-renders with `throwOnError: false`, so a broken formula left no
 * telemetry at all -- the only trace was a coloured span on screen. A hast
 * plugin is the only hook available on both paths: Streamdown exposes no
 * vfile.
 *
 * KaTeX throwing is only the loud half. The silent half never raises: a
 * `\approx` the island bridge left in prose, a `tabular` markdown cannot
 * express, a `\verb` nobody converted, a block a conversion swallowed whole.
 * Those are found by reading the rendered output -- the text the reader
 * actually sees, with maths, code and MathML skipped -- and reported by
 * CLASSIFICATION: the environment or command name, never the prose around it.
 * See lib/markdown-latex-residue.ts for the privacy argument.
 *
 * One `visit` serves all three checks, so the cost is a single tree walk that
 * stops at every code fence and rendered formula. Streaming re-renders a
 * message on every token, so identical failures are reported once per session
 * and the signature set is capped.
 */
import * as Sentry from '@sentry/nextjs';
import type { Element, Root } from 'hast';
import { SKIP, visit } from 'unist-util-visit';

import { URL_PATTERNS } from './constants';
import {
  hasLatexConstruct,
  scanLatexResidue,
  sourceEnvironments,
  type Residue,
} from './markdown-latex-residue';

const TEX_LIMIT = 120;
const MAX_SIGNATURES = 50;
/** Below this a source is too short for "dropped" to mean anything. */
const MIN_DROPPED_SOURCE = 20;

/** Subtrees whose text is not prose: rendered maths, code, raw markup. */
const OPAQUE = new Set([
  'code',
  'pre',
  'math',
  'script',
  'style',
  'svg',
  'textarea',
]);

/** Elements that are content even though they contribute no text. */
const EMBEDDED = new Set(['img', 'video', 'audio', 'iframe', 'canvas', 'hr']);

const occurrences = new Map<string, number>();

export class MarkdownMathRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownMathRenderError';
  }
}

export class MarkdownLatexResidueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownLatexResidueError';
  }
}

export class MarkdownDroppedContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownDroppedContentError';
  }
}

type Path = 'chat' | 'canvas';

/**
 * The vfile unified hands every transformer. Typed structurally rather than
 * imported: `vfile` is a transitive dependency, not a direct one.
 */
type SourceFile = { toString(): string };

/** The dedupe map is session-scoped; tests need a clean slate per case. */
export function resetMathErrorReports() {
  occurrences.clear();
}

export function rehypeReportMathErrors({ path }: { path: Path }) {
  return (tree: Root, file?: SourceFile) => {
    let visibleText = 0;
    let rendered = false;

    visit(tree, (node) => {
      if (node.type === 'text') {
        visibleText += node.value.trim().length;
        for (const residue of scanLatexResidue(node.value)) {
          reportResidue(path, residue);
        }
        return;
      }
      // A comment is deliberate invisible output, not a dropped block.
      if (node.type === 'comment') {
        rendered = true;
        return;
      }
      if (node.type !== 'element') return;
      const element = node as Element;
      const classNames = element.properties?.className;
      const classes = Array.isArray(classNames) ? classNames : [];
      if (classes.includes('katex-error')) {
        rendered = true;
        const [text] = element.children;
        reportMath(
          path,
          String(element.properties?.title ?? ''),
          text?.type === 'text' ? text.value : '',
        );
        return SKIP;
      }
      if (classes.includes('katex') || OPAQUE.has(element.tagName)) {
        rendered = true;
        return SKIP;
      }
      if (EMBEDDED.has(element.tagName)) rendered = true;
    });

    if (visibleText === 0 && !rendered) reportDropped(path, file);
  };
}

function reportMath(path: Path, message: string, tex: string) {
  const truncated = tex.slice(0, TEX_LIMIT);
  send(new MarkdownMathRenderError(message), {
    signature: `${path}|${message}|${truncated}`,
    path,
    tags: { renderer: 'katex' },
    extra: {
      tex: truncated,
      texLength: tex.length,
      truncated: tex.length > TEX_LIMIT,
    },
  });
}

function reportResidue(path: Path, { kind, token, count }: Residue) {
  send(new MarkdownLatexResidueError(`Unconverted LaTeX ${kind}: ${token}`), {
    signature: `${path}|residue|${kind}|${token}`,
    path,
    // Tags are what Sentry can group and rank by, which is the whole point:
    // the team needs the environments users actually hit, most frequent first.
    tags: { renderer: 'latex-residue', residueKind: kind, residueToken: token },
    extra: { kind, token, matches: count },
  });
}

function reportDropped(path: Path, file?: SourceFile) {
  const source = file ? String(file) : '';
  // An HTML comment is dropped on purpose -- Streamdown's sanitiser strips it
  // -- so a block that is only a comment is not a conversion failure.
  if (
    source.trim().length < MIN_DROPPED_SOURCE ||
    source.indexOf('<!--') !== -1 ||
    !hasLatexConstruct(source)
  ) {
    return;
  }
  const environments = sourceEnvironments(source);
  send(new MarkdownDroppedContentError('Markdown conversion dropped a block'), {
    signature: `${path}|dropped|${environments.join(',')}`,
    path,
    tags: { renderer: 'pipeline' },
    // Only the length of the source and the names of the environments it
    // opened -- never a character of the source itself.
    extra: { sourceLength: source.length, environments },
  });
}

type Report = {
  signature: string;
  path: Path;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
};

function send(error: Error, { signature, path, tags, extra }: Report) {
  try {
    if (!Sentry.getClient()) return;
    const count = (occurrences.get(signature) ?? 0) + 1;
    if (count === 1 && occurrences.size >= MAX_SIGNATURES) return;
    occurrences.set(signature, count);
    if (count > 1) return;

    const platform =
      typeof window === 'undefined'
        ? null
        : window.location.pathname.match(URL_PATTERNS.PLATFORM_KEY);
    Sentry.captureException(error, {
      tags: {
        subsystem: 'markdown',
        path,
        ...tags,
        ...(platform ? { tenant: platform[1] } : {}),
      },
      extra: { ...extra, occurrences: count },
    });
  } catch {
    // Telemetry must never break rendering.
  }
}
