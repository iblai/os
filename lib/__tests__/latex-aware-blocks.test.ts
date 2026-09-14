import { parseMarkdownIntoBlocks } from 'streamdown';

import { parseLatexAwareBlocks } from '../latex-aware-blocks';

/** The blocks Streamdown would have used, for a same-as-before assertion. */
const plain = (md: string) => parseMarkdownIntoBlocks(md);

describe('parseLatexAwareBlocks', () => {
  it('leaves a message with no LaTeX exactly as Streamdown split it', () => {
    const md = 'First paragraph.\n\nSecond paragraph.\n\n- a\n- b';
    expect(parseLatexAwareBlocks(md)).toEqual(plain(md));
  });

  it('joins a display block a blank line cut in two', () => {
    const md =
      '\\[\n\\begin{itemize}\n  \\item One\n\n  \\item Two\n\\end{itemize}\n\\]';
    expect(plain(md).length).toBeGreaterThan(1);
    expect(parseLatexAwareBlocks(md)).toEqual([md]);
  });

  it('joins an environment a blank line cut in two, with no display wrapper', () => {
    const md = '\\begin{itemize}\n\\item One\n\n\\item Two\n\\end{itemize}';
    expect(parseLatexAwareBlocks(md)).toEqual([md]);
  });

  it('joins only as far as the closer and leaves the rest alone', () => {
    const md =
      '\\begin{itemize}\n\\item One\n\n\\item Two\n\\end{itemize}\n\nAfter.';
    const blocks = parseLatexAwareBlocks(md);
    expect(blocks[0]).toBe(
      '\\begin{itemize}\n\\item One\n\n\\item Two\n\\end{itemize}',
    );
    expect(blocks.at(-1)).toBe('After.');
  });

  it('nests same-name environments through a blank line', () => {
    const md =
      '\\begin{itemize}\n\\item One\n\\begin{itemize}\n\\item Deep\n\\end{itemize}\n\n\\item Two\n\\end{itemize}';
    expect(parseLatexAwareBlocks(md)).toEqual([md]);
  });

  it('leaves an environment whose \\end never arrives split', () => {
    const md = '\\begin{itemize}\n\\item One\n\nStill typing';
    expect(parseLatexAwareBlocks(md)).toEqual(plain(md));
  });

  it('leaves an environment closed by a different \\end split', () => {
    const md = '\\begin{itemize}\n\\item One\n\n\\end{enumerate}';
    expect(parseLatexAwareBlocks(md)).toEqual(plain(md));
  });

  it('leaves a stray closer alone', () => {
    expect(parseLatexAwareBlocks('\\]\n\nAfter.')).toEqual(
      plain('\\]\n\nAfter.'),
    );
    expect(parseLatexAwareBlocks('\\end{itemize}\n\nAfter.')).toEqual(
      plain('\\end{itemize}\n\nAfter.'),
    );
  });

  it('reads `\\\\[2pt]` as the line break it is, not as a display opener', () => {
    const md = 'A line \\\\[2pt] and more.\n\nNext paragraph.';
    expect(parseLatexAwareBlocks(md)).toEqual(plain(md));
  });

  it('ignores LaTeX quoted as code', () => {
    const fenced = '```\n\\begin{itemize}\n```\n\nAfter.';
    expect(parseLatexAwareBlocks(fenced)).toEqual(plain(fenced));
    const tilde = '~~~\n\\[\n~~~\n\nAfter.';
    expect(parseLatexAwareBlocks(tilde)).toEqual(plain(tilde));
    const inline = 'Write `\\begin{itemize}` to start.\n\nAfter.';
    expect(parseLatexAwareBlocks(inline)).toEqual(plain(inline));
  });

  // Streamdown renders each block as its own document, so a reference and the
  // definition a blank line put in another block cannot see each other and
  // `[x][y]` reaches the reader literally -- while the same message renders
  // correctly through markdownToHtml(), which parses it in one piece.
  describe('link reference definitions', () => {
    const resolves = (md: string, block = 0) => {
      const blocks = parseLatexAwareBlocks(md);
      return blocks[block];
    };

    it('carries a full reference definition into the block that uses it', () => {
      const md = '[x][y]\n\n[y]: https://example.com "T"';
      expect(resolves(md)).toContain('[y]: https://example.com "T"');
    });

    it('carries one into a collapsed reference', () => {
      const md = '[y][]\n\n[y]: https://example.com';
      expect(resolves(md)).toContain('[y]: https://example.com');
    });

    it('carries one into a shortcut reference', () => {
      const md = '[y]\n\n[y]: https://example.com';
      expect(resolves(md)).toContain('[y]: https://example.com');
    });

    it('carries one into an image reference', () => {
      const md = '![alt][i]\n\n[i]: https://example.com/a.png';
      expect(resolves(md)).toContain('[i]: https://example.com/a.png');
    });

    it('carries the title CommonMark allows on the next line', () => {
      const md = '[x][y]\n\n[y]: https://example.com\n   "Title here"';
      expect(resolves(md)).toContain('"Title here"');
    });

    it('does not harvest a definition-shaped line inside a code fence', () => {
      const md = '```\n[y]: https://example.com\n```\n\n[y][]';
      expect(parseLatexAwareBlocks(md)).toEqual(plain(md));
    });

    it('does not harvest one inside display maths or an environment', () => {
      for (const md of [
        '$$\n[y]: https://example.com\n$$\n\n[y][]',
        '\\begin{verbatim}\n[y]: https://example.com\n\\end{verbatim}\n\n[y][]',
      ]) {
        expect(parseLatexAwareBlocks(md).join('')).not.toContain(
          '[y][]\n\n[y]: https://example.com',
        );
      }
    });

    it('leaves a message with no definition untouched', () => {
      const md = 'A [link](https://example.com).\n\nAnd more text.';
      expect(parseLatexAwareBlocks(md)).toEqual(plain(md));
    });

    it('leaves a block that opens a fence it has not closed alone', () => {
      const md = '```\n[still typing\n\n[y]: https://example.com';
      const blocks = parseLatexAwareBlocks(md);
      expect(blocks[0]).toBe(plain(md)[0]);
    });

    it('drops the passenger entirely when the definitions are outsized', () => {
      const definitions = Array.from(
        { length: 40 },
        (_, i) => `[l${i}]: https://example.com/${'x'.repeat(200)}`,
      ).join('\n');
      const md = `[l0][]\n\n${definitions}`;
      expect(parseLatexAwareBlocks(md)[0]).toBe('[l0][]');
    });
  });

  it('gives up rather than joining the whole message onto one opener', () => {
    const filler = Array.from({ length: 12 }, (_, i) => `Line ${i}.`).join(
      '\n\n',
    );
    const md = `\\begin{itemize}\n\\item One\n\n${filler}\n\n\\end{itemize}`;
    expect(parseLatexAwareBlocks(md)).toEqual(plain(md));
  });
});
