/**
 * @file remark-latex-islands.ts
 * @input An mdast tree, after the math extension has carved out `$...$`,
 *   `\(...\)` and `\[...\]`, before remark-breaks and remark-rehype
 * @output The same tree, with complete `\begin{env}...\end{env}` islands, the
 *   `\section`/`\textbf` family and text-styling commands that a model wrapped
 *   in maths replaced by the markdown nodes they mean.
 * @position Runs on both the chat (components/markdown.tsx) and canvas
 *   (lib/utils.ts) paths, after the math plugin and before remark-breaks.
 *
 * The retired system prompt told models to answer in document-mode LaTeX:
 * `\begin{itemize}`, `\section{}`, `\textbf{}`. None of that is markdown and
 * none of it is maths, so it now reaches the reader as literal backslashes.
 *
 * Three rules run here.
 *
 * 1. ISLANDS. Each complete `\begin{env}...\end{env}`, located by balanced
 *    begin/end counting, is rebuilt as the markdown it means: `itemize` and
 *    `enumerate` become lists, `quote` a blockquote, `verbatim` a code fence,
 *    an all-`\verb` `aligned` block a code fence too. Everything around an
 *    island is left exactly as it was.
 *
 *    An environment whose `\end` has not arrived yet converts its COMPLETED
 *    lines, because a reply streams: `\begin{itemize}` and its first items sit
 *    on screen as raw backslashes for as long as the model takes to finish the
 *    list. The last line is half a token and stays literal until its newline
 *    lands, and an `\end` for a different environment later in the message
 *    marks the input malformed rather than in flight, so it stays literal too.
 *
 *    Detection runs against the RAW SOURCE, sliced with each block's
 *    `position` offsets, not against the parsed inline children. An
 *    environment whose items contain `$x = 4$`, `` `code` `` or `**bold**` is
 *    several mdast children, not one text node, so `\begin` and `\end` land in
 *    different nodes and a children-based scan never sees the pair.
 *
 *    Item bodies are handed back to `this.parse` -- the host processor's own
 *    parser, with its exact math and GFM configuration -- so inline content
 *    inside an item behaves precisely as it does anywhere else in the message,
 *    and nested environments recurse. That removes the need for a LaTeX parser
 *    for these environments: the structure is a `\item` split and the content
 *    is markdown. `\&`, `\%`, `\_` and friends need no unescaping either,
 *    because CommonMark's backslash escapes cover the same ASCII punctuation
 *    and resolve them to the same characters.
 *
 * 2. MATH-WRAPPED STYLING. `$\textbf{Custom AI Agents}$` is not maths; it is a
 *    model reaching for bold and finding the wrong syntax. KaTeX renders it as
 *    serif math-bold sitting inside sans-serif prose. When a span's ENTIRE
 *    body is one text-styling command -- or one doubled markdown marker,
 *    `$**Custom AI Agents**$`, the same mistake in a different dialect -- it is
 *    unwrapped to the markdown equivalent. The sole-content test is the whole
 *    discriminator: `$0.075 \text{ L} \times \frac{1000}{1}$` is real maths
 *    that merely contains `\text`, and stays maths; a single `*` or `_` is
 *    ordinary maths where `**` and `__` never are.
 *
 * 3. DISPLAY BLOCKS THAT ARE NOT MATHS. `\[\begin{itemize}...\end{itemize}\]`
 *    is a list, and KaTeX answers it with a red "No such environment"; it is
 *    rebuilt as blocks. `\[\textbf{Week 1}\]` is a heading in the same
 *    costume and unwraps like its inline form. A display block whose body is a
 *    PLAIN-text command -- `$$\text{Step 2: Multiply first}$$` between two
 *    equations -- is a centred annotation, which is exactly what a display
 *    block renders, so that one stays maths.
 *
 * 4. RESIDUAL MATHS. An item lifted out of `\[...\]` was written where maths
 *    commands were legal, so `\item \textbf{Qualifying:} \approx 60 minutes`
 *    carries an `\approx` that means nothing in prose and reaches the reader
 *    as a raw backslash. Every command left in text REBUILT FROM A MATHS NODE
 *    -- and only there; `\approx` typed in ordinary prose stays literal -- is
 *    wrapped back into an inline math span, so KaTeX renders the symbol it
 *    always meant. KaTeX is also asked whether it can render the span at all,
 *    which keeps `\notarealcommand` as the readable text it already was
 *    instead of a red error box, and keeps a symbol table out of this file.
 *
 * Only the environments measured to convert cleanly are handled. `array` and
 * `center` (which lose their meaning), `tabular` (an alignment grid markdown
 * cannot express without guessing a header row) and `\&`/`\%` in prose are all
 * left literal.
 *
 * A single cheap regex over the source gates the whole pass, so content with
 * no document-mode LaTeX -- almost all of it -- pays one test and stops.
 *
 * SUNSET: this is compatibility code. It exists only for mentors created
 * before 2026-07-30, which still carry the old system prompt (removed for new
 * agents in 751971e4). Delete this file, its wiring and its tests once
 * messages from those mentors fall below a meaningful share of reads.
 */
import type {
  BlockContent,
  Nodes,
  Paragraph,
  Parent,
  PhrasingContent,
  Root,
  RootContent,
} from 'mdast';
import katex from 'katex';
import { SKIP, visit } from 'unist-util-visit';

import { extractVerbRows } from './rehype-verb-code';

/** Fails fast on content with no document-mode LaTeX at all. */
const GATE =
  /\\(?:begin|(?:sub){0,2}section|text(?:bf|it|rm|tt|sf|normal)?|emph|underline|verb)\b|\$\$?[ \t]*(?:\*\*|__)/;

/** `aligned` is not converted; it is only inspected for `\verb` code rows. */
const VERB_ENV = /^(?:align|aligned)\*?$/;

/** A `\begin{env}` or a `\section`-family heading, the two island openers. */
// Built per scan rather than shared: island detection recurses into item
// bodies, and a module-level `lastIndex` would leak between the two levels.
const islandOpener = () =>
  /\\begin\{([a-zA-Z]+\*?)\}|\\((?:sub){0,2})section\*?[ \t]*\{/g;
/**
 * The commands converted when they appear in ordinary prose: a styling command
 * taking a `{...}` argument, or `\verb` with its one-character delimiter.
 * The plain-text family (`\text`, `\textrm`, ...) is deliberately absent --
 * outside maths those carry no formatting, and claiming them would rewrite
 * prose that merely names the command.
 */
const PROSE_COMMAND =
  /\\(textbf|textit|emph|texttt|underline)[ \t]*\{|\\verb\*?([^\sA-Za-z0-9*])/g;

/**
 * How each text-styling command reads once it is out of maths.
 * `underline` maps to emphasis rather than `<u>`: Streamdown's sanitizer
 * drops `u` outright, so an underline would silently lose all marking.
 */
type Style = 'strong' | 'em' | 'code' | 'plain';
const MATH_STYLE: Record<string, Style> = {
  textbf: 'strong',
  textit: 'em',
  emph: 'em',
  underline: 'em',
  texttt: 'code',
  text: 'plain',
  textrm: 'plain',
  textsf: 'plain',
  textnormal: 'plain',
};
/** A font switch opening the argument, as in `\textrm{\bf Bold}`. */
const SWITCH = /^\\(bf|bfseries|it|itshape|em|tt|ttfamily)(?![a-zA-Z])[ \t]*/;
const SWITCH_STYLE: Record<string, Style> = {
  bf: 'strong',
  bfseries: 'strong',
  it: 'em',
  itshape: 'em',
  em: 'em',
  tt: 'code',
  ttfamily: 'code',
};

/** Parses a markdown fragment with the host processor's own parser. */
type ParseFragment = (value: string) => RootContent[];

type Island =
  | {
      start: number;
      end: number;
      kind: 'env';
      env: string;
      body: string;
      /** The `\end` has not arrived yet; only completed lines are in `body`. */
      partial: boolean;
    }
  | {
      start: number;
      end: number;
      kind: 'heading';
      depth: number;
      body: string;
    };

/**
 * One slice of raw source to scan, plus what the scan may not touch.
 * `stream` carries the whole message so an environment whose `\end` has not
 * been written yet can be told apart from one that never will be; it is absent
 * when the slice is a fragment of a fragment, which is never mid-stream on its
 * own account.
 */
type Region = {
  value: string;
  parse: ParseFragment;
  masked: [number, number][];
  stream?: { source: string; base: number };
};

/**
 * The body of the `{...}` group opening at `open`, and the index just past its
 * closing brace, or null when it never closes.
 */
function readGroup(
  value: string,
  open: number,
): { body: string; end: number } | null {
  let depth = 0;
  for (let i = open; i < value.length; i++) {
    if (value[i] === '\\') {
      i++;
      continue;
    }
    if (value[i] === '{') depth++;
    else if (value[i] === '}' && --depth === 0) {
      return { body: value.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * The `\end` that closes the environment whose body starts at `bodyStart`,
 * counting nested environments, or null when it is never closed by a matching
 * `\end` -- a mid-stream or malformed message, which must stay literal rather
 * than have an environment closed on its behalf.
 */
function closeOf(
  value: string,
  bodyStart: number,
  env: string,
): { body: string; end: number } | null {
  const token = /\\(begin|end)\{([a-zA-Z]+)\*?\}/g;
  token.lastIndex = bodyStart;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(value))) {
    if (match[1] === 'begin') depth++;
    else if (depth > 0) depth--;
    else if (match[2] !== env) return null;
    else {
      return {
        body: value.slice(bodyStart, match.index),
        end: match.index + match[0].length,
      };
    }
  }
  return null;
}

/**
 * The environments converted while their `\end` is still in flight. A reply
 * streams token by token, so `\begin{itemize}` and its first items are on
 * screen for as long as the model takes to finish the list -- reading as raw
 * backslashes the whole time unless the finished part is converted as it
 * arrives.
 */
const STREAMING_ENV = /^(?:itemize|enumerate|quote)$/;

/**
 * The shapes a display block is rebuilt as blocks for: a list, or a `tabular`
 * grid. Everything else a display block may hold is either real maths or the
 * `aligned`/`\verb` code idiom, which rehype-verb-code unwraps a stage later.
 * `array` is deliberately absent -- KaTeX renders it, so rewriting it as a
 * markdown table would replace working maths with a worse approximation.
 */
const DISPLAY_BLOCKS = /\\begin\{(?:itemize|enumerate|tabular)\}/;

/** A nested environment inside a list body that carries no `\item` of its own. */
const NESTED_ENV = /\\begin\{[a-zA-Z]+\*?\}/;

/**
 * The part of an unclosed environment that is safe to convert, or null when
 * there is none.
 *
 * Only the COMPLETED lines convert: the last line of a message still being
 * written is half a token, and converting it would make the item flicker as
 * its own text lands. A `\end{` anywhere later in the message means this is
 * not a message in flight but a mismatched environment, which stays literal
 * rather than have an environment closed on its behalf.
 */
function streamingBody(
  region: Region,
  start: number,
  bodyStart: number,
  env: string,
): { body: string; end: number } | null {
  const { value, stream } = region;
  if (!stream || !STREAMING_ENV.test(env)) return null;
  if (stream.source.indexOf('\\end{', stream.base + start) !== -1) return null;
  const tail = value.slice(bodyStart);
  // Anything after the region in the message means the region's own last line
  // has already been terminated, so all of it is complete.
  if (stream.base + value.length < stream.source.length) {
    return { body: tail, end: value.length };
  }
  const lastLine = tail.lastIndexOf('\n');
  return lastLine === -1
    ? null
    : { body: tail.slice(0, lastLine), end: bodyStart + lastLine };
}

/** How far a region may reach across siblings for the `\end` that closes it. */
const SPAN_LIMIT = 16;

/**
 * Fenced and inline code inside a span: LaTeX quoted as text closes nothing,
 * so a `` `\end{itemize}` `` in a code fence must not end the environment the
 * span is looking for the real end of.
 */
const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g;

/**
 * The environment a slice of source leaves open, or null when it opens none,
 * closes everything it opens, or is malformed -- an `\end` for an environment
 * other than the one open, which reaches no further because it stays literal.
 */
function openEnv(value: string): string | null {
  const token = /\\(begin|end)\{([a-zA-Z]+)\*?\}/g;
  value = value.replace(CODE, '');
  const envs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = token.exec(value))) {
    if (match[1] === 'begin') envs.push(match[2]);
    else if (envs.pop() !== match[2]) return null;
  }
  return envs[0] ?? null;
}

/**
 * The source one region covers: the visited paragraph, plus the blocks after
 * it when something inside the environment split it off.
 *
 * A blank line between two `\item`s is a loose list, not a terminator -- but
 * it ends an mdast block, so the outer `\begin` and its `\end` land in
 * different siblings and a scan of one node never sees the pair. Nor is a
 * blank line the only splitter: a fenced code block, an HTML tag, a markdown
 * list, a heading, a table or a rule inside an environment ends the paragraph
 * just as hard, so ANY block type may be crossed. The reach is bounded by
 * SPAN_LIMIT and by the `\end` actually arriving: an environment whose `\end`
 * never comes is left exactly as it was rather than swallowing the rest of
 * the message.
 */
function spanOf(
  siblings: RootContent[],
  index: number,
  source: string,
  from: number,
  end: number,
): { end: number; count: number } {
  const alone = { end, count: 1 };
  if (!openEnv(source.slice(from, end))) return alone;
  for (let i = index + 1; i < siblings.length && i - index <= SPAN_LIMIT; i++) {
    const sibling = siblings[i];
    const to = sibling.position?.end.offset;
    if (to === undefined) return alone;
    if (!openEnv(source.slice(from, to)))
      return { end: to, count: i - index + 1 };
  }
  return alone;
}

/** Every complete island in `region` whose opener is not inside its mask. */
function findIslands(region: Region): Island[] {
  const { value, masked } = region;
  const islands: Island[] = [];
  const inMask = (at: number) =>
    masked.some(([from, to]) => at >= from && at < to);
  const opener = islandOpener();
  let match: RegExpExecArray | null;
  while ((match = opener.exec(value))) {
    if (inMask(match.index)) continue;
    const [text, env, subs] = match;
    if (env === undefined) {
      const group = readGroup(value, match.index + text.length - 1);
      if (!group) continue;
      islands.push({
        start: match.index,
        end: group.end,
        kind: 'heading',
        depth: 2 + subs.length / 3,
        body: group.body,
      });
    } else {
      const name = env.replace('*', '');
      const bodyStart = match.index + text.length;
      // `verbatim` is literal by definition: its body may contain anything,
      // including text that looks like another environment, so it closes at
      // the first `\end{verbatim}` rather than by depth counting.
      const close =
        name === 'verbatim'
          ? verbatimClose(value, bodyStart)
          : closeOf(value, bodyStart, name);
      const partial = close
        ? null
        : streamingBody(region, match.index, bodyStart, name);
      if (!close && !partial) continue;
      islands.push({
        start: match.index,
        end: (close ?? partial)!.end,
        kind: 'env',
        env: name,
        body: (close ?? partial)!.body,
        partial: !close,
      });
    }
    opener.lastIndex = islands[islands.length - 1].end;
  }
  return islands;
}

function verbatimClose(value: string, bodyStart: number) {
  const at = value.indexOf('\\end{verbatim}', bodyStart);
  return at === -1
    ? null
    : { body: value.slice(bodyStart, at), end: at + '\\end{verbatim}'.length };
}

/**
 * A markdown list marker opening an `\item` body -- `\item - First`, `\item
 * 1. First` -- is a doubled marker: the model wrote the LaTeX one and then the
 * markdown one too. The environment already supplies the marker, so the
 * redundant one is DROPPED; leaving it in place showed the reader a bullet and
 * a dash, and leaving it unescaped opened a one-item sublist inside every item.
 *
 * A marker only counts as one when a separator follows it, so `\item -5
 * degrees` keeps its minus sign. End of body counts as a separator too: an
 * `\item -` with nothing after it is an empty item, not a nested list.
 */
const DOUBLED_MARKER = /^([-*+]|\d{1,9}[.)])(?=\s|$)/;
const undouble = (item: string) => item.replace(DOUBLED_MARKER, '').trimStart();

/**
 * The bodies of an environment's `\item`s, split only on the `\item`s that sit
 * outside any nested environment, or null when it has none.
 */
function splitItems(body: string): string[] | null {
  const token = /\\(begin|end)\{[a-zA-Z]+\*?\}|\\item(?![a-zA-Z])[ \t]*(\[)?/g;
  const items: { at: number; from: number }[] = [];
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    if (match[1] === 'begin') depth++;
    else if (match[1] === 'end') depth--;
    else if (depth === 0) {
      const after = match.index + match[0].length;
      // `\item[label]` -- the optional label is presentational, so it is
      // dropped and the body starts after it.
      const label = match[2] ? readOptional(body, after - 1) : null;
      items.push({ at: match.index, from: label ?? after });
    }
  }
  if (!items.length) return null;
  return items.map(({ from }, i) =>
    body.slice(from, items[i + 1]?.at ?? body.length),
  );
}

/** The index just past a `[...]` optional argument opening at `open`. */
function readOptional(value: string, open: number): number | null {
  const close = value.indexOf(']', open);
  return close === -1 ? null : close + 1;
}

/** Strips positions from generated nodes so no later pass re-slices by them. */
function unposition(nodes: RootContent[]): RootContent[] {
  for (const node of nodes) {
    visit(node as Nodes, (child) => {
      delete child.position;
    });
  }
  return nodes;
}

/** The phrasing content of a markdown fragment. */
function inlineOf(value: string, parse: ParseFragment): PhrasingContent[] {
  const [first] = parse(value);
  return first?.type === 'paragraph' ? first.children : [];
}

function styleNodes(
  style: Style,
  body: string,
  parse: ParseFragment,
): PhrasingContent[] {
  const preface = SWITCH.exec(body);
  if (preface) {
    return styleNodes(
      SWITCH_STYLE[preface[1]],
      body.slice(preface[0].length),
      parse,
    );
  }
  if (style === 'code') {
    return [
      { type: 'inlineCode', value: body.replace(/\\([&%$#_{}])/g, '$1') },
    ];
  }
  // The argument may hold styling commands of its own -- `\textbf{a \textit{b}
  // c}`. `splitInline` consumed the outer one and skipped past its whole
  // group, so nothing else ever revisits the inside; without this the nested
  // command reaches the reader as a raw backslash.
  const children = restyle(inlineOf(body, parse), parse);
  if (style === 'plain') return children;
  if (style === 'strong') return [{ type: 'strong', children }];
  return [{ type: 'emphasis', children }];
}

/**
 * A span whose whole body is a doubled-marker markdown run -- `$**Custom AI
 * Agents**$`. The model reached for bold, wrapped it in the maths delimiters
 * it had been told to use, and KaTeX renders the markers as literal stars
 * (`∗∗CustomAIAgents∗∗`) or, when the run holds a character TeX reserves,
 * fails outright. Only DOUBLED markers qualify: a single `*` or `_` is
 * ordinary maths (`$a * b$`, `$x_1$`), `**` and `__` never are.
 */
const MATH_EMPHASIS = /^(?:\*\*[^*\n]+\*\*|__[^_\n]+__)$/;

/**
 * The markdown a math span means when its whole body is one styling command,
 * or null when it is maths and must stay maths.
 *
 * `display` spans (`$$...$$`, `\[...\]`) accept only the STYLING commands.
 * A display span whose body is a plain-text command -- `$$\text{Step 2:
 * Multiply first}$$` between two equations -- is a centred annotation, which
 * is exactly what a display block renders, so it stays maths.
 */
function unwrapMathStyle(
  value: string,
  parse: ParseFragment,
  display: boolean,
): PhrasingContent[] | null {
  const tex = value.trim();
  if (MATH_EMPHASIS.test(tex)) return inlineOf(tex, parse);
  const opener = /^\\([a-zA-Z]+)[ \t]*\{/.exec(tex);
  const style = opener && MATH_STYLE[opener[1]];
  if (!style || (display && style === 'plain')) return null;
  const group = readGroup(tex, opener[0].length - 1);
  // Sole content: anything after the command's argument makes this real maths
  // that merely mentions a text command.
  if (!group || group.end !== tex.length) return null;
  return styleNodes(style, group.body, parse);
}

/**
 * A display block that is prose wearing a maths costume: `\[\textbf{Short
 * answer:} I can't use a web tool in this chat, ...\]`. KaTeX sets the words
 * outside the `\textbf{...}` group in MATH mode, which drops every space
 * between them, and the reader gets `Ican'tuseawebtoolinthischat`.
 *
 * The discriminator is a run of BARE words -- words that sit outside every
 * `{...}` group and are not command names. Real display maths never carries
 * one: its prose lives inside `\text{}` (`\frac{\text{Thrust}}{\text{Fuel
 * weight flow rate}}`), and its own symbols are single letters. An
 * environment is excluded outright: `aligned` rows and the `\verb` code idiom
 * are read by their own rules, a stage later.
 */
const BARE_WORDS = 4;
const GROUP = /\{[^{}]*\}/g;

function isProse(tex: string): boolean {
  if (tex.includes('\\begin{')) return false;
  let value = tex;
  for (let next = value.replace(GROUP, ' '); next !== value; ) {
    value = next;
    next = value.replace(GROUP, ' ');
  }
  const bare = value.replace(/\\[a-zA-Z]+/g, ' ').match(/[A-Za-z]{2,}/g);
  return (bare?.length ?? 0) >= BARE_WORDS;
}

/**
 * The other half of the same costume: a display block whose every word sits
 * INSIDE `\text{}` -- `\[\text{Hi Conrad, how can I help you today?}\]`, or an
 * `aligned` whose every row is one such run. `isProse` cannot see these: it
 * counts BARE words and there are none, so the sentence stays maths and KaTeX
 * sets it centred, in a serif face, at display scale.
 *
 * The discriminator against a legitimate centred annotation -- `$$\text{Step
 * 2}$$` or `$$\text{Step 2: Multiply first (order of operations)}$$` standing
 * between two equations -- is that an annotation is a LABEL and this is a
 * SENTENCE: `isProse`'s own word floor, plus a full stop, question mark or
 * exclamation mark at the end. A caption carries neither.
 *
 * Inline spans never reach here (only `math` nodes do), so `$0.075 \text{ L}
 * \times \frac{1000 \text{ mL}}{1 \text{ L}} = 75 \text{ mL}$` is untouched;
 * and a display block that merely CONTAINS `\text{}` fails at the first
 * character outside a group that is not a separator.
 */
const TEXT_ROWS =
  /^\\begin\{(align|aligned|gather|gathered)\*?\}([\s\S]*)\\end\{\1\*?\}$/;
const TEXT_OPEN = /^\\(?:text|textrm|textsf|textnormal)[ \t]*\{/;
/**
 * All that may sit between the `\text{}` groups. Whitespace and the `~` tie
 * are the spaces a row is written with; `&` is the alignment column marker an
 * `aligned` row opens with and carries no text of its own. An operator, a
 * relation or any other command means real maths.
 */
const TEXT_GLUE = /[\s&~]/;
/**
 * How a sentence ends, allowing the closing quote or bracket that may follow
 * the stop: `I received: "e2e first msg 1781965048662".`
 */
const SENTENCE_END = /[.?!\u2026]['"\u2019\u201d)\]]*$/;

/** The words one row's `\text{}` groups spell, or null when it is maths. */
function textRow(tex: string): string | null {
  let out = '';
  for (let i = 0; i < tex.length; ) {
    const rest = tex.slice(i);
    const open = TEXT_OPEN.exec(rest);
    if (open) {
      const group = readGroup(rest, open[0].length - 1);
      if (!group) return null;
      out += group.body;
      i += group.end;
      continue;
    }
    const char = rest[0];
    if (!TEXT_GLUE.test(char)) return null;
    if (char !== '&') out += char === '~' ? ' ' : char;
    i++;
  }
  return out;
}

/** The paragraphs an all-`\text{}` display block means, or null when it is maths. */
function textProse(tex: string, parse: ParseFragment): RootContent[] | null {
  const env = TEXT_ROWS.exec(tex.trim());
  const lines: string[] = [];
  // A row break is a row break inside an environment or out of one: the same
  // `\\` that separates `aligned` rows also separates the lines of a bare
  // `\[...\]` block, and each becomes its own paragraph.
  for (const row of (env ? env[2] : tex).split(/\\\\/)) {
    if (!row.trim()) continue;
    const text = textRow(row);
    if (text === null) return null;
    lines.push(text.trim());
  }
  const prose = lines.join('\n\n');
  const words = prose.match(/[A-Za-z]{2,}/g);
  if ((words?.length ?? 0) < BARE_WORDS) return null;
  if (!SENTENCE_END.test(prose)) return null;
  return blocksOf(prose, parse);
}

/**
 * `tabular` is an alignment grid, and KaTeX has no such environment: inside
 * `\[...\]` it answers with a red error box, and outside it the source reaches
 * the reader as raw backslashes. Markdown does have a grid, so the island is
 * rebuilt as a real `table` node -- the first row its header, the column
 * letters its alignment.
 *
 * Only `tabular`. `array` is the same shape but KaTeX RENDERS it, so
 * converting it would trade working maths for a worse approximation.
 */
const RULE = /\\(?:hline|toprule|midrule|bottomrule|cline\{[^}]*\})[ \t]*/g;
/** A row break, with the `[2pt]` spacing argument it may carry. */
const ROW_BREAK = /\\\\(?:\[[^\]]*\])?/;
/** `\text{Disease}` in a cell is a word, not maths. */
const CELL_TEXT = /\\text[ \t]*\{([^{}]*)\}/g;
/** `12{,}500` is LaTeX's thousands separator, not a group. */
const THOUSANDS = /\{,\}/g;

type Align = 'left' | 'center' | 'right' | null;

/** The per-column alignment a `{lcc}` column spec means. */
function alignOf(spec: string, columns: number): Align[] {
  const align: Align[] = [];
  for (let i = 0; i < spec.length; i++) {
    const letter = spec[i];
    if (letter === 'c') align.push('center');
    else if (letter === 'r') align.push('right');
    else if ('lpmbX'.includes(letter)) align.push('left');
    else continue;
    // `p{3cm}` and friends carry a width the letter owns.
    if (spec[i + 1] === '{') {
      const width = readGroup(spec, i + 1);
      if (width) i = width.end - 1;
    }
  }
  while (align.length < columns) align.push(null);
  return align.slice(0, columns);
}

/**
 * The `table` node a `tabular` body means, or nothing at all when every row
 * was a rule. An empty grid is nothing to show -- and leaving it literal put
 * a red KaTeX error box where the reader could see it.
 */
function tabularNodes(body: string, parse: ParseFragment): RootContent[] {
  // The `{lcc}` column spec opens the body: the island opener stopped at the
  // environment name's closing brace.
  const spec = /^[ \t\r\n]*\{/.exec(body);
  const group = spec ? readGroup(body, spec[0].length - 1) : null;
  const rows = (group ? body.slice(group.end) : body)
    .replace(RULE, '')
    .split(ROW_BREAK)
    .map((row) => row.trim())
    .filter((row) => row.length > 0)
    .map((row) =>
      row
        .split('&')
        .map((cell) =>
          cell.replace(CELL_TEXT, '$1').replace(THOUSANDS, ',').trim(),
        ),
    );
  if (!rows.length) return [];
  const columns = Math.max(...rows.map((row) => row.length));
  return [
    {
      type: 'table',
      align: alignOf(group?.body ?? '', columns),
      children: rows.map((cells) => ({
        type: 'tableRow' as const,
        children: cells.map((cell) => ({
          type: 'tableCell' as const,
          children: inlineOf(cell, parse),
        })),
      })),
    },
  ];
}

/** The markdown nodes one island means, or null to leave it literal. */
function islandNodes(
  island: Island,
  parse: ParseFragment,
): RootContent[] | null {
  if (island.kind === 'heading') {
    return [
      {
        type: 'heading',
        depth: island.depth as 2 | 3 | 4,
        children: inlineOf(island.body, parse),
      },
    ];
  }
  const { env, body } = island;
  if (env === 'verbatim') {
    return [
      {
        type: 'code',
        lang: null,
        meta: null,
        value: body.replace(/^\n/, '').replace(/\s+$/, ''),
      },
    ];
  }
  if (env === 'tabular') return tabularNodes(body, parse);
  if (VERB_ENV.test(env)) {
    const rows = extractVerbRows(`\\begin{${env}}${body}\\end{${env}}`);
    return rows
      ? [{ type: 'code', lang: null, meta: null, value: rows.join('\n') }]
      : null;
  }
  if (env === 'quote') {
    // Nothing has streamed in past the opener yet: the environment is real but
    // empty, so it renders as nothing rather than as an empty blockquote.
    if (island.partial && !body.trim()) return [];
    return [
      { type: 'blockquote', children: blocksOf(body, parse) as BlockContent[] },
    ];
  }
  if (env !== 'itemize' && env !== 'enumerate') return null;
  const items = splitItems(body);
  // A list with no `\item` of its own but a nested environment inside it --
  // `\begin{itemize}\begin{itemize}\item Deep\end{itemize}\end{itemize}`,
  // which the model wrapped one level too many. The outer marker has nothing
  // to mark, so it is transparent and the body converts on its own; leaving
  // the whole thing literal showed the reader five raw commands instead.
  if (!items) {
    if (island.partial) return [];
    return NESTED_ENV.test(body) ? blocksOf(body, parse) : null;
  }
  return [
    {
      type: 'list',
      ordered: env === 'enumerate',
      start: env === 'enumerate' ? 1 : null,
      // Tight, like every other list in a message: `<li>text</li>` rather than
      // `<li><p>text</p></li>`, so converted items sit at the same rhythm as
      // markdown ones.
      spread: false,
      children: items.map((item) => ({
        type: 'listItem' as const,
        spread: false,
        checked: null,
        children: blocksOf(undouble(item.trim()), parse) as BlockContent[],
      })),
    },
  ];
}

/** The offsets of every fenced and inline code run in a raw fragment. */
function codeRanges(value: string): [number, number][] {
  const ranges: [number, number][] = [];
  CODE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE.exec(value))) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/**
 * Block content for a region, converting any islands inside it.
 *
 * The mask is rebuilt here rather than inherited: this is a RAW fragment of
 * the message (an `\item` body, a `quote` body), so the only thing that has
 * looked at it is a regex, and a `` `\begin{enumerate}` `` the reader is
 * being shown inside it would otherwise open an island one level down that
 * the top-level mask had already refused.
 */
function blocksOf(raw: string, parse: ParseFragment): RootContent[] {
  return (
    splitBlocks({ value: raw, parse, masked: codeRanges(raw) }) ??
    parse(raw.trim())
  );
}

/** Inline content as the one paragraph that replaces a block-level node. */
function wrapPhrasing(
  children: PhrasingContent[] | null,
): RootContent[] | null {
  return children && [{ type: 'paragraph', children }];
}

/**
 * A display delimiter alone on the line before an island, and its closer alone
 * on the line after. A model that wrapped `\begin{tabular}` in `$$...$$` wrote
 * maths delimiters around something that is not maths; the pair only reaches
 * here when the math extension declined to claim it (a `$$` span may not cross
 * a line ending), and once the island inside is a table the delimiters are
 * orphans that would reach the reader as two `$$` paragraphs.
 *
 * Anchored to whole lines so a real `$$x$$` span that merely SITS beside an
 * island is not mistaken for a wrapper around it.
 */
const OPEN_DELIM = /(?:^|\n)[ \t]*(\$\$|\\\[)[ \t]*$/;
const CLOSE_DELIM = /^[ \t]*(\$\$|\\\])[ \t]*(?:\n|$)/;
const CLOSER: Record<string, string> = { $$: '$$', '\\[': '\\]' };

/**
 * Block-level replacement for a region of raw source, or null when it holds no
 * convertible island and the already-parsed nodes should be kept.
 */
function splitBlocks(region: Region): RootContent[] | null {
  const { value, parse } = region;
  const out: RootContent[] = [];
  let pos = 0;
  let converted = 0;
  for (const island of findIslands(region)) {
    const nodes = islandNodes(island, parse);
    if (!nodes) continue;
    let lead = value.slice(pos, island.start);
    let end = island.end;
    const opener = OPEN_DELIM.exec(lead);
    const closer = CLOSE_DELIM.exec(value.slice(end));
    if (opener && closer && CLOSER[opener[1]] === closer[1]) {
      lead = lead.slice(0, opener.index);
      end += closer[0].length;
    }
    out.push(...parse(lead.trim()), ...nodes);
    pos = end;
    converted++;
  }
  if (!converted) return null;
  out.push(...parse(value.slice(pos).trim()));
  return out;
}

/**
 * The same nodes, with any styling command still inside their text converted.
 * `styleNodes` uses it to reach the inside of an argument it has just taken.
 */
function restyle(
  nodes: PhrasingContent[],
  parse: ParseFragment,
): PhrasingContent[] {
  const root = { type: 'root', children: nodes } as unknown as Root;
  visit(root, 'text', (node, index, parent) => {
    /* istanbul ignore next -- @preserve visit omits these only for the root */
    if (index === undefined || !parent) return;
    const phrasing = splitInline(node.value, parse);
    if (!phrasing) return;
    (parent as Parent).children.splice(index, 1, ...phrasing);
    return index + phrasing.length;
  });
  return root.children as PhrasingContent[];
}

/** Inline replacement for a prose text node, or null to leave it alone. */
function splitInline(
  value: string,
  parse: ParseFragment,
): PhrasingContent[] | null {
  PROSE_COMMAND.lastIndex = 0;
  const out: PhrasingContent[] = [];
  let pos = 0;
  let match: RegExpExecArray | null;
  while ((match = PROSE_COMMAND.exec(value))) {
    const after = match.index + match[0].length;
    // `\verb<d>...<d>` closes on its delimiter; every other command on the
    // balanced `{...}` group its match already opened.
    const verb = match[2];
    const close = verb ? value.indexOf(verb, after) : -1;
    const group = verb
      ? close === -1
        ? null
        : { body: value.slice(after, close), end: close + 1 }
      : readGroup(value, after - 1);
    if (!group) continue;
    if (match.index > pos) {
      out.push({ type: 'text', value: value.slice(pos, match.index) });
    }
    out.push(
      ...(verb
        ? [{ type: 'inlineCode' as const, value: group.body }]
        : styleNodes(MATH_STYLE[match[1]], group.body, parse)),
    );
    pos = group.end;
    PROSE_COMMAND.lastIndex = group.end;
  }
  if (!out.length) return null;
  if (pos < value.length) out.push({ type: 'text', value: value.slice(pos) });
  return out;
}

/**
 * The commands this file converts out of text itself, which a residual scan
 * must therefore leave alone: the island openers, `\item`, the styling family
 * `splitInline` rewrites as markdown, and the font switches `styleNodes`
 * reads. The PLAIN-text family (`\text`, `\textrm`, ...) is deliberately
 * absent -- nothing rewrites it in free text, so it is a residual like any
 * other, and a `$\text{USD}$` span unwraps to its own words one visit later.
 */
const HANDLED = new Set([
  'begin',
  'end',
  'item',
  'verb',
  'section',
  'subsection',
  'subsubsection',
  'textbf',
  'textit',
  'emph',
  'texttt',
  'underline',
  ...Object.keys(SWITCH_STYLE),
]);

/** A command name at the start of a slice, with its optional `*` variant. */
const COMMAND = /^\\([a-zA-Z]+)\*?/;

/**
 * The index just past the command at `at` and everything it owns: for `\verb`
 * its delimited body, for anything else the `[...]` and `{...}` arguments
 * written straight after it. `\frac` alone is a KaTeX error and `\frac{1}{2}`
 * is a fraction, so an argument travels with the command that takes it.
 */
function commandEnd(value: string, name: string, after: number): number {
  if (name === 'verb') {
    const delim = value[after];
    if (!delim) return after;
    const close = value.indexOf(delim, after + 1);
    return close === -1 ? value.length : close + 1;
  }
  let at = after;
  for (;;) {
    if (value[at] === '{') {
      const group = readGroup(value, at);
      if (!group) return at;
      at = group.end;
    } else if (value[at] === '[') {
      const close = readOptional(value, at);
      if (close === null) return at;
      at = close;
    } else return at;
  }
}

/**
 * The run of maths starting at `start`: one unhandled command with its
 * arguments, plus any further commands separated from it by nothing but
 * spaces, or null when the command there is one this file handles.
 *
 * Only COMMANDS join the run. `\approx 60 minutes` keeps its number in prose
 * -- measured against the alternative, `$\approx 60 minutes$` sets the digits
 * and the word in italic maths with the spaces dropped, which is worse than
 * the raw backslash it replaces.
 */
function readRun(value: string, start: number): { tex: string; end: number } {
  let at = start;
  let end = start;
  for (;;) {
    const command = COMMAND.exec(value.slice(at));
    if (!command || HANDLED.has(command[1])) break;
    end = commandEnd(value, command[1], at + command[0].length);
    at = end;
    const gap = /^[ \t]+/.exec(value.slice(at));
    if (!gap) break;
    at += gap[0].length;
  }
  return { tex: value.slice(start, end), end };
}

/**
 * Whether KaTeX can typeset a span, memoised by its source. Asking KaTeX
 * itself is what keeps a symbol table -- which would rot -- out of this file,
 * and what keeps an invented `\notarealcommand` as the readable text it
 * already was rather than a red error box.
 */
const RENDERS = new Map<string, boolean>();
/**
 * How many answers the cache holds. A chat session is long-lived and every
 * distinct run reaching here is a new key, so an unbounded map grows for the
 * lifetime of the tab. The eviction is the cheapest one that keeps the hit
 * rate that matters -- the same message re-rendering on every streamed token
 * -- which needs only the runs of the message in flight, far fewer than this.
 * `Map` iterates in insertion order, so `keys().next()` is the oldest.
 */
const MAX_RENDERS = 500;

/** Exported for the test that proves the cache stops growing. */
export function rendersCacheSize(): number {
  return RENDERS.size;
}

function renders(tex: string): boolean {
  const known = RENDERS.get(tex);
  if (known !== undefined) return known;
  let ok = true;
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'ignore' });
  } catch {
    ok = false;
  }
  if (RENDERS.size >= MAX_RENDERS) {
    const oldest = RENDERS.keys().next();
    /* istanbul ignore next -- @preserve the map is non-empty at this size */
    if (!oldest.done) RENDERS.delete(oldest.value);
  }
  RENDERS.set(tex, ok);
  return ok;
}

/** The inline math node a run means, or null when it must stay literal. */
function mathNode(tex: string, parse: ParseFragment): PhrasingContent | null {
  if (!renders(tex)) return null;
  // Built by the host processor's own math extension rather than by hand, so
  // the node carries exactly the data the rest of the pipeline reads off it.
  const [first, ...rest] = inlineOf(`$${tex}$`, parse);
  return first?.type === 'inlineMath' && !rest.length ? first : null;
}

/** Inline replacement for one text node's residual maths, or null. */
function mathifyText(
  value: string,
  parse: ParseFragment,
): PhrasingContent[] | null {
  const out: PhrasingContent[] = [];
  let pos = 0;
  for (let at = 0; at < value.length; at++) {
    if (value[at] !== '\\') continue;
    const command = COMMAND.exec(value.slice(at));
    // `\&`, `\%`, `\_`: a backslash escape, not a command. Skip the character
    // it escapes so a `\\alpha` cannot be read as a command either.
    if (!command) {
      at++;
      continue;
    }
    const after = at + command[0].length;
    if (HANDLED.has(command[1])) {
      at = commandEnd(value, command[1], after) - 1;
      continue;
    }
    const run = readRun(value, at);
    const math = mathNode(run.tex, parse);
    if (math) {
      if (at > pos) out.push({ type: 'text', value: value.slice(pos, at) });
      out.push(math);
      pos = run.end;
    }
    at = run.end - 1;
  }
  if (!out.length) return null;
  if (pos < value.length) out.push({ type: 'text', value: value.slice(pos) });
  return out;
}

/**
 * The nodes rebuilt out of a maths node, with the maths commands still in
 * their text wrapped back into math spans.
 *
 * Runs on the maths paths ONLY. Code spans, code blocks and the math spans
 * the extension already carved out are other node types, so a text visit
 * never reaches inside them, and `\verb|...|` is skipped by name.
 */
function mathify<T extends RootContent | PhrasingContent>(
  nodes: T[],
  parse: ParseFragment,
): T[] {
  const root = { type: 'root', children: nodes } as unknown as Root;
  visit(root, 'text', (node, index, parent) => {
    /* istanbul ignore next -- @preserve visit omits these only for the root */
    if (index === undefined || !parent) return;
    const phrasing = mathifyText(node.value, parse);
    if (!phrasing) return;
    (parent as Parent).children.splice(index, 1, ...phrasing);
    return index + phrasing.length;
  });
  return root.children as T[];
}

/** The node types whose source only LOOKS like LaTeX. */
const MASKED_TYPES = new Set(['inlineCode', 'inlineMath', 'code', 'html']);

/**
 * The offsets, relative to `base`, of the children whose text only looks like
 * LaTeX: a `` `\begin{itemize}` `` the reader typed, or a math span the math
 * extension already claimed. An island may not open inside one.
 *
 * Block-level `code` and `html` are masked for the same reason as their inline
 * counterparts: a span now reaches across them (see `spanOf`), so the fence
 * body a reader is being SHOWN is inside the scanned source and must not open
 * an island of its own.
 */
function maskedRanges(node: RootContent, base: number): [number, number][] {
  const ranges: [number, number][] = [];
  visit(node as Nodes, (child) => {
    if (!MASKED_TYPES.has(child.type)) return;
    const at = child.position;
    /* istanbul ignore next -- @preserve parsed nodes always carry offsets */
    if (at?.start.offset === undefined || at.end.offset === undefined) return;
    ranges.push([at.start.offset - base, at.end.offset - base]);
  });
  return ranges;
}

export function remarkLatexIslands(this: { parse(value: string): unknown }) {
  // `this` is the host processor. Its `parse` runs only the parser -- every
  // syntax extension the message itself was parsed with, and none of the
  // transformers, this one included -- which is exactly what a fragment of the
  // same message needs.
  const parseDocument = this.parse.bind(this);
  const parse: ParseFragment = (value) =>
    value ? unposition((parseDocument(value) as Root).children) : [];

  return (tree: Root, file: { value?: unknown }) => {
    if (!GATE.test(String(file.value ?? ''))) return;
    const source = String(file.value);

    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      /* istanbul ignore next -- @preserve visit omits these only for the root */
      if (index === undefined || !parent) return;
      const at = node.position;
      /* istanbul ignore next -- @preserve parsed paragraphs always carry offsets */
      if (at?.start.offset === undefined || at.end.offset === undefined) return;
      const from = at.start.offset;
      const siblings = (parent as Parent).children;
      const span = spanOf(siblings, index, source, from, at.end.offset);
      const blocks = splitBlocks({
        value: source.slice(from, span.end),
        parse,
        masked: siblings
          .slice(index, index + span.count)
          .flatMap((block) => maskedRanges(block, from)),
        stream: { source, base: from },
      });
      if (!blocks) return;
      siblings.splice(index, span.count, ...blocks);
      return [SKIP, index + blocks.length];
    });

    // A display block is a block-level node, so what it means when it is not
    // maths at all is block-level too: `\[\begin{itemize}...\end{itemize}\]`
    // is a list a model wrapped in the delimiters it had been told to use,
    // and KaTeX answers it with a red "No such environment"; `\[\textbf{Week
    // 1}\]` is a heading in the same costume. Runs before the paragraph pass'
    // siblings are disturbed and before rehype ever sees the node.
    visit(tree, 'math', (node, index, parent) => {
      /* istanbul ignore next -- @preserve visit omits these only for the root */
      if (index === undefined || !parent) return;
      const blocks =
        (DISPLAY_BLOCKS.test(node.value)
          ? splitBlocks({ value: node.value, parse, masked: [] })
          : null) ??
        textProse(node.value, parse) ??
        (isProse(node.value) ? blocksOf(node.value, parse) : null) ??
        wrapPhrasing(unwrapMathStyle(node.value, parse, true));
      if (!blocks) return;
      // Everything here was written inside `\[...\]`, where a maths command
      // was legal; out here it is a raw backslash unless it goes back.
      const rebuilt = mathify(blocks, parse);
      (parent as Parent).children.splice(index, 1, ...rebuilt);
      return [SKIP, index + rebuilt.length];
    });

    // After the island pass, so a `$\textbf{...}$` inside a converted item is
    // reached too.
    visit(tree, 'inlineMath', (node, index, parent) => {
      /* istanbul ignore next -- @preserve visit omits these only for the root */
      if (index === undefined || !parent) return;
      // A `$$...$$` span sharing a line with prose parses to the same node as
      // `$...$`; only the source tells them apart. Generated nodes carry no
      // position and are always single-dollar spans lifted out of an item body.
      const at = node.position?.start.offset;
      const display = at !== undefined && source.startsWith('$$', at);
      const phrasing = unwrapMathStyle(node.value, parse, display);
      if (!phrasing) return;
      const rebuilt = mathify(phrasing, parse);
      (parent as Parent).children.splice(index, 1, ...rebuilt);
      return index + rebuilt.length;
    });

    visit(tree, 'text', (node, index, parent) => {
      /* istanbul ignore next -- @preserve visit omits these only for the root */
      if (index === undefined || !parent) return;
      const phrasing = splitInline(node.value, parse);
      if (!phrasing) return;
      (parent as Parent).children.splice(index, 1, ...phrasing);
      return index + phrasing.length;
    });
  };
}
