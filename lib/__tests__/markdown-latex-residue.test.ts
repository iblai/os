import {
  hasLatexConstruct,
  scanLatexResidue,
  sourceEnvironments,
} from '../markdown-latex-residue';

describe('scanLatexResidue', () => {
  it('returns nothing for prose with no backslash and no double dollar', () => {
    expect(scanLatexResidue('Ordinary prose costing $100 to $200.')).toEqual(
      [],
    );
  });

  it('names the environment a begin or end survived as', () => {
    expect(
      scanLatexResidue('\\begin{tabular}{cc}A & B \\end{tabular}'),
    ).toEqual([{ kind: 'environment', token: 'tabular', count: 2 }]);
  });

  it('keeps a starred environment name', () => {
    expect(scanLatexResidue('\\begin{align*}')).toEqual([
      { kind: 'environment', token: 'align*', count: 1 },
    ]);
  });

  it('names a multi-letter command left in prose', () => {
    expect(scanLatexResidue('takes \\approx 60 minutes')).toEqual([
      { kind: 'command', token: '\\approx', count: 1 },
    ]);
  });

  it('ignores a single-letter escape, which is far more often prose', () => {
    expect(scanLatexResidue('the regex \\d+ and \\w+')).toEqual([]);
  });

  it('reports a leaked delimiter', () => {
    expect(scanLatexResidue('\\[ x \\]')).toEqual([
      { kind: 'delimiter', token: '\\[', count: 1 },
      { kind: 'delimiter', token: '\\]', count: 1 },
    ]);
    expect(scanLatexResidue('an orphan $$ marker')).toEqual([
      { kind: 'delimiter', token: '$$', count: 1 },
    ]);
  });

  it('counts repeats of one token once, with the count', () => {
    expect(scanLatexResidue('\\alpha and \\alpha and \\alpha')).toEqual([
      { kind: 'command', token: '\\alpha', count: 3 },
    ]);
  });

  it('does not read a Windows path or a backslash-joined word as TeX', () => {
    expect(scanLatexResidue('Open C:\\Users\\taha\\report.docx')).toEqual([]);
    expect(scanLatexResidue('\\\\server\\share and path\\to\\file')).toEqual(
      [],
    );
  });

  it('still reports a command that opens the text node', () => {
    expect(scanLatexResidue('\\approx here')).toEqual([
      { kind: 'command', token: '\\approx', count: 1 },
    ]);
  });

  it('does not apply the path guard to a dollar delimiter', () => {
    expect(scanLatexResidue('x$$y')).toEqual([
      { kind: 'delimiter', token: '$$', count: 1 },
    ]);
  });

  it('caps the distinct tokens one node can contribute', () => {
    const text = Array.from(
      { length: 12 },
      (_, i) => `\\cmd${'x'.repeat(i + 1)}`,
    ).join(' ');
    expect(scanLatexResidue(text)).toHaveLength(8);
  });
});

describe('hasLatexConstruct', () => {
  it('is true only for a construct a conversion rewrites', () => {
    expect(hasLatexConstruct('\\begin{itemize}')).toBe(true);
    expect(hasLatexConstruct('\\verb|x|')).toBe(true);
    expect(hasLatexConstruct('\\[ x \\]')).toBe(true);
    expect(hasLatexConstruct('$$x$$')).toBe(true);
    expect(hasLatexConstruct('[ref]: https://x.io/\\alpha "t"')).toBe(false);
  });
});

describe('sourceEnvironments', () => {
  it('lists the distinct environments a source opens', () => {
    expect(
      sourceEnvironments('\\begin{itemize}\\begin{tabular}\\begin{itemize}'),
    ).toEqual(['itemize', 'tabular']);
  });

  it('returns nothing when the source opens none', () => {
    expect(sourceEnvironments('plain $$x$$ maths')).toEqual([]);
  });

  it('stops at the cap', () => {
    const source = Array.from(
      { length: 12 },
      (_, i) => `\\begin{env${'x'.repeat(i + 1)}}`,
    ).join('');
    expect(sourceEnvironments(source)).toHaveLength(8);
  });
});
