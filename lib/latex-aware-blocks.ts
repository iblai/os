/**
 * @file latex-aware-blocks.ts
 * @input The message source, as handed to <Streamdown>
 * @output Streamdown's own blocks, with any run that a blank line cut through
 *   the middle of a `\[...\]` or `\begin{env}...\end{env}` joined back up.
 * @position `parseMarkdownIntoBlocksFn` on the chat renderer
 *   (components/markdown.tsx). The canvas path parses the whole message at
 *   once and needs none of this.
 *
 * Streamdown splits a message into blocks with marked's lexer BEFORE remark
 * runs, and renders each block as its own independently parsed document. A
 * blank line therefore ends a block, and anything that spans one is torn in
 * two before any remark plugin can see it:
 *
 *     \[
 *     \begin{itemize}
 *       \item One
 *                        <- block boundary
 *       \item Two
 *     \end{itemize}
 *     \]
 *
 * The math extension never sees a closed `\[`, and remark-latex-islands never
 * sees a `\begin` and its `\end` in the same document, so the whole thing
 * reaches the reader as literal backslashes -- while the very same message
 * renders correctly through markdownToHtml(), which parses it in one piece.
 *
 * Streamdown already rejoins blocks on an odd count of `$$`; this adds the
 * two delimiters it does not count. A run is joined only when the closer
 * actually arrives within JOIN_LIMIT blocks: a `\begin` whose `\end` has not
 * been written yet is a reply still streaming, and gluing the rest of the
 * message onto it would relayout everything below on every token.
 *
 * The second repair is the mirror image: a LINK REFERENCE DEFINITION renders
 * nothing itself, and the reference that uses it is almost always in another
 * block. See `withDefinitions` below.
 *
 * SUNSET: the LaTeX joining is compatibility code, like
 * remark-latex-islands.ts, and retires with it -- see the sunset note there.
 * The definition carrying is not: it is a consequence of block splitting and
 * lasts as long as Streamdown does.
 */
import { parseMarkdownIntoBlocks } from 'streamdown';

/**
 * How far a join may reach. The blocks marked emits alternate content and the
 * blank line between them, so this is eight paragraphs of body -- more than
 * any measured environment, and short enough that an unclosed one costs a
 * bounded scan per streamed token.
 */
const JOIN_LIMIT = 16;

/** Fenced and inline code: LaTeX quoted as text opens nothing. */
const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g;

/**
 * `\\` first, so the line break in `\\[2pt]` is consumed as itself rather
 * than read as a display-math opener.
 */
const DELIMITER = /\\\\|\\\[|\\\]|\\(begin|end)\{([a-zA-Z]+\*?)\}/g;

/**
 * Whether `value` leaves a display block or an environment open -- and so
 * needs the block after it to be complete.
 *
 * `malformed` is its own answer, not a kind of `closed`: a closer that
 * matches nothing, or an `\end` for an environment other than the one open,
 * is a broken message rather than an unfinished one. remark-latex-islands
 * leaves those literal, so joining onto them would only make one literal
 * block out of two.
 */
type State = 'open' | 'closed' | 'malformed';

function stateOf(value: string): State {
  const source = value.replace(CODE, '');
  const envs: string[] = [];
  let display = 0;
  DELIMITER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DELIMITER.exec(source))) {
    if (match[1] === 'begin') envs.push(match[2]);
    else if (match[1] === 'end') {
      if (envs.pop() !== match[2]) return 'malformed';
    } else if (match[0] === '\\[') display++;
    else if (match[0] === '\\]' && --display < 0) return 'malformed';
  }
  return display > 0 || envs.length > 0 ? 'open' : 'closed';
}

/**
 * Does the source hold a link reference definition at all? Almost no message
 * does, and the whole mechanism below is skipped when this fails.
 */
const HAS_DEFINITION = /^ {0,3}\[[^\]\n]+\]:/m;
/** A definition line: `[label]: destination "optional title"`. */
const DEFINITION = /^ {0,3}\[[^\]\n]+\]:[ \t]*\S/;
/** The title CommonMark allows on the line after the destination. */
const TITLE = /^[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\))[ \t]*$/;
/** A fence opening or closing a code block. */
const FENCE = /^ {0,3}(?:`{3,}|~{3,})/;
/** A display-maths delimiter alone on its line. */
const DISPLAY = /^[ \t]*(?:\$\$|\\\[|\\\])[ \t]*$/;
/** An environment a definition-looking line may be quoted inside. */
const ENV = /\\(begin|end)\{[a-zA-Z]+\*?\}/g;

/**
 * How much definition text may ride along, and on how many definitions. A
 * reply carries a handful of footnote-style links; the caps stop a pathological
 * message from multiplying its own size by its block count.
 */
const MAX_DEFINITIONS = 32;
const MAX_DEFINITION_CHARS = 4000;

/**
 * Every link reference definition in the source.
 *
 * A definition is invisible -- it renders nothing at all -- so it is safe to
 * repeat, and repeating it is the only way a block holding `[x][y]` can
 * resolve `[y]` when Streamdown parses that block as its own document. Lines
 * inside a code fence, inside display maths or inside a `\begin{...}`
 * environment are being SHOWN, not defining anything, and are skipped.
 */
function definitionsOf(markdown: string): string {
  const lines = markdown.split('\n');
  const found: string[] = [];
  let fence: string | null = null;
  let display = false;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenced = FENCE.exec(line);
    if (fence) {
      if (fenced && line.trimStart().startsWith(fence)) fence = null;
      continue;
    }
    if (fenced) {
      fence = fenced[0].trimStart();
      continue;
    }
    if (DISPLAY.test(line)) {
      display = !display;
      continue;
    }
    ENV.lastIndex = 0;
    let env: RegExpExecArray | null;
    while ((env = ENV.exec(line))) depth += env[1] === 'begin' ? 1 : -1;
    if (display || depth > 0) continue;
    if (!DEFINITION.test(line)) continue;
    let definition = line;
    if (TITLE.test(lines[i + 1] ?? '')) definition += `\n${lines[++i]}`;
    found.push(definition);
    if (found.length >= MAX_DEFINITIONS) break;
  }
  const text = found.join('\n');
  return text.length > MAX_DEFINITION_CHARS ? '' : text;
}

/**
 * The blocks, each one carrying every link reference definition in the
 * message.
 *
 * Streamdown renders each block as an independently parsed document, so
 * `[x][y]` and the `[y]: https://...` that defines it are in two documents
 * that cannot see each other and the reference reaches the reader as literal
 * `[x][y]` -- while the very same message renders correctly through
 * markdownToHtml(), which parses it in one piece.
 *
 * Only blocks that could hold a reference get the passenger, and a block whose
 * code fence has not closed yet is skipped: appending there would show the
 * definitions as code.
 */
function withDefinitions(blocks: string[], markdown: string): string[] {
  const definitions = definitionsOf(markdown);
  if (!definitions) return blocks;
  return blocks.map((block) => {
    if (!block.includes('[')) return block;
    const fences = block.match(/^ {0,3}(?:`{3,}|~{3,})/gm);
    if (fences && fences.length % 2 === 1) return block;
    return `${block}\n\n${definitions}\n`;
  });
}

/** Streamdown's blocks, with torn LaTeX spans put back together. */
export function parseLatexAwareBlocks(markdown: string): string[] {
  const blocks = parseMarkdownIntoBlocks(markdown);
  const out: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    let joined = blocks[i];
    let state = stateOf(joined);
    let close = i;
    for (
      let j = i + 1;
      state === 'open' && j < blocks.length && j - i <= JOIN_LIMIT;
      j++
    ) {
      joined += blocks[j];
      state = stateOf(joined);
      if (state === 'closed') close = j;
    }
    // The closer never arrived: still streaming, or never coming. Either way
    // the block stays as it is and its backslashes stay literal.
    if (close === i) out.push(blocks[i]);
    else {
      out.push(joined);
      i = close;
    }
  }
  return HAS_DEFINITION.test(markdown) ? withDefinitions(out, markdown) : out;
}
