/**
 * The classifier exists so a render crash can be reproduced from its Sentry
 * event alone. Two things have to hold: the tokens have to be specific enough
 * to point at the construct that broke (the autolink/em-dash case above all,
 * which cost days), and no token may ever carry a character of the message.
 */
import { describe, it, expect } from 'vitest';

import {
  classifyMarkdownShape,
  MARKDOWN_SHAPE_TOKENS,
} from '../markdown-shape-classifier';

const shapeOf = (source: string) =>
  classifyMarkdownShape(source).filter((token) => !token.startsWith('length-'));

const lengthOf = (source: string) =>
  classifyMarkdownShape(source).find((token) => token.startsWith('length-'));

describe('classifyMarkdownShape', () => {
  it('classifies plain prose as shapeless', () => {
    expect(shapeOf('Just some ordinary prose about nothing at all.')).toEqual(
      [],
    );
  });

  describe('autolink-adjacent unicode punctuation', () => {
    // The Fordham crash: an em dash glued to a bare autolink.
    it('flags an em dash before and after a bare www autolink', () => {
      expect(shapeOf('Our site—www.fordham.edu—has more.')).toContain(
        'autolink-adjacent-unicode-punctuation',
      );
    });

    it('flags punctuation only before the autolink', () => {
      expect(shapeOf('Read more—www.fordham.edu')).toContain(
        'autolink-adjacent-unicode-punctuation',
      );
    });

    it('flags a curly quote inside an https autolink run', () => {
      expect(shapeOf('See https://example.com’s docs')).toContain(
        'autolink-adjacent-unicode-punctuation',
      );
    });

    it('leaves a clean autolink unflagged', () => {
      const tokens = shapeOf('Our site www.fordham.edu has more.');
      expect(tokens).toContain('autolink');
      expect(tokens).not.toContain('autolink-adjacent-unicode-punctuation');
    });

    it('does not flag ASCII punctuation around an autolink', () => {
      expect(shapeOf('Visit (www.fordham.edu), then leave.')).not.toContain(
        'autolink-adjacent-unicode-punctuation',
      );
    });

    it('does not flag unicode punctuation separated by whitespace', () => {
      expect(shapeOf('Our site — www.fordham.edu — has more.')).not.toContain(
        'autolink-adjacent-unicode-punctuation',
      );
    });

    it('finds the flagged autolink even when a clean one comes first', () => {
      expect(
        shapeOf('First www.a.com is fine, then www.b.com—broken.'),
      ).toContain('autolink-adjacent-unicode-punctuation');
    });
  });

  it.each([
    ['math-delimiter', '$$\na = b\n$$'],
    ['math-delimiter', 'Inline \\(a\\) maths'],
    ['math-delimiter', 'Prices are $12 apples$ here'],
    ['latex-environment', '\\begin{tabular}{cc}a\\end{tabular}'],
    ['code-fence', 'Text\n\n```ts\nconst a = 1;\n```'],
    ['code-fence', 'Text\n\n~~~\nplain\n~~~'],
    ['table', '| a | b |\n| - | - |\n| 1 | 2 |'],
    ['nested-list', '- one\n  - nested\n'],
    ['nested-list', '1. one\n   1. nested\n'],
    ['html-block', '<div class="x">hi</div>'],
    ['html-block', 'a <br/> b'],
    ['footnote', 'Text[^1]\n\n[^1]: note'],
    ['image', '![alt](https://example.com/a.png)'],
    ['image', '![alt][ref]'],
    ['link-reference', '[ref]: https://example.com'],
  ])('detects %s', (token, source) => {
    expect(shapeOf(source)).toContain(token);
  });

  it('does not call a flat list nested', () => {
    expect(shapeOf('- one\n- two\n')).not.toContain('nested-list');
  });

  it('does not call a uniformly indented list nested', () => {
    expect(shapeOf('  - one\n  - two\n')).not.toContain('nested-list');
  });

  it('does not call an outdented follow-on item nested', () => {
    expect(shapeOf('  - indented first\n- then shallower\n')).not.toContain(
      'nested-list',
    );
  });

  it('treats a tab-indented item as nested', () => {
    expect(shapeOf('- one\n\t- nested\n')).toContain('nested-list');
  });

  it('reports several shapes at once', () => {
    const tokens = shapeOf('| a | b |\n| - | - |\n\n```ts\nx\n```\n\n![i](u)');
    expect(tokens).toEqual(
      expect.arrayContaining(['table', 'code-fence', 'image']),
    );
  });

  it.each([
    ['length-0-64', ''],
    ['length-0-64', 'a'.repeat(63)],
    ['length-64-256', 'a'.repeat(64)],
    ['length-256-1k', 'a'.repeat(256)],
    ['length-1k-4k', 'a'.repeat(1024)],
    ['length-4k-16k', 'a'.repeat(4096)],
    ['length-16k-plus', 'a'.repeat(16384)],
  ])('buckets a source length as %s', (bucket, source) => {
    expect(lengthOf(source)).toBe(bucket);
  });

  it('always emits exactly one length bucket', () => {
    const tokens = classifyMarkdownShape('- one\n  - two\n');
    expect(tokens.filter((t) => t.startsWith('length-'))).toHaveLength(1);
  });
});

/**
 * The invariant, not the examples: for ANY input the tokens come from the
 * closed vocabulary, so no widening of a detector can start leaking prose.
 */
const SENSITIVE = [
  'My password is hunter2 and my card is 4111 1111 1111 1111',
  'Patient John Smith, DOB 1980-01-01—www.hospital.org—admitted',
  'Email conrad@example.com about the 250,000 dollar offer',
  'The API key is sk-abc123XYZ\n\n```bash\nexport KEY=sk-abc123XYZ\n```',
  '| Name | Salary |\n| - | - |\n| Jane Doe | 190000 |',
  '![Jane Doe headshot](https://cdn.internal/jane-doe.png)',
  '<div data-user="jane.doe@example.com">private</div>',
  '\\begin{tabular} secret merger terms \\end{tabular}',
  'Notes[^1]\n\n[^1]: the acquisition closes in March',
  '- Board minutes\n  - Terminate the Chicago lease\n',
];

describe('markdown shape telemetry never carries prose', () => {
  it.each(SENSITIVE)('emits only vocabulary tokens for %j', (source) => {
    const tokens = classifyMarkdownShape(source);
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(MARKDOWN_SHAPE_TOKENS).toContain(token);
      expect(source).not.toContain(token);
    }
  });

  it('survives adversarial input without throwing', () => {
    for (const source of ['', '\0', '\\'.repeat(500), '—'.repeat(500)]) {
      expect(() => classifyMarkdownShape(source)).not.toThrow();
    }
  });
});
