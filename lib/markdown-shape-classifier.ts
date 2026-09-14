/**
 * @file markdown-shape-classifier.ts
 * @input A message's raw markdown source
 * @output A CLASSIFICATION of the constructs the source contains -- tokens
 *   drawn from a closed vocabulary, plus one bucketed length -- never any
 *   fragment of the source itself.
 * @position Pure functions, called from
 *   lib/markdown-render-error-reporter.ts when a render throws.
 *
 * When the markdown renderer throws, the message that broke it cannot be sent
 * anywhere: it is the user's conversation. The Sentry payload for the Fordham
 * crash (`TypeError: Cannot read properties of undefined (reading 'start')`)
 * carried a stack and nothing else, and the trigger -- an em dash glued to a
 * bare autolink -- took days to find. A shape says which constructs were in
 * play without saying a word of what the user wrote.
 *
 * PRIVACY. Every token returned here is a literal from SHAPES or one of the
 * fixed LENGTH_BUCKETS labels. Nothing is ever interpolated from the source,
 * so no token can carry prose, a name, a URL or a secret. That closed
 * vocabulary is what lib/__tests__/markdown-shape-classifier.test.ts pins.
 */
import {
  hasLatexConstruct,
  sourceEnvironments,
} from './markdown-latex-residue';

/** A bare autolink literal: what GFM turns into a link without any syntax. */
const AUTOLINK = /(?:https?:\/\/|www\.)/giu;

/**
 * Punctuation or symbol outside ASCII. An em dash, an en dash, an ellipsis or
 * a curly quote beside an autolink is the shape that produced the Fordham
 * crash, and none of them are in GFM's trailing-punctuation trim set.
 */
const UNICODE_PUNCTUATION = /[\p{P}\p{S}]/u;

const isUnicodePunctuation = (char: string | undefined): boolean =>
  char !== undefined &&
  char.charCodeAt(0) > 127 &&
  UNICODE_PUNCTUATION.test(char);

/**
 * True when a bare autolink literal touches non-ASCII punctuation -- either
 * immediately before it, or inside the unbroken run that GFM will read as the
 * link. See lib/remark-trim-autolink-host.ts for why that run is dangerous.
 */
function hasAutolinkAdjacentUnicodePunctuation(source: string): boolean {
  AUTOLINK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AUTOLINK.exec(source)) !== null) {
    if (isUnicodePunctuation(source[match.index - 1])) return true;
    for (let i = AUTOLINK.lastIndex; i < source.length; i++) {
      const char = source[i];
      if (/\s/.test(char)) break;
      if (isUnicodePunctuation(char)) return true;
    }
  }
  return false;
}

const hasAutolink = (source: string): boolean => {
  AUTOLINK.lastIndex = 0;
  return AUTOLINK.test(source);
};

/** A GFM pipe row -- the shape a table delimiter row sits in. */
const TABLE = /^ {0,3}\|.*\|/m;

/** A list item line, capturing its indentation. */
const LIST_LINE = /^([ \t]*)(?:[-*+]|\d{1,9}[.)]) /;

/** True when some list item is indented further than an earlier, shallower one. */
function hasNestedList(source: string): boolean {
  let shallowest = Infinity;
  for (const line of source.split('\n')) {
    const match = LIST_LINE.exec(line);
    if (!match) continue;
    const indent = match[1].replace(/\t/g, '    ').length;
    if (indent > shallowest) return true;
    if (indent < shallowest) shallowest = indent;
  }
  return false;
}

/** Every detector: a fixed token and the test that earns it. */
const SHAPES: [string, (source: string) => boolean][] = [
  ['autolink', hasAutolink],
  [
    'autolink-adjacent-unicode-punctuation',
    hasAutolinkAdjacentUnicodePunctuation,
  ],
  [
    'math-delimiter',
    (source) => hasLatexConstruct(source) || /\\\(|\$[^$\n]+\$/.test(source),
  ],
  ['latex-environment', (source) => sourceEnvironments(source).length > 0],
  ['code-fence', (source) => /^ {0,3}(?:```|~~~)/m.test(source)],
  ['table', (source) => TABLE.test(source)],
  ['nested-list', hasNestedList],
  [
    'html-block',
    (source) => /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/.test(source),
  ],
  ['footnote', (source) => /\[\^[^\]\s]+\]/.test(source)],
  ['image', (source) => /!\[[^\]]*\][([]/.test(source)],
  ['link-reference', (source) => /^ {0,3}\[[^\]]+\]:\s*\S/m.test(source)],
];

/** Upper bound (exclusive) and the label a source below it earns. */
const LENGTH_BUCKETS: [number, string][] = [
  [64, 'length-0-64'],
  [256, 'length-64-256'],
  [1024, 'length-256-1k'],
  [4096, 'length-1k-4k'],
  [16384, 'length-4k-16k'],
];

const LENGTH_OVERFLOW = 'length-16k-plus';

function lengthBucket(length: number): string {
  for (const [limit, label] of LENGTH_BUCKETS) {
    if (length < limit) return label;
  }
  return LENGTH_OVERFLOW;
}

/**
 * The constructs `source` contains, as classification tokens, plus the bucket
 * its length falls in. Never a character of the source itself.
 */
export function classifyMarkdownShape(source: string): string[] {
  const tokens: string[] = [];
  for (const [token, detect] of SHAPES) {
    if (detect(source)) tokens.push(token);
  }
  tokens.push(lengthBucket(source.length));
  return tokens;
}

/** The complete closed vocabulary, for the privacy guard to assert against. */
export const MARKDOWN_SHAPE_TOKENS: readonly string[] = [
  ...SHAPES.map(([token]) => token),
  ...LENGTH_BUCKETS.map(([, label]) => label),
  LENGTH_OVERFLOW,
];
