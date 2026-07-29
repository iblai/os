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
  // An `aligned` environment where every row is `&\verb|...|\\` is a code
  // block in math costume: KaTeX cannot typeset the verbatim payload (JSX,
  // braces, backticks), so it belongs in a fence. Returns null when any row
  // is real math, leaving genuine aligned environments untouched. The indent
  // is preserved so a block nested in a list item stays inside the item.
  const verbRow = /^&?\s*\\verb\|([^|]*)\|\s*(?:\\\\)?$/;
  const alignedVerbToFence = (indent: string, body: string): string | null => {
    const rows = body
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (rows.length === 0 || !rows.every((row) => verbRow.test(row))) {
      return null;
    }
    const code = rows
      .map((row) => `${indent}${(row.match(verbRow) as RegExpMatchArray)[1]}`)
      .join('\n');
    return maskCode(`\n${indent}\`\`\`\n${code}\n${indent}\`\`\`\n`);
  };
  const maskedContent = content
    // Fenced blocks first: a fence may legally contain single backticks.
    .replace(/(`{3,})[\s\S]*?\1/g, maskCode)
    .replace(/(~{3,})[\s\S]*?\1/g, maskCode)
    // \begin{verbatim} is LaTeX's code fence. Convert it to a Markdown fence
    // and mask it in the same motion, so the body is as untouchable as a
    // native ``` block. This runs after the fence masks above, so a literal
    // `\begin{verbatim}` INSIDE a real code fence is already hidden and
    // cannot match here.
    .replace(
      /[ \t]*\\begin\{verbatim\}[ \t]*\n?([\s\S]*?)\n?[ \t]*\\end\{verbatim\}[ \t]*/g,
      (_match, body: string) => maskCode(`\n\`\`\`\n${body}\n\`\`\`\n`),
    )
    // Code-in-aligned before the delimiter conversions ever see it: wrapped
    // in \[..\] or $$..$$ first (both delimiters consumed), then bare.
    .replace(
      /([ \t]*)(?:\\\[|\$\$)[ \t]*\n[ \t]*\\begin\{aligned\}[ \t]*\n([\s\S]*?)\n[ \t]*\\end\{aligned\}[ \t]*\n[ \t]*(?:\\\]|\$\$)[ \t]*/g,
      (match, indent: string, body: string) =>
        alignedVerbToFence(indent, body) ?? match,
    )
    .replace(
      /([ \t]*)\\begin\{aligned\}[ \t]*\n([\s\S]*?)\n[ \t]*\\end\{aligned\}[ \t]*/g,
      (match, indent: string, body: string) =>
        alignedVerbToFence(indent, body) ?? match,
    )
    // A trailing fence whose closer has not streamed in yet is still code to
    // the end of the input; left unmasked, the `` -> " quote rule shreds its
    // opening ``` while the stream is in flight.
    .replace(
      /(^|\n)([ \t]*(?:`{3,}|~{3,})[\s\S]*)$/,
      (_match, before: string, fence: string) => before + maskCode(fence),
    )
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

  // LLMs write section headings as display math around a lone styling
  // command -- `\[` / `\textbf{Week 1 — React Core}` / `\]`, delimiters on
  // their own lines -- and the same trick inline with `\(...\)`. The
  // styling-command unwrap below only recognizes `$`-delimited spans, and the
  // `\[...\]` -> `$$` conversion runs long after it, so these wrappers used to
  // survive as math whose body the later `\textbf` pass rewrote to `**...**`
  // -- KaTeX then renders literal `∗∗` plus the words squashed into italics.
  // Rewrite the delimiters to their dollar equivalents here, on one line, so
  // the unwrap below sees them like any other dollar-wrapped styling span (and
  // its plain-text exemption still routes `\[\text{Step 2}\]` into a display
  // block). Only a body that is exactly one brace-balanced command matches;
  // real display math containing more never does.
  processedContent = processedContent.replace(
    /\\\[\s*(\\(?:text|textrm|textsf|textnormal|textbf|textit|emph|texttt|underline)\{[^{}\n]*\})\s*\\\]/g,
    (_match, command: string) => `$$${command}$$`,
  );
  processedContent = processedContent.replace(
    /\\\(\s*(\\(?:text|textrm|textsf|textnormal|textbf|textit|emph|texttt|underline)\{[^{}\n]*\})\s*\\\)/g,
    (_match, command: string) => `$${command}$`,
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
  //
  // One shape is exempt: a `$$`-delimited span whose body is a *plain*-text
  // command (`\text{...}` and its font-only aliases) sitting alone on its own
  // line. That is not styling abuse but a display annotation between equations
  // -- "$$\text{Step 2: Multiply first}$$" in a step-by-step derivation --
  // which GitHub and Overleaf render as a centered block. It must stay math so
  // the whole-line display promotion below turns it into a display block.
  // Styling commands (`\textbf` etc.) are NOT exempt: `$$\textbf{Heading}$$`
  // is an LLM faking a bold heading and still unwraps to Markdown.
  const plainTextCommands = new Set(['text', 'textrm', 'textsf', 'textnormal']);
  processedContent = processedContent.replace(
    /(\${1,2})[ \t]*\\(text|textrm|textsf|textnormal|textbf|textit|emph|texttt|underline)\{([^{}]*)\}[ \t]*\1/g,
    (
      match: string,
      delim: string,
      command: string,
      inner: string,
      offset: number,
      whole: string,
    ) => {
      if (delim === '$$' && plainTextCommands.has(command)) {
        const lineStart = whole.lastIndexOf('\n', offset - 1) + 1;
        const afterMatch = offset + match.length;
        const lineEnd = whole.indexOf('\n', afterMatch);
        const before = whole.slice(lineStart, offset);
        const after = whole.slice(
          afterMatch,
          lineEnd === -1 ? whole.length : lineEnd,
        );
        if (/^[ \t]*$/.test(before) && /^[ \t]*$/.test(after)) {
          return match;
        }
      }
      return textCommandToMarkdown[command](inner);
    },
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

  // `\$` inside a math span is a literal dollar sign to KaTeX, but remark-math
  // scans for the closing `$` without honoring backslash escapes, so the `$`
  // of an inner `\$` terminates the span early: `$\sim\$35$` cuts at the `\$`,
  // KaTeX gets the garbage `\sim\`, and the orphaned `$` pairs with the next
  // span's delimiter, swallowing the prose between them into math. Rewrite
  // `\$` to `\text{\textdollar}` -- the same glyph with no `$` character for
  // the tokenizer to trip on. (Bare `\textdollar` is text-mode only in KaTeX.)
  const escapeMathDollars = (equation: string): string =>
    equation.replace(/\\\$/g, '\\text{\\textdollar}');

  // `\[...\]` is display math by definition, but its `$$` conversion further
  // down runs after the whole-line promotion below, so a whole-line
  // `\[E = mc^2\]` used to survive as single-line `$$E = mc^2$$` -- inline to
  // remark-math. Convert the whole-line form here (both delimiters and the
  // body on one line, only whitespace around them) so the promotion below
  // fences it exactly like a native `$$` line. Mid-sentence `\[x\]` and the
  // multi-line form keep the later conversion. The body may not contain `\]`,
  // so two spans sharing a line ("\[a\] and \[b\]") never collapse into one.
  processedContent = processedContent.replace(
    /^([ \t]*)\\\[((?:[^\\\n]|\\(?!\]))+?)\\\][ \t]*$/gm,
    (_match, indent: string, equation: string) =>
      `${indent}$$${escapeMathDollars(equation)}$$`,
  );

  // remark-math only produces a display block for the fenced form whose `$$`
  // delimiters each sit on their own line; a `$$...$$` that opens and closes
  // on one line is inline math to it even when it owns the line. LLMs emit
  // step-by-step work as consecutive whole-line `$$...$$` lines (issue #2109),
  // and with no blank line between them the lines merge into one paragraph of
  // left-aligned inline math. Expand every line consisting solely of one
  // `$$...$$` span into the fenced form. Indentation is preserved so a span
  // inside a list item stays in the item, and a blank line is added on either
  // side when prose sits directly against the span, because marked (the canvas
  // renderer) will not open a `$$` fence on the line after a paragraph line.
  // A span sharing its line with prose is genuinely inline and never matches;
  // the delimiter lines of an existing fenced block (`$$` alone) never match
  // either, so that form passes through untouched.
  const wholeLineDisplayMath = /^([ \t]*)\$\$((?:[^$\n]|\$(?!\$))+)\$\$[ \t]*$/;
  const sourceLines = processedContent.split('\n');
  const promotedLines: string[] = [];
  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i];
    const lineMatch = line.match(wholeLineDisplayMath);
    const body = lineMatch ? lineMatch[2].trim() : '';
    if (!lineMatch || !body) {
      promotedLines.push(line);
      continue;
    }
    const indent = lineMatch[1];
    const previous = promotedLines[promotedLines.length - 1];
    if (previous !== undefined && previous.trim() !== '') {
      promotedLines.push('');
    }
    promotedLines.push(`${indent}$$`, indent + body, `${indent}$$`);
    if (i + 1 < sourceLines.length && sourceLines[i + 1].trim() !== '') {
      promotedLines.push('');
    }
  }
  processedContent = promotedLines.join('\n');

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
    // newline does not count. A `\$` inside the span is a literal dollar, not
    // a closer -- skipping it here is safe only because escapeMathDollars()
    // rewrites it out of the masked span below, so the output remark-math
    // sees contains no inner `$` to disagree about.
    const newline = processedContent.indexOf('\n', open + 1);
    let close = processedContent.indexOf('$', open + 1);
    while (close !== -1 && processedContent[close - 1] === '\\') {
      close = processedContent.indexOf('$', close + 1);
    }
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
      scanned +=
        processedContent.slice(cursor, open) +
        maskMath(escapeMathDollars(span));
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
    (_, equation) => `$$${escapeMathDollars(equation)}$$`,
  );

  // Replace inline LaTeX delimiters \( \) with $ $
  processedContent = processedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, equation) => `$${escapeMathDollars(equation)}$`,
  );

  // Convert LaTeX text formatting commands to Markdown. These rewrites apply
  // anywhere the command appears -- including inside the `$$`/`$` spans the
  // two delimiter conversions above just created, where `\textbf{a}` is valid
  // KaTeX but `**a**` renders as literal asterisks. Mask every math span while
  // the styling passes run, then restore. (Math that predates those
  // conversions was restored verbatim further up, so it needs masking again.)
  processedContent = processedContent
    .replace(/(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$/g, (match) => maskMath(match))
    .replace(/(?<!\\)\$[^$\n]+?(?<!\\)\$/g, (match) => maskMath(match));

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

  processedContent = processedContent.replace(
    restoreMathPattern,
    (_, index) => mathPlaceholders[Number(index)] ?? '',
  );

  // Convert LaTeX environments to Markdown/HTML
  //
  // LLMs mix styles: `\begin{itemize}` wrapping items that already carry a
  // Markdown marker (`\item - point`). Strip any existing leading marker
  // before prepending ours, or the first item renders as "- - point".
  const stripListMarker = (item: string): string =>
    item.replace(/^(?:[-*+]|\d{1,9}[.)])\s+/, '');
  const toListItems = (items: string, env: string): string =>
    items
      .split(/\\item\s+/)
      .filter((item: string) => item.trim())
      .map((item: string, index: number) => {
        const text = stripListMarker(item.trim());
        return env === 'enumerate' ? `${index + 1}. ${text}` : `- ${text}`;
      })
      .join('\n');

  // \begin{itemize} / \begin{enumerate} -> Markdown lists. A single lazy
  // `[\s\S]*?` pass pairs an outer `\begin` with the first -- i.e. inner --
  // `\end` when the same environment nests inside itself ("\item Deliverables:
  // \begin{itemize} ..."), leaving a stray `\begin{itemize}` and `\end{itemize}`
  // rendered literally. Convert innermost-first instead: the body may not
  // contain another `\begin` of the same environment, and the pass repeats
  // until no complete pair remains, unwrapping one nesting level per round.
  for (const env of ['itemize', 'enumerate'] as const) {
    const innermostPair = new RegExp(
      `\\\\begin\\{${env}\\}((?:(?!\\\\begin\\{${env}\\})[\\s\\S])*?)\\\\end\\{${env}\\}`,
      'g',
    );
    let before;
    do {
      before = processedContent;
      processedContent = processedContent.replace(
        innermostPair,
        (_, items) => `\n${toListItems(items, env)}\n`,
      );
    } while (processedContent !== before);
  }

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

  // A streaming reply exposes `\begin{...}` before its `\end{...}` has
  // arrived; the paired conversions above never fire and the raw LaTeX shows
  // literally until the stream completes. Convert what is available: drop the
  // `\begin`, convert every finished line, and leave only the trailing partial
  // line (no newline yet) raw so the final chunk converts exactly as a
  // completed message would. The `\end{` guard skips mismatched-environment
  // input rather than guessing at its shape.
  const splitStreamingTail = (tail: string): [string, string] | null => {
    if (tail.includes('\\end{')) return null;
    const lastNewline = tail.lastIndexOf('\n');
    if (lastNewline === -1) return null;
    return [tail.slice(0, lastNewline), tail.slice(lastNewline + 1)];
  };
  processedContent = processedContent.replace(
    /\\begin\{(itemize|enumerate)\}([\s\S]*)$/,
    (match, env: string, tail: string) => {
      const parts = splitStreamingTail(tail);
      if (!parts) return match;
      const [complete, partial] = parts;
      const listItems = toListItems(complete, env);
      return partial ? `\n${listItems}\n\n${partial}` : `\n${listItems}\n`;
    },
  );
  processedContent = processedContent.replace(
    /\\begin\{quote\}([\s\S]*)$/,
    (match, tail: string) => {
      const parts = splitStreamingTail(tail);
      if (!parts) return match;
      const [complete, partial] = parts;
      const quoted = complete.trim() ? `\n> ${complete.trim()}\n` : '\n';
      return partial ? `${quoted}${partial}` : quoted;
    },
  );
  processedContent = processedContent.replace(
    /\\begin\{center\}([\s\S]*)$/,
    (match, tail: string) => {
      const parts = splitStreamingTail(tail);
      if (!parts) return match;
      const [complete, partial] = parts;
      const centered = complete.trim()
        ? `\n<div style="text-align: center;">${complete.trim()}</div>\n`
        : '\n';
      return partial ? `${centered}${partial}` : centered;
    },
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
  //
  // Math must not see this pass: `\\` is the row separator inside environments
  // like aligned and pmatrix, and rewriting it collapses every multi-row block
  // to a single row. At this point every unescaped `$` is a real math
  // delimiter (the scan above escaped all non-math `$`), so re-mask math
  // spans, convert `\\` in the prose that remains, and restore.
  processedContent = processedContent
    .replace(/(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$/g, (match) => maskMath(match))
    .replace(/(?<!\\)\$[^$\n]+?(?<!\\)\$/g, (match) => maskMath(match));
  processedContent = processedContent.replace(/\\\\|\n\\newline/g, '  \n');

  // Any `\begin{...}`/`\end{...}` still visible here is not math (math is
  // masked above) and not a convertible text environment (those were consumed
  // earlier): it is a prose mention of the environment name -- "**Display
  // equation with \begin{aligned}**" -- or the transient head of a math
  // environment whose closing delimiter has not streamed in yet. Wrap it in
  // backticks so it reads as the inline-code token the author meant instead of
  // leaking raw LaTeX. The convertible environment names are excluded: their
  // converters deliberately pass mismatched or mid-stream input through raw so
  // the final chunk converts exactly as a completed message would. Adjacent
  // tokens share one code span so the wrap never mints a `` run for the quote
  // rules below to rewrite.
  processedContent = processedContent.replace(
    /(?:\\(?:begin|end)\{(?!(?:itemize|enumerate|quote|center)\})[^{}]*\})+/g,
    (match) => `\`${match}\``,
  );

  processedContent = processedContent.replace(
    restoreMathPattern,
    (_, index) => mathPlaceholders[Number(index)] ?? '',
  );

  // Handle verbatim text
  // \verb|text| -> `text`
  processedContent = processedContent.replace(/\\verb\|([^|]+)\|/g, '`$1`');

  // Handle quotes
  // `` and '' -> proper quotes
  processedContent = processedContent.replace(/``/g, '"');
  processedContent = processedContent.replace(/''/g, '"');

  // Handle common LaTeX symbols that should remain as-is or convert. Only `&`
  // and `%`: neither is escapable in CommonMark, so a LaTeX-style `50\%` or
  // `A \& B` would otherwise render with a visible backslash. `\#` and `\_`
  // must NOT be unescaped -- both ARE CommonMark escapes that the renderer
  // already turns into literal `#`/`_`, and stripping the backslash here
  // promoted them to live syntax (`\# heading` became a real H1, `\_word\_`
  // became italics).
  // \& -> &
  processedContent = processedContent.replace(/\\&/g, '&');

  // \% -> %
  processedContent = processedContent.replace(/\\%/g, '%');

  // Restore code last, verbatim, so nothing above has touched its contents.
  const restoreCodePattern = new RegExp(`${codeOpen}(\\d+)${codeClose}`, 'g');
  processedContent = processedContent.replace(
    restoreCodePattern,
    (_, index) => codePlaceholders[Number(index)] ?? '',
  );

  return processedContent;
}
