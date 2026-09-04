import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import zilMath from '@ziloen/remark-math';

import { remarkLatexIslands } from '../remark-latex-islands';
import { remarkLatexLineBreaks } from '../remark-latex-line-breaks';

/** The chat order: math, islands, this plugin, then breaks. */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(zilMath)
  .use(remarkLatexIslands)
  .use(remarkLatexLineBreaks)
  .use(remarkBreaks)
  .use(remarkRehype)
  .use(rehypeStringify);

const render = (markdown: string) =>
  String(processor.processSync(markdown)).trim();

describe('remarkLatexLineBreaks', () => {
  it('drops the backslash a LaTeX row break leaves in prose', () => {
    expect(
      render('Line ending with backslashes \\\\\nnext line after hard break.'),
    ).toBe(
      '<p>Line ending with backslashes <br>\nnext line after hard break.</p>',
    );
  });

  it('keeps the row separators of a matrix', () => {
    const html = render('$$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$$');
    expect(html).toContain('math-display');
    expect(html).toContain('\\\\');
    expect(html).toContain('\\begin{pmatrix}');
  });

  it('keeps the row separators of an aligned block', () => {
    const html = render(
      '$$\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n$$',
    );
    expect(html).toContain('math-display');
    expect(html).toContain('a &#x26;= b \\\\');
    expect(html).toContain('c &#x26;= d');
  });

  it('keeps the row separators of a cases block', () => {
    const html = render(
      '$$\\begin{cases} a & x > 0 \\\\ b & x < 0 \\end{cases}$$',
    );
    expect(html).toContain('\\\\');
  });

  it('keeps a trailing backslash inside a fenced code block', () => {
    expect(render('```\nline one \\\nline two\n```')).toBe(
      '<pre><code>line one \\\nline two\n</code></pre>',
    );
  });

  it('keeps a trailing backslash inside an inline code span', () => {
    expect(render('inline `trailing \\` here')).toBe(
      '<p>inline <code>trailing \\</code> here</p>',
    );
  });

  it('leaves backslashes that are not at a line ending alone', () => {
    expect(render('Path C:\\Users\\name mid-sentence.')).toBe(
      '<p>Path C:\\Users\\name mid-sentence.</p>',
    );
  });

  it('leaves a run of two literal backslashes alone', () => {
    // Source `\\\\` is two DELIBERATE backslashes, not one row break.
    expect(render('Two literal backslashes \\\\\\\\\nnext line.')).toBe(
      '<p>Two literal backslashes \\\\<br>\nnext line.</p>',
    );
  });

  it('leaves a message with no backslash at all untouched', () => {
    expect(render('Just prose.\nAnd more prose.')).toBe(
      '<p>Just prose.<br>\nAnd more prose.</p>',
    );
  });

  it('strips the residue inside a converted itemize item', () => {
    expect(
      render(
        '\\begin{itemize}\n\\item First \\\\\nstill first\n\\end{itemize}',
      ),
    ).not.toContain('\\<br>');
  });
});

/**
 * An environment neither KaTeX nor remarkLatexIslands renders falls back to
 * literal source in an ordinary text node. There the `\\` is a row separator
 * the reader is being shown, not residue, so the whole node is left alone.
 */
describe('remarkLatexLineBreaks - literal environment source', () => {
  it('keeps the row separators of an unrenderable environment', () => {
    expect(render('\\begin{center} A \\\\ B \\\\ C\\end{center}')).toContain(
      'A \\',
    );
    expect(render('\\begin{array}{cc} A & B \\\\ C & D\\end{array}')).toContain(
      'B \\',
    );
  });
});
