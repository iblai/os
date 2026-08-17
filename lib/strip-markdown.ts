/**
 * @file strip-markdown.ts
 * @input Raw assistant markdown, exactly as it is handed to <Markdown> for display
 * @output A plain-text rendition safe to hand to a speech synthesiser: no `#`,
 *   `*`, `~`, backticks, URLs or LaTeX left for the voice to read out loud.
 * @position Pure transform. Consumed by `useSpeech`'s browser (Web Speech API)
 *   path. The server-side TTS endpoint is NOT a consumer -- that path posts a
 *   message id and the backend derives its own text.
 *
 * Markdown is parsed, not regex-stripped. Regexes cannot tell a `**` emphasis
 * run from the same characters inside a fenced code block, and cannot tell a
 * `$5` price from a `$x$` equation; an mdast walk gets both right for free.
 * The processor is configured with the same plugins as `components/markdown.tsx`
 * (remark-gfm, remark-math) and the same pre-passes (`preprocessLaTeX`,
 * `normalizeListIndentation`), so the node types walked here are exactly the
 * node types the user is looking at while they listen.
 */

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { preprocessLaTeX } from './preprocess-latex';
import { normalizeListIndentation } from './normalize-list-indentation';

/**
 * Structural shape of an mdast node. Declared locally rather than imported from
 * `@types/mdast`: that package is a transitive dependency of remark under pnpm's
 * isolated store, so the bare `mdast` type specifier does not resolve from
 * application code. Only the three fields the walk reads are modelled.
 */
type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
};

/**
 * Nodes whose content is never spoken.
 *
 * - `code` (fenced and indented): reading a program aloud is noise, not
 *   information -- punctuation, sigils and identifiers with no word boundaries.
 *   Dropped outright rather than swapped for a spoken placeholder ("code
 *   block"): the app is localised (see `i18n/`, `messages/`), and a pure
 *   transform has no locale to render such a placeholder in. An English
 *   placeholder read to a French listener is a worse outcome than silence.
 * - `math` / `inlineMath`: `\frac{a}{b}` read literally is gibberish. Dropped
 *   for the same reason, and dropping is why `preprocessLaTeX` runs first --
 *   it escapes prices, so "it costs $5 or $6" stays prose instead of being
 *   parsed as an equation and silently deleted.
 * - `image` / `imageReference`: the picture cannot be spoken and its alt text
 *   is, in practice, a filename or a caption already repeated in the prose.
 * - `definition`: a link-reference definition is a URL, and URLs are never read.
 * - `footnoteReference`: the marker, not the note; the note body is spoken
 *   where its `footnoteDefinition` sits.
 * - `thematicBreak`: a horizontal rule has no spoken form.
 */
const SILENT_TYPES = new Set([
  'code',
  'definition',
  'footnoteReference',
  'image',
  'imageReference',
  'inlineMath',
  'math',
  'thematicBreak',
]);

/** Leaf nodes that carry the spoken text verbatim. */
const LITERAL_TYPES = new Set(['text', 'inlineCode']);

/**
 * Nodes whose children are block-level and so must be kept apart, or a bullet
 * list collapses into one run-on sentence.
 */
const BLOCK_TYPES = new Set([
  'blockquote',
  'footnoteDefinition',
  'list',
  'listItem',
  'root',
]);

/** Separates block-level siblings: headings, paragraphs, list items, rows. */
const BLOCK_SEPARATOR = '\n';

/** Separates the cells of one table row, so a row reads as a phrase. */
const CELL_SEPARATOR = ', ';

/**
 * Concatenates inline children with no separator: the text nodes between them
 * already carry the spacing the author wrote, and inserting anything here would
 * split "**bold**text" into two words.
 */
function renderInline(children: MdastNode[]): string {
  return children.map(renderNode).join('');
}

/** Joins block-level children, discarding the ones that spoke nothing. */
function renderBlocks(children: MdastNode[], separator: string): string {
  return children
    .map(renderNode)
    .filter((part) => part.trim() !== '')
    .join(separator);
}

function renderNode(node: MdastNode): string {
  if (SILENT_TYPES.has(node.type)) return '';

  // Literals, `break` and `html` are the only leaves the configured processor
  // can emit that are not silent, so every node reaching the tail of this
  // function is a parent with children. `stripMarkdownForSpeech` catches the
  // TypeError if that ever stops holding.
  if (LITERAL_TYPES.has(node.type)) return node.value as string;

  // A hard line break is a pause in print; in speech it is just a word gap.
  //
  // Raw HTML lands here too. Its tags reach the renderer through rehype-raw,
  // but a voice reading "less than div greater than" is pure noise, so only the
  // gap survives -- and the gap has to survive: an inline `there<br/>done`
  // whose tag vanished outright would be spoken as the single word "theredone".
  // Text between the tags is unaffected; it is ordinary mdast either way.
  if (node.type === 'break' || node.type === 'html') return ' ';

  const children = node.children as MdastNode[];

  if (node.type === 'tableRow') return renderBlocks(children, CELL_SEPARATOR);

  if (node.type === 'table' || BLOCK_TYPES.has(node.type)) {
    return renderBlocks(children, BLOCK_SEPARATOR);
  }

  // Everything else -- paragraph, heading, tableCell, emphasis, strong, delete,
  // link, linkReference -- contributes its own text and nothing else: the
  // heading loses its hashes, the link keeps its label and loses its URL.
  return renderInline(children);
}

/**
 * Sigils CommonMark declined to consume, which therefore reach the walk as
 * ordinary text and would be spoken: an unclosed `**bold` (LLMs emit these
 * constantly), a stray backtick from an unterminated code span, a `~~` the
 * author escaped. This is a cleanup of plain text, not a second attempt at
 * parsing markdown -- by the time it runs, the parser has already decided that
 * none of these characters are syntax.
 *
 * A lone `_` is deliberately spared: it is a word-forming character in the
 * identifiers this app's assistant writes constantly, and dropping it would
 * fuse `snake_case_name` into one unpronounceable word. A lone `*` is spared
 * for the mirror-image reason -- it is real punctuation ("2 * 3", "*.ts") and
 * speech engines pass over it in silence anyway.
 */
const RESIDUAL_SIGILS = /\*{2,}|_{2,}|~{2,}|`+/g;

/** The glue left behind by a link whose closing paren never arrived. */
const BROKEN_LINK_GLUE = /\]\(/g;

/**
 * Hashes opening a heading the parser rejected -- an escaped `\## x`, or a
 * `#hashtag` with no space after the hash. Either way the listener wants the
 * words, not "hash hash".
 */
const LEADING_HASHES = /^\s*#+/;

/**
 * Turns the collected text into the final spoken string: drops residual sigils,
 * squeezes runs of spaces inside a line, and removes blank lines, so nothing is
 * left with a leading, trailing or interior blank run for the synthesiser to
 * stall on. Newlines survive as the one piece of structure worth keeping -- they
 * are what stops consecutive list items running together into one sentence.
 */
function toSpokenText(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(RESIDUAL_SIGILS, '')
        .replace(BROKEN_LINK_GLUE, ' ')
        .replace(LEADING_HASHES, '')
        .replace(/[^\S\n]+/g, ' ')
        .trim(),
    )
    .filter((line) => line !== '')
    .join('\n');
}

const processor = remark().use(remarkGfm).use(remarkMath);

/**
 * Strips markdown syntax from `markdown`, leaving only what should be spoken.
 *
 * Falls back to the whitespace-collapsed input if parsing throws: a voice
 * reading a stray `##` is a bad day, but a voice reading nothing at all because
 * the button silently threw is worse.
 */
export function stripMarkdownForSpeech(markdown: string): string {
  if (typeof markdown !== 'string' || markdown.trim() === '') return '';

  try {
    const source = normalizeListIndentation(preprocessLaTeX(markdown));
    const tree = processor.parse(source) as unknown as MdastNode;
    return toSpokenText(renderNode(tree));
  } catch {
    return toSpokenText(markdown);
  }
}
