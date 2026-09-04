import type { Pluggable } from 'unified';
import { Streamdown } from 'streamdown';
import rehypeKatex from 'rehype-katex';
import zilMath from '@ziloen/remark-math';
import remarkBreaks from 'remark-breaks';

import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';
import { cn } from '@/lib/utils';
import { normalizeListIndentation } from '@/lib/normalize-list-indentation';
import { components } from './markdown/markdown-components';
import { rehypeAlignedMath } from '@/lib/rehype-aligned-math';
import { rehypeVerbCode } from '@/lib/rehype-verb-code';
import { remarkLatexIslands } from '@/lib/remark-latex-islands';
import { remarkLatexLineBreaks } from '@/lib/remark-latex-line-breaks';
import { parseLatexAwareBlocks } from '@/lib/latex-aware-blocks';
import { rehypeReportMathErrors } from '@/lib/markdown-math-error-reporter';
import { KATEX_ERROR_COLOR } from '@/lib/katex-options';

type Props = {
  children?: string;
  className?: string;
};

// Wired through Streamdown's `plugins` slot rather than remarkPlugins /
// rehypePlugins: those props REPLACE Streamdown's defaults, which would drop
// its rehype-raw -> rehype-sanitize -> rehype-harden chain. The plugin slot
// appends math after harden instead.
//
// The math parser is @ziloen/remark-math rather than @streamdown/math, which
// is remark-math + rehype-katex and so understands only `$` delimiters:
// assistants here emit `\(...\)` and `\[...\]` as well, and prices like
// `$100-$200` have to stay literal. @ziloen parses both bracket forms and
// applies the @vscode/markdown-it-katex boundary rules to single dollars
// (plus the closing-whitespace rule, the no-line-ending rule and the
// stop-the-closing-run-on-match rule those omit, all three added by
// patches/@ziloen__remark-math@0.1.1.patch).
// The rehype slot takes a single `Pluggable`, so the three rehype passes
// travel as a unified preset -- unified expands `{ plugins: [...] }` in order.
const math = {
  name: 'katex' as const,
  type: 'math' as const,
  // remark-breaks rides along in the math slot's preset: assistants emit
  // line-separated prose constantly, and CommonMark collapses a single
  // newline to a space, running twenty lines into one paragraph. Streamdown
  // exposes no `breaks` option and passing `remarkPlugins` would replace its
  // defaults (remark-gfm, codeMeta), so the preset is the seam that adds a
  // plugin without dropping any.
  remarkPlugin: {
    plugins: [
      [zilMath, { singleDollarTextMath: true }],
      // Legacy document-mode LaTeX is repaired after the math extension has
      // carved out real maths and before remark-breaks splits the text nodes
      // an island has to span. See lib/remark-latex-islands.ts.
      remarkLatexIslands,
      // The `\\` an assistant ends a line with is LaTeX's row break, but
      // CommonMark has already read it as an escaped backslash and left the
      // literal behind. Strip the residue before remark-breaks turns the
      // newline itself into the <br> the author meant.
      remarkLatexLineBreaks,
      remarkBreaks,
    ],
  } as Pluggable,
  rehypePlugin: {
    plugins: [
      rehypeVerbCode,
      rehypeAlignedMath,
      [rehypeKatex, { output: 'htmlAndMathml', errorColor: KATEX_ERROR_COLOR }],
      [rehypeReportMathErrors, { path: 'chat' }],
    ],
  } as Pluggable,
};

const plugins = { math };

// Streamdown turns every external link into a <button> that opens its own
// confirm modal. Chat links have to stay real anchors (middle-click, copy
// link, target=_blank), so the interstitial is off and `urlTransform` below
// remains the protocol gate.
const linkSafety = { enabled: false };

// Streamdown puts three controls on every table: copy, download and a
// fullscreen expander. The expander opens a modal over the conversation,
// which is more than a chat message needs, so it is off; copy and download
// stay.
const controls = { table: { fullscreen: false } };

// Streamdown clips a table to 300px and scrolls it in place. With the
// fullscreen expander off there is no way out of that box, so a long table
// would be harder to read here than it was before the migration. 'none' is
// Streamdown's documented opt-out and restores full height.
const TABLE_MAX_HEIGHT = 'none';

export default function Markdown({ children, className }: Props) {
  return (
    <div className={cn('space-y-4', className)}>
      <Streamdown
        plugins={plugins}
        components={components}
        // Streamdown splits the message into independently parsed blocks
        // before remark runs, so a blank line inside a `\[...\]` or a
        // `\begin{env}` tears the pair apart and no remark plugin can see
        // it. See lib/latex-aware-blocks.ts.
        parseMarkdownIntoBlocksFn={parseLatexAwareBlocks}
        // Streamdown's remend pass speculatively closes what a half-arrived
        // token opened: a mid-stream `**bold` is rendered bold, and a lone
        // `$` or `\[` is closed into maths that the next token contradicts.
        // Off, a delimiter stays literal until its partner actually lands,
        // which is a beat of raw text instead of a formula that flickers
        // through a wrong shape. See scripts/gallery-cases.ts.
        parseIncompleteMarkdown={false}
        linkSafety={linkSafety}
        controls={controls}
        tableMaxHeight={TABLE_MAX_HEIGHT}
        urlTransform={(url) => {
          // Allow mailto:, tel:, and http(s): protocols
          if (
            url.startsWith('mailto:') ||
            url.startsWith('tel:') ||
            url.startsWith('http://') ||
            url.startsWith('https://')
          ) {
            return url;
          }
          return '';
        }}
      >
        {normalizeListIndentation(children ?? '')}
      </Streamdown>
    </div>
  );
}
