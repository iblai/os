/**
 * @file remark-latex-line-breaks.ts
 * @input An mdast tree, after the math extension has carved out `$...$`,
 *   `\(...\)` and `\[...\]` and after remarkLatexIslands has rebuilt its
 *   environments, before remark-breaks
 * @output The same tree, with the literal backslash a LaTeX `\\` row break
 *   leaves at the end of a prose line removed.
 * @position Runs on both the chat (components/markdown.tsx) and canvas
 *   (lib/utils.ts) paths, after remarkLatexIslands and before remark-breaks.
 *
 * Assistants end a line with `\\` when they mean "break here" -- LaTeX's row
 * separator. CommonMark reads the same two characters as an escape producing
 * ONE literal backslash, and the newline after it as an ordinary soft break,
 * so the line breaks (remark-breaks does that) but a stray `\` is left
 * dangling at the end of it. The retired preprocessor consumed the pair; this
 * restores that, as the residue only.
 *
 * Scope. Only a backslash run IMMEDIATELY before a line ending is touched, so
 * `C:\Users\name` mid-sentence is untouched, and only a run of exactly one --
 * a text `\\` came from a source `\\\\`, which is two deliberate backslashes.
 * Maths (`math`, `inlineMath`) and code (`code`, `inlineCode`) are separate
 * mdast node types that a `text` visitor never enters, so a `\\` separating
 * `aligned` or `pmatrix` rows, a fenced line ending in `\` and an inline
 * `` `foo \` `` all survive untouched.
 *
 * A text node carrying a `\begin{...}` is skipped outright. An environment
 * neither KaTeX nor remarkLatexIslands can render -- `center`, and a bare
 * `array` outside maths -- falls back to LITERAL SOURCE in an ordinary text
 * node, and there its `\\` really is a row separator that the reader is being
 * shown. It is the one place where a text node's trailing backslash is not
 * residue.
 *
 * The trade: a line of ordinary prose ending in one deliberate backslash
 * loses it. Assistants emit LaTeX `\\` far more often than a trailing literal
 * backslash, and the LaTeX residue is the reported bug.
 */
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

const TRAILING_BACKSLASHES = /\\+(?=\r?\n)/g;
const ENVIRONMENT = /\\begin\{/;

export function remarkLatexLineBreaks() {
  return (tree: Root) => {
    visit(tree, 'text', (node) => {
      if (!node.value.includes('\\')) return;
      if (ENVIRONMENT.test(node.value)) return;
      node.value = node.value.replace(TRAILING_BACKSLASHES, (run) =>
        run.length === 1 ? '' : run,
      );
    });
  };
}
