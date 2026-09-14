/**
 * @file markdown-latex-residue.ts
 * @input A single rendered text node's value, or a message's raw source
 * @output A CLASSIFICATION of the LaTeX that survived the conversion -- an
 *   environment name, a command name or a delimiter -- never any prose.
 * @position Pure functions, called from lib/markdown-math-error-reporter.ts.
 *
 * KaTeX throwing is the loud failure and is already reported. The silent ones
 * are worse: `\approx` reaching the reader as a raw backslash, a `tabular`
 * nobody can render, a `\verb` the island bridge declined, a conversion that
 * dropped a block outright. None of those raise anything, so the only trace is
 * on screen. These scanners run over what the reader actually sees and name
 * the offending construct.
 *
 * PRIVACY. A token returned here is at most 31 characters drawn from
 * `[A-Za-z*]` plus a leading backslash, or one of five fixed delimiter
 * literals. No space, digit or punctuation can appear in one, so no fragment
 * of a sentence can leave the browser -- the scanner reports WHAT failed,
 * never the message it failed in.
 */

/** environment: `tabular`. command: `\approx`. delimiter: `\[`, `$$`. */
export type ResidueKind = 'environment' | 'command' | 'delimiter';

export type Residue = {
  kind: ResidueKind;
  /** Letters only (plus a leading `\`), so it can never carry prose. */
  token: string;
  /** How often this token appears in the scanned text. */
  count: number;
};

/**
 * One linear pass, no nested quantifiers: `\begin{env}`/`\end{env}` naming the
 * environment, any multi-letter command, a literal display/inline delimiter.
 * A single-letter command is deliberately absent -- `\n`, `\t` and `\d` are
 * far more often prose about escapes than they are TeX.
 */
const RESIDUE =
  /\\(?:begin|end)\{([A-Za-z]{1,30}\*?)\}|\\([A-Za-z]{2,30})|\\[[\]()]|\$\$/g;

/** Environments named in a raw source, for the dropped-content report. */
const SOURCE_ENVIRONMENT = /\\begin\{([A-Za-z]{1,30}\*?)\}/g;

/**
 * A backslash after one of these opens no command: `C:\Users`, `path\to\file`,
 * `\\server\share`. Without this guard a Windows path is a false positive.
 */
const PATH_LIKE = /[A-Za-z0-9:/\\]/;

/** Bounds the work a single pathological node can cause. */
const MAX_TOKENS = 8;

/**
 * The LaTeX residue visible in `text`, deduplicated and counted.
 *
 * Cost on prose without a backslash -- almost all of it -- is two `indexOf`
 * scans and no allocation.
 */
export function scanLatexResidue(text: string): Residue[] {
  if (text.indexOf('\\') === -1 && text.indexOf('$$') === -1) return [];

  const found = new Map<string, Residue>();
  RESIDUE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RESIDUE.exec(text)) !== null) {
    if (
      match[0].charCodeAt(0) === 92 &&
      match.index > 0 &&
      PATH_LIKE.test(text[match.index - 1])
    ) {
      continue;
    }
    const [kind, token] = classify(match);
    const key = `${kind}|${token}`;
    const seen = found.get(key);
    if (seen) seen.count++;
    else if (found.size < MAX_TOKENS) {
      found.set(key, { kind, token, count: 1 });
    }
  }
  return [...found.values()];
}

function classify(match: RegExpExecArray): [ResidueKind, string] {
  if (match[1] !== undefined) return ['environment', match[1]];
  if (match[2] !== undefined) return ['command', `\\${match[2]}`];
  return ['delimiter', match[0]];
}

/**
 * True when a source opens a LaTeX construct one of the conversions rewrites.
 * A bare `\alpha` is not enough: a link reference definition renders nothing
 * by design, and one carrying a backslash must not read as dropped content.
 */
const LATEX_CONSTRUCT = /\\begin\{|\\verb|\\\[|\$\$/;

export function hasLatexConstruct(source: string): boolean {
  return LATEX_CONSTRUCT.test(source);
}

/** The distinct environment names a raw source opens, capped and letters-only. */
export function sourceEnvironments(source: string): string[] {
  const names = new Set<string>();
  SOURCE_ENVIRONMENT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SOURCE_ENVIRONMENT.exec(source)) !== null) {
    names.add(match[1]);
    if (names.size >= MAX_TOKENS) break;
  }
  return [...names];
}
