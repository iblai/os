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
    expect(output).toBe(input);
    expect(output).not.toContain('\\$0');
    expect(output).not.toContain('\\$7');
    expect(output).toContain('$$');
  });

  it('should preserve block math delimiters with a leading space', () => {
    const input = '$$ 0.075 \\text{ L} = 75 \\text{ mL}$$';
    const output = preprocessLaTeX(input);
    expect(output).toBe(input);
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
      '$$\\frac{1 \\text{ L}}{1000 \\text{ mL}}$$',
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

  it('should keep inline math intact while still escaping real currency', () => {
    const input =
      'The term $3x$ evaluates. I have $5 and $10 in cash.\n\n$$3x + 5$$';
    const output = preprocessLaTeX(input);
    // Math spans come back parseable (not escaped to \$).
    expect(output).toContain('$3x$');
    expect(output).toContain('$$3x + 5$$');
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

  it('should not escape already escaped dollar signs', () => {
    expect(preprocessLaTeX('Already \\$5 escaped')).toBe(
      'Already \\$5 escaped',
    );
  });

  it('should convert block LaTeX delimiters', () => {
    expect(preprocessLaTeX('\\[x = 5\\]')).toBe('$$x = 5$$');
    expect(preprocessLaTeX('\\[ y = 10 \\]')).toBe('$$ y = 10 $$');
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

  it('should convert enumerate to ordered list', () => {
    const input = '\\begin{enumerate}\\item First\\item Second\\end{enumerate}';
    const result = preprocessLaTeX(input);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
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

  it('should convert verb to code', () => {
    expect(preprocessLaTeX('\\verb|code|')).toBe('`code`');
  });

  it('should convert LaTeX quotes', () => {
    // The LaTeX idiom opens with backticks and closes with apostrophes.
    expect(preprocessLaTeX("``quoted text''")).toBe('"quoted text"');
    expect(preprocessLaTeX("''quoted''")).toBe('"quoted"');
  });

  it('should leave a double-backtick code span alone', () => {
    // ``quoted`` is a CommonMark code span, not a LaTeX quote. Rewriting it to
    // "quoted" is what shredded every ```fenced``` block, so code wins here.
    expect(preprocessLaTeX('``quoted``')).toBe('``quoted``');
    expect(preprocessLaTeX('```js\nconst x = 10;\n```')).toBe(
      '```js\nconst x = 10;\n```',
    );
  });

  it('should escape LaTeX special characters', () => {
    expect(preprocessLaTeX('\\&')).toBe('&');
    expect(preprocessLaTeX('\\%')).toBe('%');
    expect(preprocessLaTeX('\\#')).toBe('#');
    expect(preprocessLaTeX('\\_')).toBe('_');
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
