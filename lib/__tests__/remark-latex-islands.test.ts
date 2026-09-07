import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import zilMath from '@ziloen/remark-math';

import { remarkLatexIslands, rendersCacheSize } from '../remark-latex-islands';

/** The chat/canvas remark order: math, then islands, then breaks. */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(zilMath)
  .use(remarkLatexIslands)
  .use(remarkBreaks)
  .use(remarkRehype)
  .use(rehypeStringify);

const render = (markdown: string) =>
  String(processor.processSync(markdown)).trim();

describe('remarkLatexIslands', () => {
  it('turns itemize into a real, tight list', () => {
    expect(
      render('\\begin{itemize}\n\\item First\n\\item Second\n\\end{itemize}'),
    ).toBe('<ul>\n<li>First</li>\n<li>Second</li>\n</ul>');
  });

  it('nests an itemize inside an itemize', () => {
    const html = render(
      '\\begin{itemize}\n\\item Outer\n\\begin{itemize}\n\\item Inner\n\\end{itemize}\n\\item Last\n\\end{itemize}',
    );
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html).toContain('Inner');
    expect(html).not.toContain('\\end{itemize}');
  });

  it('turns enumerate into an ordered list', () => {
    expect(
      render('\\begin{enumerate}\n\\item One\n\\item Two\n\\end{enumerate}'),
    ).toContain('<ol>');
  });

  it('turns verbatim into a code block and keeps its dollars', () => {
    const html = render(
      '\\begin{verbatim}\nconst price = "$5";\n\\end{verbatim}',
    );
    expect(html).toContain('<pre><code>');
    expect(html).toContain('const price = "$5";');
  });

  it('turns quote into a blockquote', () => {
    expect(render('\\begin{quote}\nA line.\n\\end{quote}')).toContain(
      '<blockquote>',
    );
  });

  it('maps section, subsection and subsubsection to h2, h3 and h4', () => {
    expect(render('\\section{Overview}')).toContain('<h2>Overview</h2>');
    expect(render('\\subsection{Detail}')).toContain('<h3>Detail</h3>');
    expect(render('\\subsubsection{Deep}')).toContain('<h4>Deep</h4>');
    expect(render('\\section*{Starred}')).toContain('<h2>Starred</h2>');
  });

  it('keeps the prose around a heading', () => {
    expect(render('\\section{Overview}\nProse after.')).toBe(
      '<h2>Overview</h2>\n<p>Prose after.</p>',
    );
    expect(render('Prose before.\n\\section{Overview}')).toBe(
      '<p>Prose before.</p>\n<h2>Overview</h2>',
    );
  });

  it('converts the inline emphasis commands', () => {
    expect(
      render('This is \\textbf{important} and \\textit{slanted} text.'),
    ).toBe(
      '<p>This is <strong>important</strong> and <em>slanted</em> text.</p>',
    );
    expect(render('An \\emph{emphatic} word.')).toContain('<em>emphatic</em>');
  });

  // `splitInline` consumes the outer command and skips past its whole group,
  // so nothing revisited the inside: the nested command reached the reader as
  // a raw backslash.
  it('converts a styling command nested inside another one', () => {
    expect(render('Nested \\textbf{a \\textit{b} c} end.')).toBe(
      '<p>Nested <strong>a <em>b</em> c</strong> end.</p>',
    );
  });

  it('converts a styling command nested inside a math-wrapped one', () => {
    expect(render('$\\textbf{a \\texttt{b} c}$')).toBe(
      '<p><strong>a <code>b</code> c</strong></p>',
    );
  });

  it('converts an inline command at the very start or end of a line', () => {
    expect(render('\\textbf{Bold} first.')).toBe(
      '<p><strong>Bold</strong> first.</p>',
    );
    expect(render('Ends in \\textit{slant}')).toBe(
      '<p>Ends in <em>slant</em></p>',
    );
  });

  it('unwraps a math span whose whole body is one styling command', () => {
    expect(render('$\\textbf{Custom}$')).toBe('<p><strong>Custom</strong></p>');
    expect(render('\\(\\textit{soft}\\)')).toBe('<p><em>soft</em></p>');
    expect(render('$\\texttt{npm i}$')).toBe('<p><code>npm i</code></p>');
    expect(render('$\\text{ibl.ai}$')).toBe('<p>ibl.ai</p>');
    // `\\underline` becomes emphasis: the chat sanitizer drops <u> outright.
    expect(render('$\\underline{note}$')).toBe('<p><em>note</em></p>');
    // A font switch opening the argument carries the styling instead.
    expect(render('$\\textrm{\\bf Bold}$')).toBe(
      '<p><strong>Bold</strong></p>',
    );
  });

  it('keeps a math span that merely mentions a styling command as maths', () => {
    for (const source of [
      '$\\text{a} + \\text{b}$',
      '$\\textbf{x} + 1$',
      '$0.075 \\text{ L} \\times \\frac{1000}{1} = 75 \\text{ mL}$',
      // A display block whose body is a PLAIN-text command is a centred
      // annotation between equations, which is what a display block already
      // renders, so it stays maths. Only styling commands unwrap.
      'see $$\\text{this note}$$ here',
      '$$\\text{Step 2: Multiply first}$$',
    ]) {
      expect(render(source)).toContain('language-math');
    }
  });

  it('unwraps a styling command wrapped in display delimiters', () => {
    // `$$\textbf{Enterprise Management}$$` is a model faking a heading, not a
    // centred equation: KaTeX renders it serif-bold inside sans-serif prose.
    for (const source of ['$$\\textbf{X}$$', '\\[\\textbf{X}\\]']) {
      const html = render(source);
      expect(html).toContain('<strong>X</strong>');
      expect(html).not.toContain('language-math');
    }
  });

  it('unwraps a doubled markdown marker trapped in math delimiters', () => {
    // The model reached for bold and wrapped it in the delimiters it had been
    // told to use; KaTeX renders the markers as literal stars.
    expect(render('$**Custom AI Agents**$')).toContain(
      '<strong>Custom AI Agents</strong>',
    );
    expect(render('$$__Enterprise__$$')).toContain(
      '<strong>Enterprise</strong>',
    );
    // A SINGLE marker is ordinary maths and must survive.
    expect(render('$a * b$')).toContain('language-math');
    expect(render('$x_1 + x_2$')).toContain('language-math');
  });

  it('resolves LaTeX escapes and nested markdown inside a styling argument', () => {
    expect(render('$\\textbf{Canvas \\& *Artifacts*}$')).toBe(
      '<p><strong>Canvas &#x26; <em>Artifacts</em></strong></p>',
    );
  });

  it('converts inline commands inside a converted environment', () => {
    expect(
      render('\\begin{itemize}\n\\item A \\textbf{bold} point\n\\end{itemize}'),
    ).toContain('<strong>bold</strong>');
  });

  it('converts the completed lines of an environment still streaming', () => {
    // A reply arrives token by token: the opener and the finished items are on
    // screen for as long as the model takes to write the rest, and read as raw
    // backslashes the whole time unless they convert as they land. The LAST
    // line is half a token, so it stays raw until its newline arrives.
    const midStream = render(
      'Intro:\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\item Third po',
    );
    expect(midStream).not.toContain('\\begin{itemize}');
    expect(midStream).toContain('<li>First point</li>');
    expect(midStream).toContain('<li>Second point</li>');
    expect(midStream).toContain('\\item Third po');

    expect(render('\\begin{enumerate}\n\\item One\n\\item Tw')).toContain(
      '<li>One</li>',
    );
    expect(render('\\begin{quote}\nwise words\npartial li')).toContain(
      '<blockquote>',
    );

    // Nothing past the opener yet: no empty list, and no raw opener either.
    expect(render('\\begin{itemize}\n')).not.toContain('\\begin{itemize}');

    // Not yet a complete line, so there is nothing safe to convert.
    expect(render('\\begin{itemize}')).toContain('\\begin{itemize}');
  });

  it('leaves a mismatched environment literal rather than closing it', () => {
    // An `\end` for a different environment is malformed input, not a message
    // in flight, so the streaming conversion declines it.
    const html = render('\\begin{itemize}\n\\item a\n\\end{enumerate}\n');
    expect(html).toContain('\\begin{itemize}');
    expect(html).not.toContain('<li>');
  });

  it('leaves a streaming environment measured to convert badly literal', () => {
    // `center` is an accepted loss whether or not it has closed.
    expect(render('\\begin{center}\ncentred text\npartial')).toContain(
      '\\begin{center}',
    );
  });

  it('leaves the environments measured to convert badly alone', () => {
    for (const source of [
      '\\begin{center}\nCentred\n\\end{center}',
      // KaTeX renders `array`, so a markdown table would be a downgrade.
      '$$\\begin{array}{cc} a & b \\end{array}$$',
    ]) {
      expect(render(source)).toContain('\\begin{');
    }
  });

  // KaTeX has no `tabular`, so inside `\[...\]` it answers with a red error
  // box and outside it the source reaches the reader as raw backslashes.
  // Markdown does have a grid.
  describe('tabular', () => {
    it('rebuilds a standalone tabular as a markdown table', () => {
      const html = render(
        '\\begin{tabular}{lcc}A & B & C \\\\D & E & F\\end{tabular}',
      );
      expect(html).toContain('<table>');
      expect(html).toContain('<th');
      expect(html).toContain('<td');
      expect(html).not.toContain('\\begin{tabular}');
    });

    it('rebuilds a tabular wrapped in display delimiters', () => {
      const html = render(
        '\\[\\begin{tabular}{lcc}A & B & C \\\\D & E & F\\end{tabular}\\]',
      );
      expect(html).toContain('<table>');
      expect(html).not.toContain('language-math');
    });

    it('takes its column alignment from the column spec', () => {
      const html = render(
        '\\[\\begin{tabular}{lcr}A & B & C \\\\D & E & F\\end{tabular}\\]',
      );
      expect(html).toContain('align="center"');
      expect(html).toContain('align="right"');
    });

    it('drops the rules and unwraps \\text cells', () => {
      const html = render(
        '\\[\\begin{tabular}{lc}\\hline\\text{Disease} & \\text{Count} \\\\\\hline\\text{Yes} & 42\\\\\\hline\\end{tabular}\\]',
      );
      expect(html).toContain('<th align="left">Disease</th>');
      expect(html).toContain('<td align="left">Yes</td>');
      expect(html).not.toContain('hline');
      expect(html).not.toContain('\\text{');
    });

    it("reads {,} as LaTeX's thousands separator", () => {
      const html = render(
        '\\[\\begin{tabular}{lr}\\text{Cases} & 12{,}500 \\\\\\text{Total} & 100{,}000\\end{tabular}\\]',
      );
      expect(html).toContain('12,500');
      expect(html).toContain('100,000');
    });

    it('keeps an empty leading header cell', () => {
      const html = render(
        '\\[\\begin{tabular}{lcc}\n\\hline\n & \\text{Yes} & \\text{No} \\\\\n\\hline\n\\text{Exposed} & 42 & 158 \\\\\n\\hline\n\\end{tabular}\\]',
      );
      expect(html.match(/<th[ >]/g)).toHaveLength(3);
      expect(html).toContain('Exposed');
    });

    it('renders an all-rules tabular as nothing rather than an error box', () => {
      for (const source of [
        '\\[\\begin{tabular}{lc}\\end{tabular}\\]',
        '\\[\\begin{tabular}{lc}\\hline\\hline\\end{tabular}\\]',
      ]) {
        const html = render(source);
        expect(html).not.toContain('\\begin{tabular}');
        expect(html).not.toContain('language-math');
      }
    });

    it('leaves a tabular whose \\end never arrives literal', () => {
      expect(render('\\begin{tabular}{lc}A & B')).toContain('\\begin{tabular}');
    });
  });

  it('leaves real display maths alone', () => {
    const html = render(
      '$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$',
    );
    expect(html).toContain('language-math');
    expect(html).not.toContain('<ul>');
  });

  it('turns an unwrapped all-verb aligned block into a code fence', () => {
    const html = render(
      '\\begin{aligned}\n&\\verb|let a = 1;|\\\\\n&\\verb|let b = 2;|\\\\\n\\end{aligned}',
    );
    expect(html).toBe('<pre><code>let a = 1;\nlet b = 2;\n</code></pre>');
  });

  it('leaves an unwrapped aligned block that is real maths alone', () => {
    expect(
      render('\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}'),
    ).toContain('\\begin{aligned}');
  });

  it('converts an environment whose items split the paragraph into children', () => {
    // The regression this file exists for: any inline construct inside an
    // environment used to leave `\\begin` and `\\end` in different mdast text
    // nodes, so the island was never seen.
    for (const item of [
      '$x = 4$',
      '\\(y = 2\\)',
      '`code`',
      '**bold**',
      '[d](x)',
    ]) {
      const html = render(
        `\\begin{itemize}\n\\item First\n\\item Second ${item}\n\\end{itemize}`,
      );
      expect(html.match(/<li>/g)).toHaveLength(2);
      expect(html).not.toContain('\\begin{');
    }
  });

  it('keeps an island inside inline code literal', () => {
    expect(
      render('Write `\\begin{itemize}` then `\\end{itemize}` around it.'),
    ).toContain('<code>\\begin{itemize}</code>');
  });

  it('parses an item body that spans several source lines', () => {
    expect(
      render(
        '\\begin{itemize}\n\\item A body that runs on\n  to a second line\n\\item Next\n\\end{itemize}',
      ),
    ).toBe(
      '<ul>\n<li>A body that runs on<br>\nto a second line</li>\n<li>Next</li>\n</ul>',
    );
  });

  it('converts two environments in one paragraph without offset drift', () => {
    const html = render(
      '\\begin{itemize}\n\\item A\n\\end{itemize}\nBetween.\n\\begin{enumerate}\n\\item B\n\\end{enumerate}',
    );
    expect(html).toBe(
      '<ul>\n<li>A</li>\n</ul>\n<p>Between.</p>\n<ol>\n<li>B</li>\n</ol>',
    );
  });

  it('keeps the prose that follows an environment with no blank line', () => {
    expect(
      render('\\begin{itemize}\n\\item A\n\\end{itemize}\nProse right after.'),
    ).toBe('<ul>\n<li>A</li>\n</ul>\n<p>Prose right after.</p>');
  });

  // Reclassified for issue #2441: the redundant marker used to be escaped and
  // so stayed VISIBLE, showing the reader a bullet AND a dash. The environment
  // already supplies the marker, so the doubled one is dropped.
  it('drops a markdown marker doubled onto an item', () => {
    expect(
      render(
        '\\begin{itemize}\n\\item - First\n\\item 1. Second\n\\end{itemize}',
      ),
    ).toBe('<ul>\n<li>First</li>\n<li>Second</li>\n</ul>');
  });

  it('drops every doubled marker shape', () => {
    for (const marker of ['-', '*', '+']) {
      expect(
        render(`\\begin{itemize}\n\\item ${marker} Item text\n\\end{itemize}`),
      ).toBe('<ul>\n<li>Item text</li>\n</ul>');
    }
    for (const marker of ['1.', '1)']) {
      expect(
        render(
          `\\begin{enumerate}\n\\item ${marker} Item text\n\\end{enumerate}`,
        ),
      ).toBe('<ol>\n<li>Item text</li>\n</ol>');
    }
  });

  it('keeps a minus that is part of the content', () => {
    expect(render('\\begin{itemize}\n\\item -5 degrees\n\\end{itemize}')).toBe(
      '<ul>\n<li>-5 degrees</li>\n</ul>',
    );
  });

  it('reads an item that is only a marker as an empty item', () => {
    expect(
      render('\\begin{itemize}\n\\item -\n\\item Next\n\\end{itemize}'),
    ).toBe('<ul>\n<li></li>\n<li>Next</li>\n</ul>');
  });

  it('leaves an item with no doubled marker exactly as it is', () => {
    expect(render('\\begin{itemize}\n\\item Plain item\n\\end{itemize}')).toBe(
      '<ul>\n<li>Plain item</li>\n</ul>',
    );
  });

  it('drops the doubled marker while the maths beside it renders', () => {
    const html = render(
      '\\begin{itemize}\n\\item - English uppercase letters ($A \\ldots Z$)\n\\item - Numbers ($0 \\ldots 9$)\n\\end{itemize}',
    );
    expect(html).not.toContain('<li>-');
    expect(html).toContain('<li>English uppercase letters');
    expect(html.match(/math-inline/g)).toHaveLength(2);
  });

  it('drops a presentational \\item label', () => {
    expect(render('\\begin{itemize}\n\\item[!] Warned\n\\end{itemize}')).toBe(
      '<ul>\n<li>Warned</li>\n</ul>',
    );
  });

  it('leaves an environment with no items alone', () => {
    expect(render('\\begin{itemize}\nnothing here\n\\end{itemize}')).toContain(
      '\\begin{itemize}',
    );
  });

  // The outer marker has nothing to mark, so it is transparent -- the model
  // wrapped the list one level too many. Leaving it literal showed the reader
  // five raw commands around a list that renders perfectly on its own.
  it('converts a list whose only content is a nested environment', () => {
    const html = render(
      '\\begin{itemize}\n\\begin{itemize}\n\\item Deep\n\\end{itemize}\n\\end{itemize}',
    );
    expect(html).toContain('<li>Deep</li>');
    expect(html).not.toContain('\\begin{itemize}');
    expect(html).not.toContain('\\end{itemize}');
  });

  it('converts a mismatched wrapper around a nested environment', () => {
    const html = render(
      '\\begin{enumerate}\n\\begin{itemize}\n\\item Deep\n\\end{itemize}\n\\end{enumerate}',
    );
    expect(html).toContain('<ul>');
    expect(html).not.toContain('\\begin{enumerate}');
  });

  // KaTeX answers this one with a red "No such environment", so the display
  // block has to be rebuilt as blocks even though the outer level is empty.
  it('rebuilds a display block holding only a nested environment', () => {
    const html = render(
      '\\[\\begin{itemize}\n\\begin{itemize}\n\\item Deep\n\\end{itemize}\n\\end{itemize}\\]',
    );
    expect(html).toContain('<li>Deep</li>');
    expect(html).not.toContain('\\begin{itemize}');
  });

  it('leaves an environment closed by a different name alone', () => {
    expect(render('\\begin{itemize}\n\\item A\n\\end{enumerate}')).toContain(
      '\\begin{itemize}',
    );
  });

  it('does nothing at all when the source has no document-mode LaTeX', () => {
    const plain = '# Title\n\nSome **bold** text.\n\n- a\n- b';
    expect(render(plain)).toBe(
      String(
        unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(zilMath)
          .use(remarkBreaks)
          .use(remarkRehype)
          .use(rehypeStringify)
          .processSync(plain),
      ).trim(),
    );
  });

  it('leaves the incomplete openers a stream produces alone', () => {
    // Half-arrived commands: a heading with no closing brace, a verbatim with
    // no `\\end`, an `\\item` label that never closes.
    expect(render('\\section{Unclosed heading')).toContain('\\section{');
    expect(render('\\begin{verbatim}\nhalf a fence')).toContain(
      '\\begin{verbatim}',
    );
    expect(
      render('\\begin{itemize}\n\\item[unclosed label\n\\end{itemize}'),
    ).toContain('unclosed label');
  });

  it('renders an empty heading argument as an empty heading', () => {
    expect(render('\\section{}')).toBe('<h2></h2>');
  });

  it('tolerates a file with no value', () => {
    const tree = { type: 'root' as const, children: [] };
    const parser = { parse: () => ({ type: 'root', children: [] }) };
    expect(() => remarkLatexIslands.call(parser)(tree, {})).not.toThrow();
  });
});

/**
 * The inputs the deleted `lib/preprocess-latex.ts` unit suite pinned that the
 * parser-level pipeline did NOT cover when it replaced the preprocessor. Each
 * one was measured by rendering `preprocessLaTeX(input)` and `input` through
 * this pipeline and comparing the DOM; these are the shapes where the old
 * string pass produced the better page. Kept verbatim so no fix can quietly
 * lose them again.
 */
describe('remarkLatexIslands - restored from the legacy preprocessor corpus', () => {
  it('converts the prose styling commands the old pass converted', () => {
    expect(render('\\texttt{code}')).toBe('<p><code>code</code></p>');
    expect(render('\\underline{underlined}')).toBe(
      '<p><em>underlined</em></p>',
    );
    expect(render('\\verb|code|')).toBe('<p><code>code</code></p>');
    expect(render('Use \\texttt{const} for constants.')).toBe(
      '<p>Use <code>const</code> for constants.</p>',
    );
  });

  it('leaves \\verb literal when its delimiter never closes', () => {
    expect(render('\\verb|never closes')).toContain('\\verb|never closes');
  });

  it('unwraps a display heading around a lone styling command', () => {
    const html = render(
      '\\[\n\\textbf{React Learning To-Do List (AI-Aware, Practical, 4-6 Weeks)}\n\\]\n\nIntro paragraph.',
    );
    expect(html).toContain(
      '<strong>React Learning To-Do List (AI-Aware, Practical, 4-6 Weeks)</strong>',
    );
    expect(html).toContain('Intro paragraph.');
    expect(html).not.toContain('language-math');
  });

  it('rebuilds a display-wrapped itemize, enumerate and self-nesting list', () => {
    expect(
      render(
        '\\[\n\\begin{itemize}\n\\item \\textbf{Why:} spatial reasoning.\n\\item \\textbf{Core skills:} layout and joinery.\n\\end{itemize}\n\\]',
      ),
    ).toBe(
      '<ul>\n<li><strong>Why:</strong> spatial reasoning.</li>\n' +
        '<li><strong>Core skills:</strong> layout and joinery.</li>\n</ul>',
    );

    expect(
      render(
        '$$\n\\begin{enumerate}\n\\item First step.\n\\item Second step.\n\\end{enumerate}\n$$',
      ),
    ).toBe('<ol>\n<li>First step.</li>\n<li>Second step.</li>\n</ol>');

    const nested = render(
      '\\[\n\\begin{itemize}\n\\item \\textbf{Overlap:}\n  \\begin{itemize}\n    \\item \\textit{Tolerances:} wood (\\(\\alpha\\) varies).\n  \\end{itemize}\n\\item \\textbf{Safety:} push sticks.\n\\end{itemize}\n\\]',
    );
    expect(nested.match(/<ul>/g)).toHaveLength(2);
    expect(nested).toContain('<em>Tolerances:</em>');
    // The inline math inside a rebuilt item is still maths.
    expect(nested).toContain('language-math');
  });

  it('leaves the aligned \\verb idiom to rehype-verb-code', () => {
    // The display block still reaches rehype as maths: the code-fence rescue
    // for `\[\begin{aligned}&\verb|...|\\\end{aligned}\]` happens a stage
    // later, so this pass must not claim it.
    expect(
      render(
        '\\[\n\\begin{aligned}\n&\\verb|const a = 1;|\\\\\n\\end{aligned}\n\\]',
      ),
    ).toContain('language-math');
  });

  it('shows nothing for a streaming quote with no line yet', () => {
    expect(render('\\begin{quote}\n')).toBe('');
  });

  // A blank line between two `\item`s is a loose list, not a terminator --
  // but it ends an mdast block, so the outer `\begin` and its `\end` land in
  // different siblings and a scan of one node never sees the pair.
  describe('an environment a blank line splits into two blocks', () => {
    it('joins the blocks back into one list', () => {
      expect(
        render('\\begin{itemize}\n\\item One\n\n\\item Two\n\\end{itemize}'),
      ).toBe('<ul>\n<li>One</li>\n<li>Two</li>\n</ul>');
    });

    it('keeps three levels of nesting and the prose after it', () => {
      const html = render(
        [
          '\\begin{itemize}',
          '  \\item \\textbf{Outer one}',
          '    \\begin{itemize}',
          '      \\item \\textbf{Middle}',
          '        \\begin{itemize}',
          '          \\item Deepest',
          '        \\end{itemize}',
          '    \\end{itemize}',
          '',
          '  \\item \\textbf{Outer two}',
          '\\end{itemize}',
          '',
          'Prose after.',
        ].join('\n'),
      );
      expect(html.match(/<ul>/g)).toHaveLength(3);
      expect(html.match(/<li>/g)).toHaveLength(4);
      expect(html).toContain('<strong>Outer two</strong>');
      expect(html).toContain('Deepest');
      expect(html).toContain('<p>Prose after.</p>');
      expect(html).not.toContain('\\begin');
    });

    it('leaves `\\approx` in a PROSE item body the literal text it was', () => {
      const html = render(
        '\\begin{itemize}\n\\item \\textbf{Qualifying:} \\approx 60 minutes\n\n\\item Next\n\\end{itemize}',
      );
      expect(html).toContain('\\approx 60 minutes');
      expect(html.match(/<li>/g)).toHaveLength(2);
    });

    it('does not reach past one whose \\end never arrives', () => {
      // The streaming rule still shows the completed item; what it must not
      // do is swallow the paragraph after it looking for an `\\end`.
      expect(render('\\begin{itemize}\n\\item One\n\nStill typing')).toBe(
        '<ul>\n<li>One</li>\n</ul>\n<p>Still typing</p>',
      );
    });

    it('leaves one closed by a different \\end alone', () => {
      const html = render('\\begin{itemize}\n\\item One\n\n\\end{enumerate}');
      expect(html).not.toContain('<ul>');
      expect(html).toContain('\\end{enumerate}');
    });

    it('reaches no further than SPAN_LIMIT paragraphs', () => {
      const filler = Array.from({ length: 20 }, (_, i) => `Line ${i}.`).join(
        '\n\n',
      );
      const html = render(
        `\\begin{itemize}\n\\item One\n\n${filler}\n\n\\end{itemize}`,
      );
      expect(html).not.toContain('<ul>');
    });

    // A fenced block, an HTML tag, a markdown list, a heading, a table or a
    // rule inside an environment ends the paragraph exactly as a blank line
    // does, and the span used to stop dead at any of them -- leaving the
    // reader five raw commands around content that had rendered fine.
    it('reaches across a sibling that is not a paragraph', () => {
      const html = render(
        '\\begin{itemize}\n\\item One\n\n```\ncode\n```\n\n\\end{itemize}',
      );
      expect(html).toContain('<ul>');
      expect(html).toContain('<code>code');
      expect(html).not.toContain('\\begin{itemize}');
      expect(html).not.toContain('\\end{itemize}');
    });

    it('reaches across a fence with no blank line around it', () => {
      const html = render(
        '\\begin{itemize}\n\\item Run this:\n```js\nconst a = 1;\n```\n\\item Then done\n\\end{itemize}',
      );
      expect(html.match(/<li>/g)).toHaveLength(2);
      expect(html).toContain('const a = 1;');
      expect(html).not.toContain('\\item');
    });

    it('reaches across an HTML block inside a verbatim body', () => {
      const html = render('\\begin{verbatim}\n<div>x</div>\n\\end{verbatim}');
      expect(html).toContain('<pre><code>');
      expect(html).not.toContain('\\begin{verbatim}');
    });

    it('reaches across a markdown list, a heading and a rule', () => {
      const html = render(
        '\\begin{quote}\n# Title\n\n- a\n- b\n\n---\n\n\\end{quote}',
      );
      expect(html).toContain('<blockquote>');
      expect(html).toContain('<h1>Title</h1>');
      expect(html).not.toContain('\\end{quote}');
    });

    // The span now scans source it did not before, so a fence the reader is
    // being SHOWN must not close the environment or open one of its own.
    it('does not let a fenced \\end close the environment', () => {
      const html = render(
        '\\begin{itemize}\n\\item One\n\n```\n\\end{itemize}\n```\n\nStill typing',
      );
      expect(html).toContain('<code>\\end{itemize}');
      expect(html).toContain('Still typing');
    });

    it('does not open an island inside a fenced block', () => {
      const html = render(
        '\\begin{itemize}\n\\item One\n\n```\n\\begin{enumerate}\n\\item Shown\n\\end{enumerate}\n```\n\n\\end{itemize}',
      );
      expect(html).toContain('<code>\\begin{enumerate}');
      expect(html).not.toContain('<ol>');
    });
  });

  // `\[\textbf{Short answer:} I can't use a web tool ...\]`: KaTeX sets the
  // words outside the group in math mode, which drops every space between
  // them, and the reader gets `Ican'tuseawebtool`.
  describe('a display block that is prose in a maths costume', () => {
    it('rebuilds it as prose, styling command included', () => {
      expect(
        render(
          '\\[\n\\textbf{Short answer:} I can not use a web tool in this chat.\n\\]',
        ),
      ).toBe(
        '<p><strong>Short answer:</strong> I can not use a web tool in this chat.</p>',
      );
    });

    it('leaves maths whose words all live inside \\text alone', () => {
      const html = render(
        '\\[\nI_{sp} = \\frac{\\text{Thrust}}{\\text{Fuel weight flow rate}}\n\\]',
      );
      expect(html).toContain('language-math');
      expect(html).not.toContain('<strong>');
    });

    // Reclassified for issue #2441: the user reported exactly this message
    // rendering as centred serif maths. A whole SENTENCE inside `\text{}` is
    // prose; only a short label still reads as a centred annotation, which the
    // dedicated suite below pins down.
    it('rebuilds a sentence that lives entirely inside \\text as prose', () => {
      expect(render('\\[\n\\text{Hi Conrad, how can I help today?}\n\\]')).toBe(
        '<p>Hi Conrad, how can I help today?</p>',
      );
    });

    it('leaves an environment alone however many words it carries', () => {
      expect(
        render(
          '\\[\n\\begin{aligned}\n&\\verb|const answer = one two three four;|\\\\\n\\end{aligned}\n\\]',
        ),
      ).toContain('language-math');
    });
  });

  // The item text of `\[\begin{itemize}\item \textbf{Qualifying:} \approx 60
  // minutes\end{itemize}\]` was written where `\approx` was legal maths.
  // Spliced into prose it means nothing, and the reader gets the backslash.
  describe('maths commands left in text rebuilt out of a maths node', () => {
    /** The tex of every math span the render produced. */
    const spans = (markdown: string) =>
      [
        ...render(markdown).matchAll(
          /<code class="language-math math-inline">([^<]*)<\/code>/g,
        ),
      ].map((match) => match[1]);

    const item = (body: string) =>
      `\\[\n\\begin{itemize}\n\\item ${body}\n\\end{itemize}\n\\]`;

    it('wraps `\\approx` back into maths and leaves its number in prose', () => {
      const html = render(item('\\textbf{Qualifying:} \\approx 60 minutes'));
      expect(spans(item('\\textbf{Qualifying:} \\approx 60 minutes'))).toEqual([
        '\\approx',
      ]);
      expect(html).toContain('60 minutes');
      expect(html).toContain('<strong>Qualifying:</strong>');
    });

    it.each([
      ['\\times', '3 \\times 4'],
      ['\\le', 'at \\le 10'],
      ['\\ge', 'at \\ge 2'],
      ['\\pm', '\\pm 5 mm'],
      ['\\rightarrow', 'A \\rightarrow B'],
      ['\\alpha', 'angle \\alpha here'],
      ['\\frac{1}{2}', 'about \\frac{1}{2} of it'],
      ['\\sim', 'about \\sim 40 laps'],
    ])('wraps %s', (tex, body) => {
      expect(spans(item(body))).toEqual([tex]);
    });

    it('carries a bracket argument with the command that takes it', () => {
      expect(spans(item('about \\sqrt[3]{27} apples'))).toEqual([
        '\\sqrt[3]{27}',
      ]);
    });

    it('joins commands separated by nothing but spaces into one span', () => {
      expect(spans(item('both \\alpha \\beta together'))).toEqual([
        '\\alpha \\beta',
      ]);
    });

    it('takes a command that ends the text', () => {
      expect(spans(item('60 minutes \\approx'))).toEqual(['\\approx']);
    });

    it('skips a backslash that escapes a character rather than naming one', () => {
      expect(spans(item('\\1 \\approx x'))).toEqual(['\\approx']);
    });

    it.each([
      ['a command KaTeX does not know', 'value \\notarealcommand 12 here'],
      ['a command whose group never closes', 'value \\frac{1 here'],
      ['a command whose bracket never closes', 'value \\sqrt[3 here'],
      ['a command with no argument at all', 'value \\left here'],
    ])('leaves %s literal, with no error box', (_label, body) => {
      const html = render(item(body));
      expect(spans(item(body))).toEqual([]);
      expect(html).toContain('\\');
      expect(html).toContain('here');
    });

    it('leaves a span the math extension itself would not accept literal', () => {
      // A group spanning a line ending: `$...$` may not cross one, so the
      // wrap would not parse as maths and the text stays as it was.
      expect(spans(item('about \\frac{1\n}{2} of it'))).toEqual([]);
    });

    it('leaves `\\verb` and its body alone', () => {
      const html = render(item('\\verb|\\approx stays|'));
      expect(spans(item('\\verb|\\approx stays|'))).toEqual([]);
      expect(html).toContain('<code>\\approx stays</code>');
    });

    it.each([
      ['no delimiter at all', 'trailing \\verb'],
      ['a delimiter that never closes', 'trailing \\verb|\\approx'],
    ])('leaves a `\\verb` with %s alone', (_label, body) => {
      expect(spans(item(body))).toEqual([]);
    });

    it('leaves a code span alone', () => {
      const html = render(item('`\\approx`'));
      expect(spans(item('`\\approx`'))).toEqual([]);
      expect(html).toContain('<code>\\approx</code>');
    });

    it('unwraps a plain-text command to its own words', () => {
      expect(render(item('cost \\text{USD} 5'))).toContain('cost USD 5');
    });

    it('reaches the text of an unwrapped inline styling span', () => {
      expect(spans('A $\\textbf{gap \\approx 3}$ here')).toEqual(['\\approx']);
    });

    it('reaches the text of an unwrapped display styling span', () => {
      expect(spans('\\[\\textbf{gap \\approx 3}\\]')).toEqual(['\\approx']);
    });

    it('leaves prose that never was maths exactly as it was', () => {
      // The gate keeps the whole pass off a message with no document-mode
      // LaTeX, and an island in prose is not an island out of maths.
      expect(render('Qualifying: \\approx 60 minutes')).toBe(
        '<p>Qualifying: \\approx 60 minutes</p>',
      );
      expect(
        render(
          '\\begin{itemize}\n\\item Qualifying: \\approx 60 minutes\n\\end{itemize}',
        ),
      ).toBe('<ul>\n<li>Qualifying: \\approx 60 minutes</li>\n</ul>');
    });

    it('leaves real display maths alone', () => {
      // The message carries an island elsewhere, so the pass runs; the
      // equation is still maths and is still rendered as one span.
      const html = render(
        '\\begin{itemize}\n\\item One\n\\end{itemize}\n\n\\[ x \\approx y + 1 \\]',
      );
      expect(html).toContain('language-math math-display');
      expect(html).toContain('x \\approx y + 1');
    });
  });
});

/**
 * A display block whose every word sits inside `\text{}`. `isProse` counts
 * BARE words -- words OUTSIDE every `{...}` group -- so it sees none of these
 * and the sentence stays maths: centred, serif, at display scale. Two real
 * user reports (issue #2441).
 */
describe('remarkLatexIslands - display maths that is entirely \\text{}', () => {
  const isMath = (markdown: string) =>
    render(markdown).includes('language-math');

  it('renders a one-sentence \\[\\text{...}\\] block as a paragraph', () => {
    const html = render(
      '\\[\n\\text{Hi Conrad, how can I help you today?}\n\\]',
    );
    expect(html).toBe('<p>Hi Conrad, how can I help you today?</p>');
    expect(html).not.toContain('language-math');
  });

  it('renders an all-\\text{} aligned block as one paragraph per row', () => {
    const html = render(
      '$$\n\\begin{aligned}\n&\\text{Got it, Conrad. I received: "e2e first msg 1781965048662".}\\\\\n&\\text{Would you like me to confirm delivery, save this ID, or do something else with it?}\n\\end{aligned}\n$$',
    );
    expect(html).not.toContain('language-math');
    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).toContain('Got it, Conrad. I received:');
    expect(html).toContain('Would you like me to confirm delivery');
  });

  it('splits a bare display block on its own \\\\ row breaks', () => {
    const html = render(
      '\\[\\text{The first sentence lands here.}\\\\\\text{The second sentence lands here.}\\]',
    );
    expect(html).not.toContain('language-math');
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it('reads \\textrm, \\textsf and \\textnormal the same way', () => {
    for (const command of ['textrm', 'textsf', 'textnormal']) {
      expect(
        render(`\\[\\${command}{Here is a whole sentence of prose.}\\]`),
      ).toBe('<p>Here is a whole sentence of prose.</p>');
    }
  });

  it('keeps real alignment maths as maths', () => {
    expect(
      isMath('$$\\begin{aligned} a &= b + c \\\\ d &= e + f \\end{aligned}$$'),
    ).toBe(true);
  });

  it('keeps a matrix as maths', () => {
    expect(isMath('$$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$')).toBe(
      true,
    );
  });

  it('keeps an equation that merely CONTAINS \\text{} as maths', () => {
    expect(
      isMath(
        '\\[0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}\\]',
      ),
    ).toBe(true);
  });

  it('leaves the inline form of the same equation untouched', () => {
    const html = render(
      '$0.075 \\text{ L} \\times \\frac{1000 \\text{ mL}}{1 \\text{ L}} = 75 \\text{ mL}$',
    );
    expect(html).toContain('language-math math-inline');
  });

  /**
   * A centred annotation between two equations is what a display block IS, so
   * a short label stays one. The discriminator is that prose is a SENTENCE:
   * four words or more AND a terminal stop.
   */
  it('keeps a short \\text{} label as the centred annotation it is', () => {
    expect(isMath('$$\\text{Step 2}$$')).toBe(true);
    expect(isMath('$$\\text{Step 3: Add}$$')).toBe(true);
    expect(
      isMath('$$\\text{Step 2: Multiply first (order of operations)}$$'),
    ).toBe(true);
  });

  it('keeps a \\text{} run with no terminal stop as maths', () => {
    expect(isMath('$$\\text{Total revenue by region and quarter}$$')).toBe(
      true,
    );
  });

  it('keeps an aligned block whose rows are not all \\text{} as maths', () => {
    expect(
      isMath(
        '$$\\begin{aligned}&\\text{The total comes out as follows.}\\\\&x = 4\\end{aligned}$$',
      ),
    ).toBe(true);
  });

  it('accepts the ~ tie and the & column marker as separators only', () => {
    expect(
      render('\\[\\text{One}~\\text{two three}~\\text{four five six.}\\]'),
    ).toBe('<p>One two three four five six.</p>');
  });
});

// A chat tab is long-lived and every distinct residual run is a new key, so
// an unbounded cache grows for the lifetime of the session.
describe('the KaTeX render cache', () => {
  it('stops growing once it is full', () => {
    for (let i = 0; i < 1200; i++) {
      render(`\\[\\textbf{Note:} \\alpha_{${i}} plus four more words here.\\]`);
    }
    expect(rendersCacheSize()).toBeGreaterThan(0);
    expect(rendersCacheSize()).toBeLessThanOrEqual(500);
  });
});
