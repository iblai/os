import { describe, it, expect } from 'vitest';
import { preprocessLaTeX } from '@/lib/preprocess-latex';

describe('preprocessLaTeX function', () => {
  it('should return empty string for non-string input', () => {
    expect(preprocessLaTeX(null as any)).toBe('');
    expect(preprocessLaTeX(undefined as any)).toBe('');
    expect(preprocessLaTeX(123 as any)).toBe('');
  });

  it('should escape currency dollar signs', () => {
    expect(preprocessLaTeX('Price is $5')).toBe('Price is \\$5');
    expect(preprocessLaTeX('$100 total')).toBe('\\$100 total');
  });

  it('should not corrupt block math delimiters when digits follow $$', () => {
    const input =
      '$$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$$';
    const output = preprocessLaTeX(input);
    // Whole-line $$...$$ is promoted to the fenced display form (fix 9); the
    // point here is that the currency escape never reaches the digits.
    expect(output).toBe(
      '$$\n0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}\n$$',
    );
    expect(output).not.toContain('\\$0');
    expect(output).not.toContain('\\$7');
    expect(output).toContain('$$');
  });

  it('should preserve block math delimiters with a leading space', () => {
    const input = '$$ 0.075 \\text{ L} = 75 \\text{ mL}$$';
    const output = preprocessLaTeX(input);
    expect(output).toBe('$$\n0.075 \\text{ L} = 75 \\text{ mL}\n$$');
    expect(output).not.toContain('\\$0');
  });

  it('should not corrupt inline math delimiters when digits follow $', () => {
    const input =
      '$250 \\text{ mL} \\times \\frac{1 \\text{ L}}{1000 \\text{ mL}}$';
    const output = preprocessLaTeX(input);
    expect(output).toBe(input);
    expect(output).not.toContain('\\$2');
  });

  it('should leave backslash-led math untouched', () => {
    expect(preprocessLaTeX('$\\frac{5}{5} = 1$')).toBe('$\\frac{5}{5} = 1$');
    expect(preprocessLaTeX('$$\\frac{1 \\text{ L}}{1000 \\text{ mL}}$$')).toBe(
      '$$\n\\frac{1 \\text{ L}}{1000 \\text{ mL}}\n$$',
    );
  });

  it('should escape currency but keep an adjacent math block intact', () => {
    const block =
      '$$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$$';
    const output = preprocessLaTeX(`It costs $5. Here: ${block}`);
    expect(output).toBe(`It costs \\$5. Here: ${block}`);
  });

  it('should treat backslash-free dollar spans as currency', () => {
    expect(preprocessLaTeX('I have $5 and $10')).toBe('I have \\$5 and \\$10');
  });

  it('should preserve backslash-free inline arithmetic math (issue #2109)', () => {
    // These spans have no backslash command, but they are genuine math and
    // must survive the currency escape so remark-math can parse them.
    expect(preprocessLaTeX('$3x + 5$')).toBe('$3x + 5$');
    expect(preprocessLaTeX('$5$')).toBe('$5$');
    expect(preprocessLaTeX('$3(4) + 5$')).toBe('$3(4) + 5$');
    expect(preprocessLaTeX('$2x + 6$')).toBe('$2x + 6$');
    expect(preprocessLaTeX('$3x$')).toBe('$3x$');
  });

  it('should unwrap dollar-wrapped text styling commands (issue #2109)', () => {
    // LLMs wrap prose in `$...$` with a text-mode command to mean *formatting*,
    // not math. These must become Markdown, not KaTeX math, and must not leave
    // any `$` behind (which would re-open a math span in remark-math).
    expect(preprocessLaTeX('$\\textbf{Custom AI Agents}$')).toBe(
      '**Custom AI Agents**',
    );
    expect(preprocessLaTeX('$\\text{ibl.ai}$')).toBe('ibl.ai');
    expect(preprocessLaTeX('$\\textit{RAG Training}$')).toBe('*RAG Training*');
    expect(preprocessLaTeX('$\\emph{note}$')).toBe('*note*');
    expect(preprocessLaTeX('$\\texttt{code}$')).toBe('`code`');
    expect(preprocessLaTeX('$\\underline{underlined}$')).toBe(
      '<u>underlined</u>',
    );
    expect(preprocessLaTeX('$\\textrm{plain}$')).toBe('plain');
    expect(preprocessLaTeX('$\\textsf{sans}$')).toBe('sans');
    expect(preprocessLaTeX('$\\textnormal{normal}$')).toBe('normal');
    // Block-delimited styling wrappers unwrap too.
    expect(preprocessLaTeX('$$\\textbf{Enterprise Management}$$')).toBe(
      '**Enterprise Management**',
    );
    // An escaped ampersand inside a bold wrapper is later unescaped (\& -> &),
    // so it renders as a literal "&" in Markdown bold.
    expect(preprocessLaTeX('$\\textbf{Canvas \\& Artifacts}$')).toBe(
      '**Canvas & Artifacts**',
    );
  });

  it('must not let a styling unwrap straddle newlines and eat structure (issue #2109 regression)', () => {
    // A tutoring reply: inline math on one line, a bold heading, then a block
    // equation. The styling-unwrap regexes must NOT pair the closing `$` of one
    // math span with the opening `$` of the next across the blank line -- doing
    // so swallowed the heading and `$$...$$` delimiters between them.
    const raw = [
      '**Given:** Evaluate $3x + 5$ when $x = 4$',
      '',
      '**Step 1: Write the original expression**',
      '$$3x + 5$$',
      '',
      '**Step 2: Substitute $x = 4$**',
      '$$3(4) + 5$$',
    ].join('\n');
    const out = preprocessLaTeX(raw);
    // Whole-line $$...$$ is promoted to the fenced display form (fix 9).
    expect(out).toContain('$$\n3x + 5\n$$');
    expect(out).toContain('$$\n3(4) + 5\n$$');
    expect(out).toContain('**Step 1: Write the original expression**');
    expect(out).not.toContain('\\$'); // no currency-escape corruption
    // Structure (line count) preserved, not collapsed onto one line.
    expect(out.split('\n').length).toBeGreaterThanOrEqual(6);
  });

  it('should unwrap Markdown bold trapped inside dollar delimiters (issue #2109)', () => {
    // The model emits `$**text**$` (Markdown bold inside `$`), not `\textbf`.
    // Left alone, KaTeX renders the `**` as literal math stars. These must
    // become Markdown bold, not math.
    expect(preprocessLaTeX('$**Custom AI Agents**$')).toBe(
      '**Custom AI Agents**',
    );
    expect(preprocessLaTeX('$$**Enterprise Management**$$')).toBe(
      '**Enterprise Management**',
    );
    expect(preprocessLaTeX('__underscored bold__ outside stays: $__b__$')).toBe(
      '__underscored bold__ outside stays: __b__',
    );
    // In a bullet list, the way a real feature list arrives.
    expect(preprocessLaTeX('* $**Canvas & Artifacts**$: rich documents.')).toBe(
      '* **Canvas & Artifacts**: rich documents.',
    );
    // Single `*`/`_` are NOT unwrapped -- they are legitimate math.
    expect(preprocessLaTeX('$a * b$')).toBe('$a * b$');
    expect(preprocessLaTeX('$x_1 + x_2$')).toBe('$x_1 + x_2$');
  });

  it('should unwrap styling wrappers in a realistic feature list (issue #2109)', () => {
    const input =
      '* $\\textbf{Custom AI Agents}$: Create agents.\n' +
      '* $\\textbf{Canvas \\& Artifacts}$: Generate documents.';
    const output = preprocessLaTeX(input);
    expect(output).toBe(
      '* **Custom AI Agents**: Create agents.\n' +
        '* **Canvas & Artifacts**: Generate documents.',
    );
    // No stray math delimiters remain to be mis-parsed as KaTeX.
    expect(output).not.toContain('$');
  });

  it('should NOT unwrap real math that merely contains a text command (issue #2109)', () => {
    // The styling unwrap must only fire when the command is the *entire* span.
    // Genuine math with `\text{...}` inside stays math, untouched.
    expect(
      preprocessLaTeX(
        '$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$',
      ),
    ).toBe(
      '$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$',
    );
    // Currency next to a styling wrapper: the wrapper unwraps, the amount escapes.
    expect(preprocessLaTeX('The $\\textbf{Pro}$ plan costs $5.')).toBe(
      'The **Pro** plan costs \\$5.',
    );
  });

  it('should keep inline math intact while still escaping real currency', () => {
    const input =
      'The term $3x$ evaluates. I have $5 and $10 in cash.\n\n$$3x + 5$$';
    const output = preprocessLaTeX(input);
    // Math spans come back parseable (not escaped to \$).
    expect(output).toContain('$3x$');
    expect(output).toContain('$$\n3x + 5\n$$');
    // The currency false-pair (prose word "and" between the amounts) is escaped.
    expect(output).toContain('I have \\$5 and \\$10 in cash.');
  });

  it('should not let a leading currency amount swallow a following math span', () => {
    // Digit-leading math ("$3x + 5$") sitting on the same line AFTER a currency
    // amount ("$12"). The rewind scan must escape the currency and still mask
    // the math span, rather than letting "$12" consume the math opening "$".
    const line3 =
      'the kit costs $12, and the formula $3x + 5$ gives the price.';
    const out3 = preprocessLaTeX(line3);
    expect(out3).toBe(
      'the kit costs \\$12, and the formula $3x + 5$ gives the price.',
    );

    // Backslash math ("$50 \\times x/100$") after currency ("$50") on one line.
    // Note: a later LaTeX pass unescapes "\\%" -> "%" inside the restored span,
    // which KaTeX still renders correctly — the point here is that both math
    // spans survive and only the "$50" currency amount is escaped.
    const line7 = 'a $50 item at $x\\%$ off saves $50 \\times x/100$ dollars.';
    const out7 = preprocessLaTeX(line7);
    expect(out7).toBe(
      'a \\$50 item at $x%$ off saves $50 \\times x/100$ dollars.',
    );

    // Currency both before and after a math span still escapes both amounts.
    const line5 = 'it was $20, dropped to $12, and $x - 8$ is the discount.';
    const out5 = preprocessLaTeX(line5);
    expect(out5).toBe(
      'it was \\$20, dropped to \\$12, and $x - 8$ is the discount.',
    );
  });

  it('keeps price ranges literal regardless of the separator', () => {
    // A closing `$` directly before a digit is currency, never a math close,
    // so every amount in a range stays escaped.
    expect(preprocessLaTeX('tickets are $5-$10 today')).toBe(
      'tickets are \\$5-\\$10 today',
    );
    expect(preprocessLaTeX('seats cost $5 - $10 each')).toBe(
      'seats cost \\$5 - \\$10 each',
    );
    expect(preprocessLaTeX('prices: $5, $10, $15.')).toBe(
      'prices: \\$5, \\$10, \\$15.',
    );
    expect(preprocessLaTeX('bands are $90,000-$120,000 by level')).toBe(
      'bands are \\$90,000-\\$120,000 by level',
    );
    expect(preprocessLaTeX('k. Three amounts: $5-$10-$20')).toBe(
      'k. Three amounts: \\$5-\\$10-\\$20',
    );
  });

  it('should escape degenerate dollar runs instead of guessing at math', () => {
    // Empty span: nothing between the delimiters, so both stay literal.
    expect(preprocessLaTeX('total: $$ ok')).toBe('total: \\$\\$ ok');
    // Space after the opening `$` fails the tex_math_dollars test.
    expect(preprocessLaTeX('cost $ 5$ maybe')).toBe('cost \\$ 5\\$ maybe');
    // `$a$$b$` pairs ambiguously in remark-math, so the whole run is escaped.
    expect(preprocessLaTeX('$a$$b$')).toBe('\\$a\\$\\$b\\$');
  });

  it('should not pair an opening $ with a closing $ on a later line', () => {
    // The closing candidate for "$5" sits past the newline, so the amount is
    // escaped as currency and the math span on the next line still parses.
    expect(preprocessLaTeX('price $5\nreal $x + 1$ here')).toBe(
      'price \\$5\nreal $x + 1$ here',
    );
  });

  it('should not escape already escaped dollar signs', () => {
    expect(preprocessLaTeX('Already \\$5 escaped')).toBe(
      'Already \\$5 escaped',
    );
  });

  it('rewrites \\$ inside converted \\(...\\) math so the span survives remark-math (issue #2109)', () => {
    expect(preprocessLaTeX('Example: TBS Source One. \\(\\sim\\$35\\)')).toBe(
      'Example: TBS Source One. $\\sim\\text{\\textdollar}35$',
    );
  });

  it('rewrites \\$ inside a directly emitted $...$ span (issue #2109)', () => {
    expect(preprocessLaTeX('costs $\\sim\\$35$ each')).toBe(
      'costs $\\sim\\text{\\textdollar}35$ each',
    );
  });

  it('keeps prose between two dollar-carrying spans out of math (issue #2109)', () => {
    const input =
      'Estimated total: \\(\\$220\\text{–}310\\). With a new transmitter: \\(\\$330\\text{–}550\\).';
    expect(preprocessLaTeX(input)).toBe(
      'Estimated total: $\\text{\\textdollar}220\\text{–}310$. With a new transmitter: $\\text{\\textdollar}330\\text{–}550$.',
    );
  });

  it('rewrites \\$ inside \\[...\\] display math (issue #2109)', () => {
    expect(preprocessLaTeX('so \\[\\$5 + \\$10\\] holds')).toBe(
      'so $$\\text{\\textdollar}5 + \\text{\\textdollar}10$$ holds',
    );
    expect(preprocessLaTeX('\\[\\$5\\]')).toBe('$$\n\\text{\\textdollar}5\n$$');
  });

  it('leaves \\$ outside math untouched while fixing spans (issue #2109)', () => {
    expect(preprocessLaTeX('Already \\$5 escaped, math \\(\\$2\\) here')).toBe(
      'Already \\$5 escaped, math $\\text{\\textdollar}2$ here',
    );
  });

  it('should convert block LaTeX delimiters', () => {
    // A whole-line \[...\] is display math and lands in the fenced form.
    expect(preprocessLaTeX('\\[x = 5\\]')).toBe('$$\nx = 5\n$$');
    expect(preprocessLaTeX('\\[ y = 10 \\]')).toBe('$$\ny = 10\n$$');
    // A mid-sentence \[...\] keeps the single-line conversion.
    expect(preprocessLaTeX('so \\[x = 5\\] holds')).toBe('so $$x = 5$$ holds');
  });

  it('should convert inline LaTeX delimiters', () => {
    expect(preprocessLaTeX('\\(x = 5\\)')).toBe('$x = 5$');
    expect(preprocessLaTeX('\\( y = 10 \\)')).toBe('$ y = 10 $');
  });

  it('should convert textbf to markdown bold', () => {
    expect(preprocessLaTeX('\\textbf{bold text}')).toBe('**bold text**');
  });

  it('should convert textit to markdown italic', () => {
    expect(preprocessLaTeX('\\textit{italic text}')).toBe('*italic text*');
  });

  it('should convert emph to markdown italic', () => {
    expect(preprocessLaTeX('\\emph{emphasized}')).toBe('*emphasized*');
  });

  it('should convert texttt to code', () => {
    expect(preprocessLaTeX('\\texttt{code}')).toBe('`code`');
  });

  it('should convert underline to HTML', () => {
    expect(preprocessLaTeX('\\underline{underlined}')).toBe(
      '<u>underlined</u>',
    );
  });

  it('should convert itemize to unordered list', () => {
    const input = '\\begin{itemize}\\item First\\item Second\\end{itemize}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- First');
    expect(result).toContain('- Second');
  });

  it('unwraps a display-math heading wrapping a lone styling command (issue #2109)', () => {
    const input =
      '\\[\n\\textbf{React Learning To-Do List (AI-Aware, Practical, 4–6 Weeks)}\n\\]\n\nIntro paragraph.';
    const result = preprocessLaTeX(input);
    expect(result).toContain(
      '**React Learning To-Do List (AI-Aware, Practical, 4–6 Weeks)**',
    );
    expect(result).not.toContain('$');
    expect(result).not.toContain('\\textbf');
  });

  it('unwraps an inline \\(...\\) span wrapping a lone styling command (issue #2109)', () => {
    expect(preprocessLaTeX('\\(\\textbf{bold heading}\\)')).toBe(
      '**bold heading**',
    );
    expect(preprocessLaTeX('\\(\\emph{soft}\\)')).toBe('*soft*');
  });

  it('keeps a display-math plain-text annotation as a display block (issue #2109)', () => {
    const result = preprocessLaTeX('\\[\n\\text{Step 2: Multiply}\n\\]');
    expect(result).toBe('$$\n\\text{Step 2: Multiply}\n$$');
  });

  it('leaves \\textbf intact inside genuine math instead of injecting ** (issue #2109)', () => {
    const result = preprocessLaTeX('so \\[ \\textbf{F} = ma \\] holds');
    expect(result).toContain('\\textbf{F} = ma');
    expect(result).not.toContain('**F**');
  });

  it('converts itemize nested inside itemize without leaking raw tokens (issue #2109)', () => {
    const input =
      '\\begin{itemize}\n  \\item Deliverables:\n    \\begin{itemize}\n      \\item README with tradeoffs.\n      \\item Coverage summary.\n    \\end{itemize}\n  \\item Ship it.\n\\end{itemize}';
    const result = preprocessLaTeX(input);
    expect(result).not.toContain('\\begin');
    expect(result).not.toContain('\\end');
    expect(result).toContain('- Deliverables:');
    expect(result).toContain('- README with tradeoffs.');
    expect(result).toContain('- Ship it.');
  });

  it('converts verbatim environments to fenced code and shields the body (issue #2109)', () => {
    const input =
      'Code kata:\n\\begin{verbatim}\nconst price = "$5"; // 10% off\n\\end{verbatim}\nDone.';
    const result = preprocessLaTeX(input);
    expect(result).toContain('```\nconst price = "$5"; // 10% off\n```');
    expect(result).not.toContain('\\begin{verbatim}');
    expect(result).not.toContain('\\$5');
  });

  it('strips a display-math wrapper around an itemize so it converts to a real list (issue #2109)', () => {
    const input =
      '\\[\n\\begin{itemize}\n\\item \\textbf{Why:} spatial reasoning.\n\\item \\textbf{Core skills:} layout and joinery.\n\\end{itemize}\n\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- **Why:** spatial reasoning.');
    expect(result).toContain('- **Core skills:** layout and joinery.');
    expect(result).not.toContain('$$');
    expect(result).not.toContain('\\textbf');
    expect(result).not.toContain('\\begin');
  });

  it('strips the wrapper even when the list self-nests, keeping inline math intact (issue #2109)', () => {
    const input =
      '\\[\n\\begin{itemize}\n\\item \\textbf{Overlap:}\n  \\begin{itemize}\n    \\item \\textit{Tolerances:} wood (\\(\\alpha\\) varies).\n  \\end{itemize}\n\\item \\textbf{Safety:} push sticks.\n\\end{itemize}\n\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- **Overlap:**');
    expect(result).toContain('- *Tolerances:* wood ($\\alpha$ varies).');
    expect(result).toContain('- **Safety:** push sticks.');
    expect(result).not.toContain('$$');
    expect(result).not.toContain('\\begin');
  });

  it('strips a $$-wrapped enumerate the same way (issue #2109)', () => {
    const input =
      '$$\n\\begin{enumerate}\n\\item First step.\n\\item Second step.\n\\end{enumerate}\n$$';
    const result = preprocessLaTeX(input);
    expect(result).toContain('1. First step.');
    expect(result).toContain('2. Second step.');
    expect(result).not.toContain('$$');
  });

  it('converts \\[-wrapped aligned environments of \\verb rows to a fenced code block (issue #2109)', () => {
    const input =
      'Create Counter.tsx:\n\\[\n\\begin{aligned}\n&\\verb|import { useState } from "react";|\\\\\n&\\verb|  const [count, setCount] = useState(initial);|\\\\\n&\\verb|}|\\\\\n\\end{aligned}\n\\]\nDone.';
    const result = preprocessLaTeX(input);
    expect(result).toContain(
      '```\nimport { useState } from "react";\n  const [count, setCount] = useState(initial);\n}\n```',
    );
    expect(result).not.toContain('aligned');
    expect(result).not.toContain('\\verb');
    expect(result).not.toContain('$$');
  });

  it('keeps the list-item indent when an aligned \\verb block is nested in a list (issue #2109)', () => {
    const input =
      '- Files and code:\n  - Create App.tsx:\n    \\[\n    \\begin{aligned}\n    &\\verb|const a = 1;|\\\\\n    &\\verb|const b = 2;|\\\\\n    \\end{aligned}\n    \\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain(
      '    ```\n    const a = 1;\n    const b = 2;\n    ```',
    );
    expect(result).not.toContain('aligned');
  });

  it('converts bare and $$-wrapped aligned \\verb environments too (issue #2109)', () => {
    const bare = '\\begin{aligned}\n&\\verb|<TodoCard />|\\\\\n\\end{aligned}';
    expect(preprocessLaTeX(bare)).toContain('```\n<TodoCard />\n```');
    const dollars =
      '$$\n\\begin{aligned}\n&\\verb|npm run dev|\\\\\n\\end{aligned}\n$$';
    const result = preprocessLaTeX(dollars);
    expect(result).toContain('```\nnpm run dev\n```');
    expect(result).not.toContain('$$');
  });

  it('leaves genuine aligned math environments alone (issue #2109)', () => {
    const input =
      '\\[\n\\begin{aligned}\nx &= y + 1\\\\\nz &= 2x\\\\\n\\end{aligned}\n\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('\\begin{aligned}');
    expect(result).not.toContain('```');
    const mixed =
      '\\[\n\\begin{aligned}\n&\\verb|const a = 1;|\\\\\nx &= y\\\\\n\\end{aligned}\n\\]';
    expect(preprocessLaTeX(mixed)).toContain('\\begin{aligned}');
  });

  it('should convert enumerate to ordered list', () => {
    const input = '\\begin{enumerate}\\item First\\item Second\\end{enumerate}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
  });

  it('should strip an existing markdown marker before prepending the list marker (issue #2109)', () => {
    // LLMs mix styles: \begin{itemize} wrapping items that already carry a
    // Markdown bullet, which rendered as "- - item".
    const input =
      '\\begin{itemize}\n\\item - First point\n\\item * Second point\n\\end{itemize}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- First point');
    expect(result).toContain('- Second point');
    expect(result).not.toContain('- - ');
    expect(result).not.toContain('- * ');

    const numbered =
      '\\begin{enumerate}\n\\item 1. First\n\\item 2) Second\n\\end{enumerate}';
    const numberedResult = preprocessLaTeX(numbered);
    expect(numberedResult).toContain('1. First');
    expect(numberedResult).toContain('2. Second');
    expect(numberedResult).not.toContain('1. 1.');
    expect(numberedResult).not.toContain('2. 2)');
  });

  it('does not strip emphasis or negative numbers when cleaning item markers', () => {
    const input =
      '\\begin{itemize}\n\\item *emphasis* stays\n\\item -5 degrees\n\\end{itemize}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- *emphasis* stays');
    expect(result).toContain('- -5 degrees');
  });

  it('converts complete items of an unclosed itemize during streaming (issue #2109)', () => {
    // While \end{itemize} has not streamed in yet, the raw \begin{itemize}
    // and \item lines used to display literally.
    const input =
      'Intro:\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\item Third po';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- First point');
    expect(result).toContain('- Second point');
    expect(result).not.toContain('\\begin{itemize}');
    // The trailing partial line stays raw until it completes.
    expect(result).toContain('\\item Third po');
  });

  it('converts complete items of an unclosed enumerate during streaming (issue #2109)', () => {
    const input =
      '\\begin{enumerate}\n\\item First step\n\\item Second step\n\\item Thi';
    const result = preprocessLaTeX(input);
    expect(result).toContain('1. First step');
    expect(result).toContain('2. Second step');
    expect(result).toContain('\\item Thi');
    expect(result).not.toContain('\\begin{enumerate}');
  });

  it('drops a bare unclosed \\begin{itemize} once its line is complete', () => {
    expect(preprocessLaTeX('\\begin{itemize}\n')).not.toContain(
      '\\begin{itemize}',
    );
    // Without a completed line there is nothing safe to convert yet.
    expect(preprocessLaTeX('\\begin{itemize}')).toBe('\\begin{itemize}');
  });

  it('converts an unclosed itemize whose tail ends on a newline', () => {
    const result = preprocessLaTeX(
      '\\begin{itemize}\n\\item First point\n\\item Second point\n',
    );
    expect(result).toContain('- First point');
    expect(result).toContain('- Second point');
    expect(result).not.toContain('\\item');
  });

  it('converts the available lines of an unclosed quote and center during streaming', () => {
    const quote = preprocessLaTeX('\\begin{quote}\nwise words\npartial li');
    expect(quote).toContain('> wise words');
    expect(quote).toContain('partial li');
    expect(quote).not.toContain('\\begin{quote}');
    expect(preprocessLaTeX('\\begin{quote}\n')).not.toContain('\\begin{quote}');

    // Without a completed line there is nothing safe to convert yet.
    expect(preprocessLaTeX('\\begin{quote}')).toBe('\\begin{quote}');
    expect(preprocessLaTeX('\\begin{center}')).toBe('\\begin{center}');

    const center = preprocessLaTeX('\\begin{center}\ncentered text\npartial');
    expect(center).toContain(
      '<div style="text-align: center;">centered text</div>',
    );
    expect(center).toContain('partial');
    expect(center).not.toContain('\\begin{center}');
    expect(preprocessLaTeX('\\begin{center}\n')).not.toContain(
      '\\begin{center}',
    );
  });

  it('still converts a completed environment exactly as before streaming support', () => {
    const input =
      'Intro:\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\end{itemize}\nOutro.';
    const result = preprocessLaTeX(input);
    expect(result).toContain('- First point');
    expect(result).toContain('- Second point');
    expect(result).not.toContain('\\item');
    expect(result).not.toContain('\\begin');
    expect(result).not.toContain('\\end');
  });

  it('leaves an unclosed environment raw when a mismatched \\end is present', () => {
    const input = '\\begin{itemize}\n\\item a\n\\end{enumerate}\n';
    expect(preprocessLaTeX(input)).toBe(input);
  });

  it('wraps a prose mention of \\begin{aligned} in inline code (issue #2109)', () => {
    // User-reported: a bullet mentioning the environment name with no math
    // delimiters anywhere rendered raw \begin{aligned} text on screen.
    const input =
      '- **Display equation with \\begin{aligned}** showing search and indexing time complexity';
    expect(preprocessLaTeX(input)).toBe(
      '- **Display equation with `\\begin{aligned}`** showing search and indexing time complexity',
    );
  });

  it('wraps a prose \\begin/\\end mention pair in inline code', () => {
    expect(
      preprocessLaTeX('Use \\begin{aligned} and \\end{aligned} to align.'),
    ).toBe('Use `\\begin{aligned}` and `\\end{aligned}` to align.');

    // Adjacent tokens share one code span so no `` run is minted for the
    // LaTeX-quote rule to rewrite into a stray ".
    expect(preprocessLaTeX('\\begin{aligned}\\end{aligned}')).toBe(
      '`\\begin{aligned}\\end{aligned}`',
    );
  });

  it('renders the streaming head of an unclosed $$ aligned block as inline code', () => {
    // Mid-stream, the closing $$ has not arrived: the $$ opener is escaped by
    // the currency pass, the row separator becomes a hard break, and the bare
    // \begin{aligned} is shown as inline code -- transient until the final
    // chunk completes the block and the whole thing masks as display math.
    const input = '$$\n\\begin{aligned}\nT_s &= O(\\log n) \\\\';
    expect(preprocessLaTeX(input)).toBe(
      '\\$\\$\n`\\begin{aligned}`\nT_s &= O(\\log n)   \n',
    );
  });

  it('never touches \\begin/\\end inside masked math (issue #2109)', () => {
    // Whole-line $$...$$ is promoted to the fenced display form (fix 9); the
    // environment tokens and row separators inside must survive verbatim.
    const aligned = '$$\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}$$';
    expect(preprocessLaTeX(aligned)).toBe(
      '$$\n\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}\n$$',
    );

    const pmatrix = '$$\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}$$';
    expect(preprocessLaTeX(pmatrix)).toBe(
      '$$\n\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}\n$$',
    );

    const fenced =
      '$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$';
    expect(preprocessLaTeX(fenced)).toBe(fenced);

    // \[...\] and \(...\) forms convert delimiters only; the environment
    // tokens inside stay backtick-free. The whole-line \[...\] form is
    // promoted to the fenced display block like its $$ equivalent above.
    expect(
      preprocessLaTeX('\\[\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}\\]'),
    ).toBe('$$\n\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}\n$$');
    expect(preprocessLaTeX('\\(\\begin{pmatrix}1\\end{pmatrix}\\)')).toBe(
      '$\\begin{pmatrix}1\\end{pmatrix}$',
    );
  });

  it('should convert quote to blockquote', () => {
    expect(preprocessLaTeX('\\begin{quote}quoted text\\end{quote}')).toContain(
      '> quoted text',
    );
  });

  it('should convert center to centered div', () => {
    expect(preprocessLaTeX('\\begin{center}centered\\end{center}')).toContain(
      '<div style="text-align: center;">centered</div>',
    );
  });

  it('should convert section to markdown heading', () => {
    expect(preprocessLaTeX('\\section{Title}')).toContain('## Title');
  });

  it('should convert starred section to markdown heading', () => {
    expect(preprocessLaTeX('\\section*{Heading One}')).toContain(
      '## Heading One',
    );
  });

  it('should convert subsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsection{Subtitle}')).toContain('### Subtitle');
  });

  it('should convert starred subsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsection*{Core Evidence}')).toContain(
      '### Core Evidence',
    );
  });

  it('should convert subsubsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsubsection{Sub-subtitle}')).toContain(
      '#### Sub-subtitle',
    );
  });

  it('should convert starred subsubsection to markdown heading', () => {
    expect(preprocessLaTeX('\\subsubsection*{Deep Heading}')).toContain(
      '#### Deep Heading',
    );
  });

  it('should convert line breaks', () => {
    expect(preprocessLaTeX('line1\\\\line2')).toBe('line1  \nline2');
    expect(preprocessLaTeX('line1\n\\newlineline2')).toBe('line1  \nline2');
  });

  it('must not rewrite \\\\ row separators inside math (issue #2109)', () => {
    // `\\` is the row separator in aligned/pmatrix blocks. The prose
    // hard-break conversion used to run after math was restored, collapsing
    // every multi-row block to one row (a 2x2 pmatrix rendered as 1x3).
    const aligned = '$$\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}$$';
    expect(preprocessLaTeX(aligned)).toBe(
      '$$\n\\begin{aligned}x &= 1 \\\\ y &= 2\\end{aligned}\n$$',
    );

    const pmatrix = '$$\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}$$';
    expect(preprocessLaTeX(pmatrix)).toBe(
      '$$\n\\begin{pmatrix}1 & 2 \\\\ 3 & 4\\end{pmatrix}\n$$',
    );

    // Multi-line $$ fence form survives too.
    const fenced =
      '$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$';
    expect(preprocessLaTeX(fenced)).toBe(fenced);

    // Inline math with a row separator survives.
    expect(preprocessLaTeX('$a \\\\ b$')).toBe('$a \\\\ b$');

    // Prose around the math still gets its hard break; the whole-line block is
    // promoted to the fenced display form (fix 9) with its `\\` intact.
    expect(
      preprocessLaTeX('first line\\\\second line\n$$x &= 1 \\\\ y$$'),
    ).toBe('first line  \nsecond line\n\n$$\nx &= 1 \\\\ y\n$$');
  });

  it('should convert verb to code', () => {
    expect(preprocessLaTeX('\\verb|code|')).toBe('`code`');
  });

  it('should convert LaTeX quotes', () => {
    // The LaTeX idiom opens with backticks and closes with apostrophes.
    expect(preprocessLaTeX("``quoted text''")).toBe('"quoted text"');
    expect(preprocessLaTeX("''quoted''")).toBe('"quoted"');
  });

  it('should leave an unclosed streaming fence alone', () => {
    // While the closing ``` has not streamed in yet, the fence body is still
    // code: the quote rule must not shred the opening backticks and the
    // currency escape must not reach a `$` inside it.
    const input = '```python\n# streaming\nprice = "$5"';
    expect(preprocessLaTeX(input)).toBe(input);
    const midDocument = 'Intro text\n```python\n# streaming\nprice = "$5"';
    expect(preprocessLaTeX(midDocument)).toBe(midDocument);
  });

  it('should leave a double-backtick code span alone', () => {
    // ``quoted`` is a CommonMark code span, not a LaTeX quote. Rewriting it to
    // "quoted" is what shredded every ```fenced``` block, so code wins here.
    expect(preprocessLaTeX('``quoted``')).toBe('``quoted``');
    expect(preprocessLaTeX('```js\nconst x = 10;\n```')).toBe(
      '```js\nconst x = 10;\n```',
    );
  });

  it('should unescape only the LaTeX escapes CommonMark cannot render', () => {
    // `&` and `%` are not escapable in CommonMark, so `\&`/`\%` would show a
    // literal backslash -- unescape them.
    expect(preprocessLaTeX('\\&')).toBe('&');
    expect(preprocessLaTeX('\\%')).toBe('%');
    // `#` and `_` ARE CommonMark escapes: the renderer already prints them as
    // literal characters. Stripping the backslash promoted them to live
    // syntax (`\# x` became an H1, `\_word\_` became italics) -- issue #2109.
    expect(preprocessLaTeX('\\#')).toBe('\\#');
    expect(preprocessLaTeX('\\_')).toBe('\\_');
    expect(preprocessLaTeX('\\# escaped hash')).toBe('\\# escaped hash');
    expect(preprocessLaTeX('\\_word\\_')).toBe('\\_word\\_');
  });

  it('should handle complex LaTeX document', () => {
    const input =
      '\\section{Title}\\textbf{Bold} and \\textit{italic}\\\\\\item Test';
    const result = preprocessLaTeX(input);
    expect(result).toContain('## Title');
    expect(result).toContain('**Bold**');
    expect(result).toContain('*italic*');
  });

  it('should convert tabular to markdown table', () => {
    const input =
      '\\begin{tabular}{|c|c|c|}\\hline Name & Age & City \\\\\\hline Alice & 30 & NYC \\\\\\hline\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Name | Age | City |');
    expect(result).toContain('| --- | --- | --- |');
    expect(result).toContain('| Alice | 30 | NYC |');
  });

  it('should convert tabular without hline', () => {
    const input =
      '\\begin{tabular}{ccc}Header1 & Header2 & Header3 \\\\Row1 & Row2 & Row3\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Header1 | Header2 | Header3 |');
    expect(result).toContain('| Row1 | Row2 | Row3 |');
  });

  it('should convert array to markdown table', () => {
    const input = '\\begin{array}{cc}A & B \\\\C & D\\end{array}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| A | B |');
    expect(result).toContain('| C | D |');
  });

  it('should handle empty tabular gracefully', () => {
    const input = '\\begin{tabular}{|c|}\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toBe('');
  });

  it('should handle tabular with only hlines', () => {
    const input = '\\begin{tabular}{|c|}\\hline\\hline\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toBe('');
  });

  it('should convert tabular inside \\[...\\] math delimiters', () => {
    const input =
      '\\[\\begin{tabular}{lcc}A & B & C \\\\D & E & F\\end{tabular}\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| A | B | C |');
    expect(result).toContain('| D | E | F |');
    expect(result).not.toContain('$$');
  });

  it('should convert \\text{} to plain text in tables', () => {
    const input =
      '\\[\\begin{tabular}{lc}\\text{Disease} & \\text{Count} \\\\\\text{Yes} & 42\\end{tabular}\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Disease | Count |');
    expect(result).toContain('| Yes | 42 |');
    expect(result).not.toContain('\\text');
  });

  it('should convert {,} thousands separator in tables', () => {
    const input =
      '\\[\\begin{tabular}{lr}\\text{Cases} & 12{,}500 \\\\\\text{Total} & 100{,}000\\end{tabular}\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Cases | 12,500 |');
    expect(result).toContain('| Total | 100,000 |');
    expect(result).not.toContain('{,}');
  });

  it('should handle real-world epidemiology table', () => {
    const input = `\\[
\\begin{tabular}{lccc}
\\hline
 & \\text{Disease} & \\text{No Disease} & \\text{Total} \\\\
\\hline
\\text{Exposed} & 42 & 158 & 200 \\\\
\\text{Unexposed} & 18 & 182 & 200 \\\\
\\hline
\\end{tabular}
\\]`;
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Disease | No Disease | Total |');
    expect(result).toContain('| Exposed | 42 | 158 | 200 |');
    expect(result).toContain('| Unexposed | 18 | 182 | 200 |');
  });
});

describe('preprocessLaTeX function - whole-line $$ display promotion (issue #2109 fix 9)', () => {
  it('expands a line consisting solely of $$...$$ into the fenced display form', () => {
    expect(preprocessLaTeX('$$3x + 5 = 3(4) + 5$$')).toBe(
      '$$\n3x + 5 = 3(4) + 5\n$$',
    );
    // Surrounding whitespace on the line is allowed and the body is trimmed.
    expect(preprocessLaTeX('  $$ x = 4 $$  ')).toBe('  $$\n  x = 4\n  $$');
  });

  it('separates promoted blocks from adjacent prose and from each other', () => {
    const input = 'Steps:\n$$a + b$$\n$$c + d$$\nDone.';
    expect(preprocessLaTeX(input)).toBe(
      'Steps:\n\n$$\na + b\n$$\n\n$$\nc + d\n$$\n\nDone.',
    );
  });

  it('promotes the adjacent-$$-lines payload from the issue report', () => {
    const input = [
      '$$\\text{Step 1: Substitute } x = 4 \\text{ into the expression}$$',
      '$$3x + 5 = 3(4) + 5$$',
      '',
      '$$\\text{Step 2: Multiply first (order of operations)}$$',
      '$$3(4) + 5 = 12 + 5$$',
    ].join('\n');
    const out = preprocessLaTeX(input);
    // Every line becomes its own fenced display block: 4 blocks, 8 delimiter
    // lines, and no single-line $$...$$ span survives.
    expect(out.split('\n').filter((line) => line.trim() === '$$')).toHaveLength(
      8,
    );
    expect(out).toContain(
      '$$\n\\text{Step 1: Substitute } x = 4 \\text{ into the expression}\n$$',
    );
    expect(out).toContain(
      '$$\n\\text{Step 2: Multiply first (order of operations)}\n$$',
    );
    expect(out).toContain('$$\n3x + 5 = 3(4) + 5\n$$');
    expect(out).toContain('$$\n3(4) + 5 = 12 + 5\n$$');
    expect(out).not.toMatch(/\$\$[^\n]+\$\$/);
  });

  it('keeps a whole-line $$\\text{...}$$ annotation as display math, not prose', () => {
    // Between equations, `$$\text{...}$$` is a display annotation (rendered
    // centered by GitHub/Overleaf), so the styling unwrap must not claim it.
    expect(
      preprocessLaTeX(
        '$$\\text{Step 2: Multiply first (order of operations)}$$',
      ),
    ).toBe('$$\n\\text{Step 2: Multiply first (order of operations)}\n$$');
    expect(preprocessLaTeX('  $$\\textrm{note}$$')).toBe(
      '  $$\n  \\textrm{note}\n  $$',
    );
    // Styling wrappers still unwrap to Markdown even when they own the line.
    expect(preprocessLaTeX('$$\\textbf{Enterprise Management}$$')).toBe(
      '**Enterprise Management**',
    );
    // Inline `$\text{...}$` still unwraps to prose.
    expect(preprocessLaTeX('$\\text{ibl.ai}$')).toBe('ibl.ai');
    // A `$$\text{...}$$` span sharing its line with prose still unwraps.
    expect(preprocessLaTeX('see $$\\text{this note}$$ here')).toBe(
      'see this note here',
    );
  });

  it('leaves the multi-line fenced form untouched', () => {
    const fenced = '$$\nE = mc^2\n$$';
    expect(preprocessLaTeX(fenced)).toBe(fenced);
    const indented = 'intro\n\n  $$\n  E = mc^2\n  $$\n\nafter';
    expect(preprocessLaTeX(indented)).toBe(indented);
  });

  it('does not promote a $$...$$ span sharing its line with prose', () => {
    const input = 'Matrix: $$\\begin{pmatrix}1 & 2\\end{pmatrix}$$ as shown.';
    expect(preprocessLaTeX(input)).toBe(input);
  });

  it('preserves indentation so a promoted block stays inside its list item', () => {
    expect(preprocessLaTeX('- item\n  $$x + y = z$$\n- next')).toBe(
      '- item\n\n  $$\n  x + y = z\n  $$\n\n- next',
    );
    expect(preprocessLaTeX('1. item\n   $$x + y$$')).toBe(
      '1. item\n\n   $$\n   x + y\n   $$',
    );
  });

  it('leaves degenerate and empty spans alone', () => {
    // `$$ $$` has no body to display; it stays for the inline machinery.
    expect(preprocessLaTeX('$$ $$')).toBe('$$ $$');
    // A lone `$$` line is a fence delimiter, never a promotable span.
    expect(preprocessLaTeX('$$\n')).toBe('\\$\\$\n');
  });

  it('does not promote $$ lines inside fenced code', () => {
    const code = '```\n$$x + y$$\n```';
    expect(preprocessLaTeX(code)).toBe(code);
  });

  it('promotes a whole-line \\[...\\] to the fenced display form', () => {
    expect(preprocessLaTeX('\\[E = mc^2\\]')).toBe('$$\nE = mc^2\n$$');
    // Indentation is preserved and prose neighbors get their blank line.
    expect(preprocessLaTeX('- item\n  \\[x + y = z\\]\n- next')).toBe(
      '- item\n\n  $$\n  x + y = z\n  $$\n\n- next',
    );
    expect(preprocessLaTeX('Steps:\n\\[a + b\\]\n\\[c + d\\]\nDone.')).toBe(
      'Steps:\n\n$$\na + b\n$$\n\n$$\nc + d\n$$\n\nDone.',
    );
  });

  it('keeps mid-sentence \\[...\\] and inline \\(...\\) at their current shape', () => {
    expect(preprocessLaTeX('so \\[E = mc^2\\] holds')).toBe(
      'so $$E = mc^2$$ holds',
    );
    expect(preprocessLaTeX('\\(E = mc^2\\)')).toBe('$E = mc^2$');
    // Two spans sharing a line stay two separate single-line spans.
    expect(preprocessLaTeX('\\[a\\] and \\[b\\]')).toBe('$$a$$ and $$b$$');
  });

  it('leaves the multi-line \\[ ... \\] form to the general conversion', () => {
    expect(preprocessLaTeX('\\[\nE = mc^2\n\\]')).toBe('$$\nE = mc^2\n$$');
  });

  it('does not promote \\[ lines inside fenced code', () => {
    const code = '```\n\\[x + y\\]\n```';
    expect(preprocessLaTeX(code)).toBe(code);
  });
});

describe('preprocessLaTeX function - tabular and array environments', () => {
  it('converts tabular wrapped in $$...$$ to a markdown table', () => {
    const input =
      '$$\\begin{tabular}{cc}\\hline\nName & Age \\\\\nAlice & 30 \\\\\n\\hline\\end{tabular}$$';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| Name | Age |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| Alice | 30 |');
  });

  it('converts standalone tabular blocks to a markdown table', () => {
    const input = '\\begin{tabular}{cc}\nA & B \\\\\nC & D\\end{tabular}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| A | B |');
    expect(result).toContain('| C | D |');
  });

  it('converts array wrapped in \\[...\\] to a markdown table', () => {
    const input = '\\[\\begin{array}{cc}1 & 2 \\\\ 3 & 4\\end{array}\\]';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| 1 | 2 |');
    expect(result).toContain('| 3 | 4 |');
  });

  it('converts array wrapped in $$...$$ to a markdown table', () => {
    const input = '$$\\begin{array}{cc}5 & 6 \\\\ 7 & 8\\end{array}$$';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| 5 | 6 |');
    expect(result).toContain('| 7 | 8 |');
  });

  it('converts standalone array blocks to a markdown table', () => {
    const input = '\\begin{array}{cc}9 & 10 \\\\ 11 & 12\\end{array}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('| 9 | 10 |');
    expect(result).toContain('| 11 | 12 |');
  });
});
