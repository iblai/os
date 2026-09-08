/**
 * Adversarial guard on the one property that makes LaTeX-residue telemetry
 * safe to send: a scanned token can never carry a fragment of the user's
 * message.
 *
 * The sibling markdown-latex-residue.test.ts pins BEHAVIOUR by example. This
 * file pins the INVARIANT instead — every token, for any input, must match the
 * classification shape — so a future widening of the scanner's regex that
 * happens to keep the examples passing still fails here. Message prose reaching
 * Sentry is the failure this whole module is designed to prevent.
 */
import { describe, it, expect } from 'vitest';
import { scanLatexResidue } from '../markdown-latex-residue';

/** A backslash plus letters, or one of the fixed delimiter literals. */
const CLASSIFICATION_ONLY =
  /^(?:\\?[A-Za-z]{1,30}\*?|\\\[|\\\]|\\\(|\\\)|\$\$)$/;

const SENSITIVE: [string, string[]][] = [
  [
    'My password is hunter2 and my card is 4111 1111 1111 1111 \\approx done',
    ['hunter2', '4111'],
  ],
  [
    'Patient John Smith, DOB 1980-01-01: \\begin{tabular} confidential',
    ['John', 'Smith', '1980'],
  ],
  [
    'Email conrad@example.com about \\frac{salary}{bonus} negotiations',
    ['conrad', 'example.com', 'salary', 'bonus'],
  ],
  ['The API key is sk-abc123XYZ \\[ and prose here \\]', ['sk-abc123XYZ']],
  ['\\begin{itemize} my private notes \\end{itemize}', ['private', 'notes']],
  [
    '\\textbf{Acme Corp Q4 revenue was $4.2M} and \\emph{margins fell}',
    ['Acme', 'revenue', 'margins'],
  ],
];

describe('LaTeX residue telemetry never carries prose', () => {
  it.each(SENSITIVE)(
    'reports only classifications for %j',
    (input, forbidden) => {
      const residues = scanLatexResidue(input);
      for (const { token } of residues) {
        expect(token).toMatch(CLASSIFICATION_ONLY);
        expect(token.length).toBeLessThanOrEqual(31);
        for (const secret of forbidden) expect(token).not.toContain(secret);
      }
    },
  );

  it('holds the invariant over generated adversarial inputs', () => {
    // Fuzz the shapes the scanner is meant to classify, each embedded in prose
    // carrying a distinctive secret. Real production messages are deliberately
    // NOT used as a fixture here: they are user conversation content and do not
    // belong in the repository.
    const environments = ['tabular', 'itemize', 'align*', 'pmatrix', 'cases'];
    const commands = ['approx', 'frac', 'textbf', 'ce', 'begin', 'verb'];
    const delimiters = ['\\[', '\\]', '\\(', '\\)', '$$'];
    const secret = 'TOPSECRET-hunter2-4111111111111111';

    const inputs: string[] = [];
    for (const environment of environments)
      inputs.push(
        `${secret} \\begin{${environment}} ${secret} \\end{${environment}} ${secret}`,
      );
    for (const command of commands)
      inputs.push(`prose ${secret} \\${command}{${secret}} more ${secret}`);
    for (const delimiter of delimiters)
      inputs.push(`${secret} ${delimiter} ${secret}`);
    inputs.push(`${secret}\\approx${secret}\\frac${secret}`);
    inputs.push('\\' + 'a'.repeat(200) + ` ${secret}`);
    inputs.push(`\\begin{${'x'.repeat(200)}} ${secret}`);

    let tokens = 0;
    for (const input of inputs)
      for (const { token } of scanLatexResidue(input)) {
        tokens++;
        expect(token).toMatch(CLASSIFICATION_ONLY);
        expect(token).not.toContain('TOPSECRET');
        expect(token).not.toContain('hunter2');
        expect(token).not.toContain('4111');
      }
    expect(tokens).toBeGreaterThan(0);
  });

  it('treats a Windows path as prose, not as commands', () => {
    expect(scanLatexResidue('C:\\Users\\conrad\\Secrets\\api_key.txt')).toEqual(
      [],
    );
  });

  it('reports nothing at all for ordinary prose', () => {
    expect(
      scanLatexResidue('Just a normal sentence costing $100 to $200.'),
    ).toEqual([]);
  });
});
