/**
 * @file preprocess-latex.ts
 * @input A raw markdown/LaTeX string as emitted by an LLM
 * @output The same content with LaTeX normalized to Markdown + KaTeX-safe
 *   delimiters: currency $ escaped, styling wrappers unwrapped, and LaTeX
 *   commands/environments converted to Markdown. Consumed by <Markdown>.
 * @position Pure, dependency-free string transform. Extracted from lib/utils.ts.
 */

export function preprocessLaTeX(content: string) {
  // Handle non-string inputs
  if (typeof content !== 'string') {
    return '';
  }

  // Helper function to process tabular/array content into markdown table
  const processTabularContent = (tableContent: string): string => {
    // Split into rows by \\ (LaTeX row separator)
    const rows = tableContent
      .split(/\\\\\s*/)
      .map((row: string) => row.trim())
      .filter((row: string) => row && !row.match(/^\\hline\s*$/));

    if (rows.length === 0) return '';

    // Process each row: split by & (column separator) and clean up
    const processedRows = rows
      .map((row: string) => {
        // Remove \hline from the row content
        let cleanRow = row.replace(/\\hline\s*/g, '').trim();
        if (!cleanRow) return null;

        // Convert \text{...} to plain text
        cleanRow = cleanRow.replace(/\\text\{([^}]*)\}/g, '$1');

        // Remove {,} (LaTeX thousands separator formatting)
        cleanRow = cleanRow.replace(/\{,\}/g, ',');

        // Split by & and trim each cell
        const cells = cleanRow.split('&').map((cell: string) => cell.trim());
        return `| ${cells.join(' | ')} |`;
      })
      .filter(Boolean);

    if (processedRows.length === 0) return '';

    // Insert header separator after first row
    const firstRow = processedRows[0] as string;
    const columnCount = firstRow.split('|').length - 2;
    const headerSeparator = `|${' --- |'.repeat(columnCount)}`;
    processedRows.splice(1, 0, headerSeparator);

    return `\n${processedRows.join('\n')}\n`;
  };

  // Mask code before anything else runs. Code is literal by definition, so no
  // transformation below may see it: the `` -> " quote rule shreds ```js
  // fences, and the currency escape leaks a visible \$ into code spans.
  // Restored verbatim at the very end.
  const codeOpen = String.fromCharCode(0xe002);
  const codeClose = String.fromCharCode(0xe003);
  const codePlaceholders: string[] = [];
  const maskCode = (segment: string): string => {
    const index = codePlaceholders.length;
    codePlaceholders.push(segment);
    return `${codeOpen}${index}${codeClose}`;
  };
  const maskedContent = content
    // Fenced blocks first: a fence may legally contain single backticks.
    .replace(/(`{3,})[\s\S]*?\1/g, maskCode)
    .replace(/(~{3,})[\s\S]*?\1/g, maskCode)
    // Then inline spans: a code span is a backtick run closed by a run of the
    // same length around at least one character. Requiring content matters --
    // an empty match would swallow the ``  that opens a LaTeX ``quote''.
    .replace(/(`+)((?:(?!\1)[\s\S])+?)\1(?!`)/g, maskCode);

  // Process tabular inside \[...\] first (before converting math delimiters)
  let processedContent = maskedContent.replace(
    /\\\[\s*\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}\s*\\\]/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process tabular inside $$...$$ as well
  processedContent = processedContent.replace(
    /\$\$\s*\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}\s*\$\$/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process standalone tabular (not inside math delimiters)
  processedContent = processedContent.replace(
    /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process array inside \[...\] first
  processedContent = processedContent.replace(
    /\\\[\s*\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}\s*\\\]/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process array inside $$...$$
  processedContent = processedContent.replace(
    /\$\$\s*\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}\s*\$\$/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process standalone array
  processedContent = processedContent.replace(
    /\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // LLMs frequently wrap prose in a `$...$` (or `$$...$$`) span using a
  // text-mode command -- "$\textbf{Custom AI Agents}$", "$\text{ibl.ai}$" -- to
  // mean *formatting*, not math. Left alone these pass isInlineMath() below
  // (opening `$` -> non-space, closing `$` <- non-space, no trailing digit), so
  // they are masked as math and handed to KaTeX, which renders the styled prose
  // as collapsed math italics. Worse, the `\textbf{...}` -> `**...**` pass
  // further down then runs *inside* the surviving `$` delimiters, producing
  // "$**Custom AI Agents**$" whose `**` render as literal `∗∗` (issue #2109).
  //
  // Unwrap any span whose entire body is a single text-styling command into its
  // Markdown equivalent, dropping the `$` delimiters so it renders as normal
  // prose. The command must be the sole content of the span (only surrounding
  // whitespace allowed), so genuine math that merely *contains* `\text{...}` --
  // "$0.075 \text{ L} \times \frac{1000 \text{ mL}}{1 \text{ L}}$" -- never
  // matches and stays math.
  const textCommandToMarkdown: Record<string, (inner: string) => string> = {
    text: (inner) => inner,
    textrm: (inner) => inner,
    textsf: (inner) => inner,
    textnormal: (inner) => inner,
    textbf: (inner) => `**${inner}**`,
    textit: (inner) => `*${inner}*`,
    emph: (inner) => `*${inner}*`,
    texttt: (inner) => `\`${inner}\``,
    underline: (inner) => `<u>${inner}</u>`,
  };
  // The surrounding whitespace is `[ \t]*`, never `\s*`: these wrappers are
  // inline, single-line constructs, and allowing newlines lets the `$...$`
  // straddle a blank line and pair the closing `$` of one span with the opening
  // `$` of the next -- swallowing the Markdown structure (headings, block math)
  // in between.
  processedContent = processedContent.replace(
    /(\${1,2})[ \t]*\\(text|textrm|textsf|textnormal|textbf|textit|emph|texttt|underline)\{([^{}]*)\}[ \t]*\1/g,
    (_match: string, _delim: string, command: string, inner: string) =>
      textCommandToMarkdown[command](inner),
  );

  // Same class, different disguise: an LLM wraps prose in `$...$` around a
  // *Markdown* emphasis run rather than a LaTeX command -- "$**Custom AI
  // Agents**$". isInlineMath() below still sees valid inline math, so KaTeX
  // renders the `**` as literal math stars (`∗∗CustomAIAgents∗∗`). Unwrap a span
  // whose entire body is a doubled-marker Markdown run (`**bold**` / `__bold__`)
  // into the Markdown itself, dropping the `$`. Only doubled markers are safe:
  // a single `*` or `_` legitimately appears in math (`$a * b$`, `$x_1$`), but
  // `**`/`__` never do, so this can't swallow a real equation.
  processedContent = processedContent.replace(
    /(\${1,2})[ \t]*(\*\*[^*\n]+\*\*|__[^_\n]+__)[ \t]*\1/g,
    (_match: string, _delim: string, emphasis: string) => emphasis,
  );

  // Mask math spans before the currency escape so LaTeX delimiters are preserved.
  const maskOpen = String.fromCharCode(0xe000);
  const maskClose = String.fromCharCode(0xe001);
  const mathPlaceholders: string[] = [];
  const maskMath = (segment: string): string => {
    const index = mathPlaceholders.length;
    mathPlaceholders.push(segment);
    return `${maskOpen}${index}${maskClose}`;
  };

  // Block math takes one of two shapes: a `$$` fence whose delimiters each sit
  // on their own line, or `$$...$$` closed on the line it opened. Matching
  // `$$[\s\S]*?$$` instead lets a stray `$$` in prose pair with another `$$`
  // lines later and swallow everything between them.
  processedContent = processedContent.replace(
    /^[ \t]*\$\$[ \t]*\n[\s\S]*?\n[ \t]*\$\$[ \t]*$/gm,
    (match) => maskMath(match),
  );
  processedContent = processedContent.replace(/\$\$[^\n]*?\$\$/g, (match) =>
    maskMath(match),
  );
  // Mask genuine inline math so the currency escape below leaves it alone.
  // A `$...$` span counts as math under Pandoc's `tex_math_dollars` rule: the
  // opening `$` is followed by a non-space, the closing `$` is preceded by a
  // non-space, and the closing `$` is not followed by a digit. Currency pairs
  // fail one of the last two tests -- "$5, $10" closes after a space, and
  // "$5-$10" closes directly before a digit -- so they stay unmasked and get
  // the currency escape as intended, while "$3x + 5$" and "$x = 4$" pass.
  //
  // Only `$` directly followed by a digit is at risk from the escape below, so
  // declining to mask a span is always safe: remark-math still renders it.
  //
  // The scan runs left-to-right by hand rather than with a single global
  // regex: when a span is NOT math, we rewind to just after its opening `$`
  // so the closing `$` stays available to open the following span. Otherwise a
  // leading currency amount like "$12" would swallow the opening `$` of a real
  // math span like "$3x + 5$" later on the same line, exposing that math `$`
  // to the currency escape and breaking it.
  const isInlineMath = (open: number, close: number): boolean => {
    if (close <= open + 1) return false;
    const beforeOpen = processedContent[open - 1];
    const afterOpen = processedContent[open + 1];
    const beforeClose = processedContent[close - 1];
    const afterClose = processedContent[close + 1];
    if (!afterOpen || /\s/.test(afterOpen)) return false;
    if (!beforeClose || /\s/.test(beforeClose)) return false;
    if (afterClose && /\d/.test(afterClose)) return false;
    // A delimiter touching another `$` is ambiguous: remark-math pairs `$` in
    // runs of equal length, so in `$a$$b$` it opens on the first `$`, skips
    // the `$$` run, and closes on the last one -- one span whose content is
    // `a$$b`, which KaTeX renders as a red error. Claiming a span here would
    // disagree with the tokenizer that actually renders it, so decline and let
    // the escape below make the whole run literal instead.
    if (beforeOpen === '$' || afterClose === '$') return false;
    return true;
  };
  let scanned = '';
  let cursor = 0;
  while (cursor < processedContent.length) {
    const open = processedContent.indexOf('$', cursor);
    if (open === -1) {
      scanned += processedContent.slice(cursor);
      break;
    }
    // Inline spans never cross a newline, so a closing `$` past the next
    // newline does not count.
    const newline = processedContent.indexOf('\n', open + 1);
    let close = processedContent.indexOf('$', open + 1);
    if (close !== -1 && newline !== -1 && close > newline) {
      close = -1;
    }
    if (close === -1) {
      scanned += processedContent.slice(cursor, open + 1);
      cursor = open + 1;
      continue;
    }
    if (isInlineMath(open, close)) {
      const span = processedContent.slice(open, close + 1);
      scanned += processedContent.slice(cursor, open) + maskMath(span);
      cursor = close + 1;
    } else {
      // Keep the opening `$` literal and rewind past it only, so the closing
      // `$` can still open the next span.
      scanned += processedContent.slice(cursor, open + 1);
      cursor = open + 1;
    }
  }
  processedContent = scanned;

  // Every `$` that survives the scan above is not math, so escape all of them,
  // not just the ones before a digit. A single unescaped `$` left behind opens
  // a math span in remark-math that scans forward for a closer, and `\` is not
  // an escape inside that scan -- so a stray `$` swallows the `$` out of a
  // later `\$999`, leaving an orphaned backslash on screen. Escaping every
  // non-math `$` keeps the decision here instead of splitting it with
  // remark-math.
  processedContent = processedContent.replace(/(?<!\\)\$/g, () => '\\$');

  // Restore masked math spans verbatim.
  const restoreMathPattern = new RegExp(`${maskOpen}(\\d+)${maskClose}`, 'g');
  processedContent = processedContent.replace(
    restoreMathPattern,
    (_, index) => mathPlaceholders[Number(index)] ?? '',
  );

  // Replace block-level LaTeX delimiters \[ \] with $$ $$.
  processedContent = processedContent.replace(
    /\\\[(\s*[\s\S]*?\s*)\\\]/g,
    (_, equation) => `$$${equation}$$`,
  );

  // Replace inline LaTeX delimiters \( \) with $ $
  processedContent = processedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, equation) => `$${equation}$`,
  );

  // Convert LaTeX text formatting commands to Markdown
  // \textbf{text} -> **text**
  processedContent = processedContent.replace(/\\textbf\{([^}]+)\}/g, '**$1**');

  // \textit{text} -> *text*
  processedContent = processedContent.replace(/\\textit\{([^}]+)\}/g, '*$1*');

  // \emph{text} -> *text*
  processedContent = processedContent.replace(/\\emph\{([^}]+)\}/g, '*$1*');

  // \texttt{text} -> `text`
  processedContent = processedContent.replace(/\\texttt\{([^}]+)\}/g, '`$1`');

  // \underline{text} -> <u>text</u> (requires rehype-raw)
  processedContent = processedContent.replace(
    /\\underline\{([^}]+)\}/g,
    '<u>$1</u>',
  );

  // Convert LaTeX environments to Markdown/HTML
  // \begin{itemize} ... \end{itemize} -> convert to unordered list
  processedContent = processedContent.replace(
    /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g,
    (_, items) => {
      // Convert \item to list items
      const listItems = items
        .split(/\\item\s+/)
        .filter((item: string) => item.trim())
        .map((item: string) => `- ${item.trim()}`)
        .join('\n');
      return `\n${listItems}\n`;
    },
  );

  // \begin{enumerate} ... \end{enumerate} -> convert to ordered list
  processedContent = processedContent.replace(
    /\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g,
    (_, items) => {
      // Convert \item to numbered list items
      const listItems = items
        .split(/\\item\s+/)
        .filter((item: string) => item.trim())
        .map((item: string, index: number) => `${index + 1}. ${item.trim()}`)
        .join('\n');
      return `\n${listItems}\n`;
    },
  );

  // \begin{quote} ... \end{quote} -> convert to blockquote
  processedContent = processedContent.replace(
    /\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g,
    (_, content) => `\n> ${content.trim()}\n`,
  );

  // \begin{center} ... \end{center} -> convert to centered div
  processedContent = processedContent.replace(
    /\\begin\{center\}([\s\S]*?)\\end\{center\}/g,
    (_, content) =>
      `\n<div style="text-align: center;">${content.trim()}</div>\n`,
  );

  // Convert section headings (with optional * for unnumbered variants)
  // \section{text} or \section*{text} -> ## text
  processedContent = processedContent.replace(
    /\\section\*?\{([^}]+)\}/g,
    '\n## $1\n',
  );

  // \subsection{text} or \subsection*{text} -> ### text
  processedContent = processedContent.replace(
    /\\subsection\*?\{([^}]+)\}/g,
    '\n### $1\n',
  );

  // \subsubsection{text} or \subsubsection*{text} -> #### text
  processedContent = processedContent.replace(
    /\\subsubsection\*?\{([^}]+)\}/g,
    '\n#### $1\n',
  );

  // Handle line breaks
  // \\ or \newline -> line break
  processedContent = processedContent.replace(/\\\\|\n\\newline/g, '  \n');

  // Handle verbatim text
  // \verb|text| -> `text`
  processedContent = processedContent.replace(/\\verb\|([^|]+)\|/g, '`$1`');

  // Handle quotes
  // `` and '' -> proper quotes
  processedContent = processedContent.replace(/``/g, '"');
  processedContent = processedContent.replace(/''/g, '"');

  // Handle common LaTeX symbols that should remain as-is or convert
  // \& -> &
  processedContent = processedContent.replace(/\\&/g, '&');

  // \% -> %
  processedContent = processedContent.replace(/\\%/g, '%');

  // \# -> #
  processedContent = processedContent.replace(/\\#/g, '#');

  // \_ -> _
  processedContent = processedContent.replace(/\\_/g, '_');

  // Restore code last, verbatim, so nothing above has touched its contents.
  const restoreCodePattern = new RegExp(`${codeOpen}(\\d+)${codeClose}`, 'g');
  processedContent = processedContent.replace(
    restoreCodePattern,
    (_, index) => codePlaceholders[Number(index)] ?? '',
  );

  return processedContent;
}
