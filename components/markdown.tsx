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
    plugins: [[zilMath, { singleDollarTextMath: true }], remarkBreaks],
  } as Pluggable,
  rehypePlugin: {
    plugins: [
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

export default function Markdown({ children, className }: Props) {
  return (
    <div className={cn('space-y-4', className)}>
      <Streamdown
        plugins={plugins}
        components={components}
        parseIncompleteMarkdown={false}
        linkSafety={linkSafety}
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
