/**
 * @file rehype-verb-code.ts
 * @input A hast tree after remark-rehype, before rehype-katex
 * @output The same tree, with display math that is nothing but `\verb` rows
 *   inside an `aligned` environment turned into a plain `<pre><code>` fence.
 * @position Runs immediately before rehype-katex on both the chat
 *   (components/markdown.tsx) and canvas (lib/utils.ts) paths, beside
 *   rehypeAlignedMath.
 *
 * The retired system prompt told models to typeset source code as
 * `\[\begin{aligned} &\verb|line|\\ ... \end{aligned}\]`. KaTeX renders that
 * faithfully -- centred, serif, no monospace, no highlighting, no copy button
 * -- which is exactly wrong for code. No KaTeX option and no published rehype
 * plugin recognises the idiom, because it is not a maths construct at all: it
 * is a code block wearing a maths costume, so the repair has to be a local
 * shape test. The test is deliberately total: every non-empty row must be a
 * `\verb` row, otherwise the node is real alignment maths and is left alone.
 *
 * Operates on the `code` element rehype-katex consumes (Streamdown's
 * rehype-sanitize pass strips `math-display`, leaving `language-math` on a
 * `code` inside a `pre`) rather than on the mdast `math` node, whose hast
 * children mdast-util-math bakes at parse time.
 *
 * SUNSET: this is compatibility code. It exists only for mentors created
 * before 2026-07-30, which still carry the old system prompt (removed for new
 * agents in 751971e4). Delete this file, its wiring and its tests once
 * messages from those mentors fall below a meaningful share of reads.
 */
import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

const ALIGNED_ENV =
  /^\\begin\{(?:align|aligned)\*?\}([\s\S]*)\\end\{(?:align|aligned)\*?\}$/;

/**
 * The bodies of every `\verb` row in an `aligned` block, or null when the
 * source is not exclusively `\verb` rows -- i.e. when it is real maths.
 */
export function extractVerbRows(tex: string): string[] | null {
  const match = ALIGNED_ENV.exec(tex.trim());
  if (!match) return null;
  const body = match[1];
  const rows: string[] = [];
  let i = 0;
  const skipSpace = () => {
    while (i < body.length && /\s/.test(body[i])) i++;
  };
  while (i < body.length) {
    skipSpace();
    if (i >= body.length) break;
    if (body[i] === '&') i++;
    skipSpace();
    if (!body.startsWith('\\verb', i)) return null;
    i += 5;
    // \verb takes any non-alphanumeric, non-space character as its delimiter.
    const delimiter = body[i];
    if (!delimiter || /[\sA-Za-z0-9*]/.test(delimiter)) return null;
    const end = body.indexOf(delimiter, i + 1);
    if (end === -1) return null;
    rows.push(body.slice(i + 1, end));
    i = end + 1;
    while (i < body.length && /[ \t]/.test(body[i])) i++;
    // `\\` ends a row. A lone `\` is the same row break seen through the
    // markdown parser: when the block arrives unwrapped by `\[...\]` it is
    // ordinary paragraph text, and CommonMark's hard-line-break rule has
    // already eaten one of the two backslashes.
    if (body.startsWith('\\\\', i)) i += 2;
    else if (body[i] === '\\') i += 1;
  }
  return rows.length > 0 ? rows : null;
}

export function rehypeVerbCode() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, _index, parent) => {
      const classNames = node.properties?.className;
      if (!Array.isArray(classNames)) return;
      if (
        node.tagName !== 'code' ||
        parent?.type !== 'element' ||
        parent.tagName !== 'pre'
      ) {
        return;
      }
      if (
        !classNames.includes('language-math') &&
        !classNames.includes('math-display')
      ) {
        return;
      }
      const [text] = node.children;
      if (text?.type !== 'text') return;
      const rows = extractVerbRows(text.value);
      if (!rows) return;
      // No language class: the content is arbitrary, and the chat renderer's
      // `pre` override gives every fenced block the code-block chrome whether
      // or not it declares one.
      node.properties = {};
      node.children = [{ type: 'text', value: rows.join('\n') }];
    });
  };
}
