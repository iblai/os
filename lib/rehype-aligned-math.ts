/**
 * @file rehype-aligned-math.ts
 * @input A hast tree after remark-rehype, before rehype-katex
 * @output The same tree, with display math that uses TeX alignment markers
 *   outside any environment wrapped in `\begin{aligned}...\end{aligned}`.
 * @position Runs immediately before rehype-katex on both the chat
 *   (components/markdown.tsx) and canvas (lib/utils.ts) paths.
 *
 * `&` is an alignment token KaTeX only accepts inside an array-like
 * environment, so the `$$ a &= b \\ c &= d $$` assistants emit constantly
 * throws `Expected 'EOF', got '&'`; a bare `\\` does not throw but is
 * silently dropped ("\\ does nothing in display mode"), collapsing the rows
 * onto one line. No KaTeX option repairs either -- `strict`, `macros`,
 * `globalGroup` and `trust` were all measured -- and no published plugin
 * does this, so supply the environment the source omitted. Math that already
 * opens an environment (`pmatrix`, `cases`, `aligned`, ...) is left alone:
 * its `&` and `\\` are already bound.
 *
 * Operates on the `math-display` element rehype-katex consumes rather than on
 * the mdast `math` node, whose hast children mdast-util-math bakes at parse
 * time from a value that is then never re-read.
 */
import type { Root } from 'hast';
import { visit } from 'unist-util-visit';

const OPENS_ENVIRONMENT = /\\begin\s*\{/;
const UNBOUND_ALIGNMENT = /(?:^|[^\\])&|\\\\/;

export function rehypeAlignedMath() {
  return (tree: Root) => {
    visit(tree, 'element', (node, _index, parent) => {
      const classNames = node.properties?.className;
      if (!Array.isArray(classNames)) return;
      // Streamdown's rehype-sanitize pass drops every `code` class but
      // `language-*`, so match display math the way rehype-katex does: an
      // explicit `math-display`, or a `language-math` code fence in a `pre`.
      const isDisplay =
        classNames.includes('math-display') ||
        (node.tagName === 'code' &&
          classNames.includes('language-math') &&
          parent?.type === 'element' &&
          parent.tagName === 'pre');
      if (!isDisplay) return;
      const [text] = node.children;
      if (text?.type !== 'text') return;
      if (OPENS_ENVIRONMENT.test(text.value)) return;
      if (!UNBOUND_ALIGNMENT.test(text.value)) return;
      text.value = `\\begin{aligned}\n${text.value}\n\\end{aligned}`;
    });
  };
}
