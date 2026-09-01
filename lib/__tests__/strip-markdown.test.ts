import { describe, it, expect, vi, afterEach } from 'vitest';

import { stripMarkdownForSpeech } from '../strip-markdown';

/* -------------------------------------------------------------------------- */
/* Corpora                                                                     */
/* -------------------------------------------------------------------------- */

type Corpus = ReadonlyArray<readonly [name: string, markdown: string]>;

/**
 * Well-formed markdown of the kind the assistant actually emits. Every strict
 * invariant below is asserted against every entry.
 */
const VALID_CORPUS: Corpus = [
  ['atx heading', '## Foo'],
  ['all heading depths', '# One\n\n### Three\n\n###### Six'],
  ['setext heading', 'Title\n=====\n\nBody'],
  ['setext sub heading', 'Sub\n---\n\nBody'],
  ['closed atx heading', '## Foo ##'],
  ['bold', 'a **bold** b'],
  ['italic underscore', 'a _ital_ b'],
  ['italic star', 'a *ital* b'],
  ['bold underscore', 'a __bold__ b'],
  ['strikethrough', 'a ~~struck~~ b'],
  ['triple emphasis', '***both***'],
  ['nested emphasis', '**bold _and_ italic**'],
  ['inline code', 'Run `pnpm test` now.'],
  ['fenced code', 'Before\n\n```ts\nconst a = 1;\n```\n\nAfter'],
  ['fenced code no lang', 'Before\n\n```\n## nope **nope**\n```\n\nAfter'],
  ['indented code', 'Before\n\n    const a = 1;\n\nAfter'],
  ['inline link', 'See [the docs](https://example.com/a) please.'],
  ['link with title', 'See [docs](https://example.com "Title") ok'],
  ['reference link', 'See [the docs][d].\n\n[d]: https://example.com'],
  ['markdown inside link text', '[**bold** `code` label](https://example.com)'],
  ['image', 'Look ![a cat](https://example.com/cat.png) here.'],
  [
    'reference image',
    'Look ![a cat][c] here.\n\n[c]: https://example.com/c.png',
  ],
  [
    'image inside link',
    '[![logo](https://example.com/l.png) Home](https://example.com)',
  ],
  ['unordered list', '- Milk\n- Eggs\n- Bread'],
  ['ordered list', '1. First\n2. Second'],
  ['nested list', '- Parent\n  - Child\n    - Grandchild'],
  ['deeply nested list', '- a\n  - b\n    - c\n      - d\n        - e'],
  ['nested ordered list', '1. a\n   1. b\n      1. c'],
  ['loose list', '- one\n\n- two'],
  ['list item with paragraphs', '- one\n\n  more prose\n- two'],
  ['task list', '- [ ] open item\n- [x] done item'],
  ['table', '| Name | Age |\n| --- | --- |\n| Ada | 36 |\n| Bob | 41 |'],
  ['aligned table', '| A | B |\n| :-- | --: |\n| 1 | 2 |'],
  ['table with escaped pipe', '| a \\| b | c |\n| --- | --- |\n| 1 | 2 |'],
  ['table with code cell', '| `x` | c |\n| --- | --- |\n| 1 | 2 |'],
  ['ragged table', '| a | b |\n| --- | --- |\n| 1 |\n| 1 | 2 | 3 |'],
  ['blockquote', '> Quoted wisdom.\n\nPlain.'],
  ['multi paragraph blockquote', '> One.\n>\n> Two.'],
  ['nested blockquote', '> a\n>\n> > b\n> >\n> > > c'],
  ['blockquote with list', '> - a\n> - b'],
  ['blockquote with code', '> ```\n> code\n> ```\n>\n> after'],
  ['inline math', 'Let $x$ be five.'],
  ['block math', 'A\n\n$$\nx^2 + y^2\n$$\n\nB'],
  ['thematic break dash', 'a\n\n---\n\nb'],
  ['thematic break star', 'a\n\n***\n\nb'],
  ['thematic break underscore', 'a\n\n___\n\nb'],
  ['hard break spaces', 'one  \ntwo'],
  ['hard break backslash', 'one\\\ntwo'],
  ['footnote', 'Text[^1] more.\n\n[^1]: The note body.'],
  ['html inline', 'Hello <b>world</b> there'],
  ['html block', 'A\n\n<div>\n<span>x</span>\n</div>\n\nB'],
  ['html comment', 'A\n\n<!-- hidden -->\n\nB'],
  ['entities', 'Tom &amp; Jerry, 5 &lt; 6, a&nbsp;b'],
  ['crlf document', '## Title\r\n\r\nBody line\r\n'],
  ['tab separated list', '-\tone\n-\ttwo'],
  [
    'heading with inline constructs',
    '## Use `pnpm` and see [docs](https://example.com)',
  ],
  ['plain prose', 'Hello, how are you today? I am fine.'],
];

/**
 * Deliberately broken markdown. Only the "cannot blow up / cannot produce ugly
 * whitespace" invariants apply here -- a malformed link's URL is visible text
 * on screen, so speaking it is correct.
 */
const MALFORMED_CORPUS: Corpus = [
  ['unclosed fence', 'Before\n\n```ts\nconst a = 1;'],
  ['unclosed bold', '**bold with no close'],
  ['unclosed bold mid sentence', 'a **bold and more text'],
  ['unclosed italic', '_ital with no close'],
  ['unclosed strikethrough', '~~struck with no close'],
  ['unclosed inline code', 'a `unclosed code span'],
  ['unclosed double backtick', 'a ``unclosed'],
  ['unclosed link paren', 'See [text](https://example.com and more'],
  ['unclosed link bracket', 'See [text and more'],
  ['missing reference definition', 'See [the docs][nope] here.'],
  ['missing shortcut reference', 'See [nope] here.'],
  ['bare asterisks', '**'],
  ['many asterisks', '****'],
  ['bare tildes', '~~'],
  ['escaped emphasis', '\\*not bold\\*'],
  ['escaped underscores', '\\_not ital\\_'],
  ['escaped heading', '\\## not a heading'],
  ['escaped backtick', 'a \\`b'],
  ['hashtag without space', '#hashtag stays'],
  ['empty heading', '#\n\nbody'],
  ['unclosed bold in table cell', '| a | b |\n| --- | --- |\n| **x | y |'],
  ['entity encoded script', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['unclosed html tag', 'A <div class="x" B'],
  ['frontmatter', '---\ntitle: x\n---\n\nBody'],
  ['only a thematic break', '---'],
  ['only whitespace lines', '   \n\t\n  '],
  ['zero width space', 'a​b'],
  ['byte order mark', '﻿## Title'],
  ['stray dollar', 'a $ b'],
  ['unbalanced dollars', '$a $b $c'],
  ['unclosed block math', '$$\nx^2'],
  ['literal star mid word', 'a*b*c and 2 * 3 = 6'],
  ['literal underscore mid word', 'snake_case_name stays'],
  ['dunder identifier', 'The __init__ method'],
  ['deeply nested emphasis soup', '***a **b _c ~~d'],
  ['pipe soup', '|||\n|---|\n|||'],
  ['angle soup', '<<<>>>'],
  ['bracket soup', '[[[]]]((()))'],
];

const ALL_CORPUS: Corpus = [...VALID_CORPUS, ...MALFORMED_CORPUS];

/** Every shape that carries a URL the listener must never hear. */
const LINK_DESTINATION_CORPUS: Corpus = [
  ['inline link', 'See [the docs](https://leaked.invalid/secret) now.'],
  ['inline link with title', 'See [d](https://leaked.invalid/secret "T") now.'],
  ['reference link', 'See [d][r].\n\n[r]: https://leaked.invalid/secret'],
  ['collapsed reference', 'See [r][].\n\n[r]: https://leaked.invalid/secret'],
  ['shortcut reference', 'See [r].\n\n[r]: https://leaked.invalid/secret'],
  ['image', '![alt](https://leaked.invalid/secret)'],
  ['reference image', '![alt][r]\n\n[r]: https://leaked.invalid/secret'],
  [
    'image in link',
    '[![a](https://leaked.invalid/secret) x](https://leaked.invalid/secret)',
  ],
  ['definition only', '[r]: https://leaked.invalid/secret'],
  ['link inside heading', '## See [d](https://leaked.invalid/secret)'],
  ['link inside list', '- [d](https://leaked.invalid/secret)'],
  [
    'link inside table',
    '| a |\n| --- |\n| [d](https://leaked.invalid/secret) |',
  ],
  ['link inside quote', '> [d](https://leaked.invalid/secret)'],
  ['http link', 'See [d](http://leaked.invalid/secret) now.'],
];

/* -------------------------------------------------------------------------- */
/* Invariants                                                                  */
/* -------------------------------------------------------------------------- */

describe('stripMarkdownForSpeech invariants', () => {
  describe('never throws', () => {
    it.each(ALL_CORPUS)('survives %s', (_name, markdown) => {
      expect(() => stripMarkdownForSpeech(markdown)).not.toThrow();
    });

    it('survives pathological input without throwing', () => {
      const inputs = [
        '#'.repeat(5000),
        '*'.repeat(5000),
        '['.repeat(2000) + ']'.repeat(2000),
        '> '.repeat(500) + 'deep',
        '- '.repeat(200) + 'wide',
        '`'.repeat(1000),
        '$'.repeat(500),
        '\n'.repeat(1000),
        '|a|'.repeat(500),
      ];
      for (const input of inputs) {
        expect(() => stripMarkdownForSpeech(input)).not.toThrow();
      }
    });
  });

  describe('no markdown sigils survive', () => {
    it.each(VALID_CORPUS)(
      'leaves no spoken syntax in %s',
      (_name, markdown) => {
        const spoken = stripMarkdownForSpeech(markdown);

        // A `#` opening a line would be read out as "hash".
        expect(spoken).not.toMatch(/^\s*#/m);
        expect(spoken).not.toContain('**');
        expect(spoken).not.toContain('__');
        expect(spoken).not.toContain('~~');
        expect(spoken).not.toContain('`');
        expect(spoken).not.toContain('](');
      },
    );

    it.each(MALFORMED_CORPUS)(
      'leaves no spoken syntax even in malformed %s',
      (_name, markdown) => {
        const spoken = stripMarkdownForSpeech(markdown);

        expect(spoken).not.toMatch(/^\s*#/m);
        expect(spoken).not.toContain('**');
        expect(spoken).not.toContain('__');
        expect(spoken).not.toContain('~~');
        expect(spoken).not.toContain('`');
      },
    );
  });

  describe('link destinations never leak', () => {
    it.each(LINK_DESTINATION_CORPUS)(
      'hides the URL of %s',
      (_name, markdown) => {
        const spoken = stripMarkdownForSpeech(markdown);
        expect(spoken).not.toContain('leaked.invalid');
        expect(spoken).not.toContain('://');
      },
    );

    // The deliberate exception: an autolink's label *is* its URL, so it is the
    // only visible text there is. Dropping it would silently delete content the
    // listener can see on screen.
    it('keeps an autolink, whose label is its own URL', () => {
      expect(stripMarkdownForSpeech('Go to <https://example.com> now.')).toBe(
        'Go to https://example.com now.',
      );
      expect(stripMarkdownForSpeech('Go to https://example.com now.')).toBe(
        'Go to https://example.com now.',
      );
    });

    // A link the parser rejected is not a link: its "URL" is literal text the
    // reader can see, so it is spoken like any other prose.
    it('speaks the visible text of a malformed link, brackets aside', () => {
      const spoken = stripMarkdownForSpeech(
        'See [text](https://example.com and more',
      );
      expect(spoken).toContain('text');
      expect(spoken).toContain('and more');
      expect(spoken).not.toContain('](');
    });
  });

  describe('whitespace hygiene', () => {
    it.each(ALL_CORPUS)(
      'produces clean whitespace for %s',
      (_name, markdown) => {
        const spoken = stripMarkdownForSpeech(markdown);

        expect(spoken).toBe(spoken.trim());
        // No blank line anywhere, and no line padded with its own whitespace.
        // An entirely silent document collapses to '' and has no lines at all.
        for (const line of spoken === '' ? [] : spoken.split('\n')) {
          expect(line).not.toBe('');
          expect(line).toBe(line.trim());
        }
        expect(spoken).not.toMatch(/ {2,}/);
        expect(spoken).not.toMatch(/\t/);
        expect(spoken).not.toMatch(/\r/);
      },
    );
  });

  describe('idempotence', () => {
    it.each(VALID_CORPUS)(
      'is stable on a second pass over %s',
      (_name, markdown) => {
        const once = stripMarkdownForSpeech(markdown);
        expect(stripMarkdownForSpeech(once)).toBe(once);
      },
    );

    it.each(LINK_DESTINATION_CORPUS)(
      'is stable on a second pass over %s',
      (_name, markdown) => {
        const once = stripMarkdownForSpeech(markdown);
        expect(stripMarkdownForSpeech(once)).toBe(once);
      },
    );

    // Two documented exceptions, both needing the *input* to have been
    // markdown-escaped or entity-encoded. Re-running the function on its own
    // plain-text output is not something production does; these are recorded so
    // a future change to the escaping rules cannot slip by unnoticed.
    it('is not idempotent for deliberately escaped emphasis', () => {
      // The author escaped the markers so the reader would see them; a second
      // pass has no way to know that and reads them as emphasis.
      expect(stripMarkdownForSpeech('\\*not bold\\*')).toBe('*not bold*');
      expect(stripMarkdownForSpeech('*not bold*')).toBe('not bold');
    });

    it('is not idempotent for entity-encoded HTML', () => {
      const once = stripMarkdownForSpeech(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      );
      expect(once).toBe('<script>alert(1)</script>');
      // Decoded, it is now a real HTML block, which the second pass silences.
      expect(stripMarkdownForSpeech(once)).toBe('');
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Behaviour                                                                   */
/* -------------------------------------------------------------------------- */

describe('stripMarkdownForSpeech', () => {
  describe('empty and non-markdown input', () => {
    it('returns an empty string for an empty input', () => {
      expect(stripMarkdownForSpeech('')).toBe('');
    });

    it('returns an empty string for whitespace-only input', () => {
      expect(stripMarkdownForSpeech('   \n\t\n  ')).toBe('');
    });

    it('returns an empty string for a non-breaking-space-only input', () => {
      expect(stripMarkdownForSpeech('  ')).toBe('');
    });

    it('returns an empty string for a non-string input', () => {
      expect(stripMarkdownForSpeech(null as unknown as string)).toBe('');
      expect(stripMarkdownForSpeech(undefined as unknown as string)).toBe('');
      expect(stripMarkdownForSpeech(42 as unknown as string)).toBe('');
      expect(stripMarkdownForSpeech({} as unknown as string)).toBe('');
      expect(stripMarkdownForSpeech([] as unknown as string)).toBe('');
    });

    it('passes a plain prose string through unchanged', () => {
      const plain = 'Hello, how are you today? I am fine.';
      expect(stripMarkdownForSpeech(plain)).toBe(plain);
    });

    it('keeps punctuation in plain prose intact', () => {
      const plain = 'Café — 3 × 4 = 12; "quoted", (parenthetical).';
      expect(stripMarkdownForSpeech(plain)).toBe(plain);
    });
  });

  describe('headings', () => {
    it('drops the hashes from an ATX heading', () => {
      expect(stripMarkdownForSpeech('## Foo')).toBe('Foo');
    });

    it('drops the hashes at every heading depth', () => {
      expect(stripMarkdownForSpeech('# One\n\n### Three\n\n###### Six')).toBe(
        'One\nThree\nSix',
      );
    });

    it('drops the trailing hashes of a closed ATX heading', () => {
      expect(stripMarkdownForSpeech('## Foo ##')).toBe('Foo');
    });

    it('keeps the heading separate from the paragraph that follows it', () => {
      expect(stripMarkdownForSpeech('## Foo\n\nBody text.')).toBe(
        'Foo\nBody text.',
      );
    });

    it('drops the underline from a setext heading', () => {
      expect(stripMarkdownForSpeech('Title\n=====')).toBe('Title');
      expect(stripMarkdownForSpeech('Sub\n---\n\nBody')).toBe('Sub\nBody');
    });

    it('drops hashes the parser refused to treat as a heading', () => {
      // Escaped by the author, so CommonMark renders them as literal text --
      // but "hash hash not a heading" is not what anyone wants to hear.
      expect(stripMarkdownForSpeech('\\## not a heading')).toBe(
        'not a heading',
      );
      expect(stripMarkdownForSpeech('#hashtag stays')).toBe('hashtag stays');
    });

    it('speaks the inline content of a heading without its syntax', () => {
      expect(
        stripMarkdownForSpeech('## Use `pnpm` and see [docs](https://x.com)'),
      ).toBe('Use pnpm and see docs');
    });

    it('drops an empty heading', () => {
      expect(stripMarkdownForSpeech('#\n\nbody')).toBe('body');
    });
  });

  describe('emphasis', () => {
    it('unwraps bold, italic and strikethrough', () => {
      expect(stripMarkdownForSpeech('**x**')).toBe('x');
      expect(stripMarkdownForSpeech('_x_')).toBe('x');
      expect(stripMarkdownForSpeech('*x*')).toBe('x');
      expect(stripMarkdownForSpeech('__x__')).toBe('x');
      expect(stripMarkdownForSpeech('~~x~~')).toBe('x');
    });

    it('unwraps triple emphasis', () => {
      expect(stripMarkdownForSpeech('***both***')).toBe('both');
    });

    it('unwraps nested emphasis without losing the inner text', () => {
      expect(stripMarkdownForSpeech('**bold _and italic_ here**')).toBe(
        'bold and italic here',
      );
    });

    it('does not glue emphasised words to their neighbours', () => {
      expect(stripMarkdownForSpeech('**bold** and _ital_ and ~~struck~~')).toBe(
        'bold and ital and struck',
      );
    });

    it('keeps a word split across emphasis boundaries as one word', () => {
      expect(stripMarkdownForSpeech('**re**start')).toBe('restart');
    });

    it('drops the markers of an emphasis run that was never closed', () => {
      // The single most common shape in truncated or hand-written LLM output.
      expect(stripMarkdownForSpeech('**bold with no close')).toBe(
        'bold with no close',
      );
      expect(stripMarkdownForSpeech('a **bold and more text')).toBe(
        'a bold and more text',
      );
      expect(stripMarkdownForSpeech('~~struck with no close')).toBe(
        'struck with no close',
      );
      expect(
        stripMarkdownForSpeech('| a | b |\n| --- | --- |\n| **x | y |'),
      ).toBe('a, b\nx, y');
    });

    it('drops stray double markers used as literal punctuation', () => {
      expect(stripMarkdownForSpeech('a ** b')).toBe('a b');
      expect(stripMarkdownForSpeech('2 ** 3 = 8')).toBe('2 3 = 8');
      expect(stripMarkdownForSpeech('The __init__ method')).toBe(
        'The init method',
      );
    });

    it('keeps the word when the author escaped the markers', () => {
      const spoken = stripMarkdownForSpeech('\\*not bold\\*');
      expect(spoken).toContain('not bold');
      expect(spoken).not.toContain('\\');
    });

    it('keeps a lone underscore, which is part of an identifier', () => {
      // Dropping it would fuse the words into one unpronounceable token.
      expect(stripMarkdownForSpeech('snake_case_name stays')).toBe(
        'snake_case_name stays',
      );
    });

    it('keeps a lone asterisk used as arithmetic', () => {
      expect(stripMarkdownForSpeech('2 * 3 = 6')).toBe('2 * 3 = 6');
    });
  });

  describe('code', () => {
    it('speaks inline code as its plain text', () => {
      expect(stripMarkdownForSpeech('Run `pnpm test` now.')).toBe(
        'Run pnpm test now.',
      );
    });

    it('drops a fenced code block entirely', () => {
      expect(
        stripMarkdownForSpeech('Before\n\n```ts\nconst a = 1;\n```\n\nAfter'),
      ).toBe('Before\nAfter');
    });

    it('drops a fenced code block with no language tag', () => {
      expect(stripMarkdownForSpeech('```\n## not a heading\n```')).toBe('');
    });

    it('drops an indented code block entirely', () => {
      expect(
        stripMarkdownForSpeech('Before\n\n    const a = 1;\n\nAfter'),
      ).toBe('Before\nAfter');
    });

    it('drops a code block inside a blockquote', () => {
      expect(stripMarkdownForSpeech('> ```\n> code\n> ```\n>\n> after')).toBe(
        'after',
      );
    });

    it('drops a code block that was never closed', () => {
      expect(stripMarkdownForSpeech('Before\n\n```ts\nconst a = 1;')).toBe(
        'Before',
      );
    });

    it('does not read markdown characters that live inside a code block', () => {
      const spoken = stripMarkdownForSpeech(
        '```\n**not bold** ## not heading\n```',
      );
      expect(spoken).not.toContain('*');
      expect(spoken).not.toContain('#');
    });

    it('drops the backtick of a code span that was never closed', () => {
      expect(stripMarkdownForSpeech('a `unclosed code span')).toBe(
        'a unclosed code span',
      );
      expect(stripMarkdownForSpeech('a \\`b')).toBe('a b');
    });
  });

  describe('links and images', () => {
    it('speaks the link text and never the URL', () => {
      expect(
        stripMarkdownForSpeech('See [the docs](https://example.com/a) please.'),
      ).toBe('See the docs please.');
    });

    it('drops a link title as well as its destination', () => {
      expect(
        stripMarkdownForSpeech('[text](https://example.com "Some Title")'),
      ).toBe('text');
    });

    it('speaks the text of a reference link and drops its definition', () => {
      expect(
        stripMarkdownForSpeech(
          'See [the docs][d].\n\n[d]: https://example.com',
        ),
      ).toBe('See the docs.');
    });

    it('strips markdown inside link text', () => {
      expect(
        stripMarkdownForSpeech('[**bold** `code` label](https://example.com)'),
      ).toBe('bold code label');
    });

    it('leaves a reference link with no definition as its visible text', () => {
      const spoken = stripMarkdownForSpeech('See [the docs][nope] here.');
      expect(spoken).toContain('the docs');
      expect(spoken).toContain('here.');
    });

    // An autolink's label *is* its URL, so speaking it is not "reading the
    // URL out" -- it is reading the only visible text there is.
    it('speaks an autolink as the URL text the reader can see', () => {
      expect(stripMarkdownForSpeech('Go to <https://example.com> now.')).toBe(
        'Go to https://example.com now.',
      );
    });

    it('drops an image entirely, alt text included', () => {
      expect(
        stripMarkdownForSpeech(
          'Look ![a cat](https://example.com/cat.png) here.',
        ),
      ).toBe('Look here.');
    });

    it('drops an image title as well', () => {
      expect(
        stripMarkdownForSpeech('![alt](https://example.com/a.png "Cap")'),
      ).toBe('');
    });

    it('drops a reference image and its definition', () => {
      expect(
        stripMarkdownForSpeech('Look ![a cat][c] here.\n\n[c]: /cat.png'),
      ).toBe('Look here.');
    });

    it('speaks a linked label but not the image inside the link', () => {
      expect(
        stripMarkdownForSpeech('[![logo](/l.png) Home](https://example.com)'),
      ).toBe('Home');
    });
  });

  describe('lists', () => {
    it('separates unordered items so they do not run together', () => {
      expect(stripMarkdownForSpeech('- Milk\n- Eggs\n- Bread')).toBe(
        'Milk\nEggs\nBread',
      );
    });

    it('separates ordered items and drops their markers', () => {
      expect(stripMarkdownForSpeech('1. First\n2. Second')).toBe(
        'First\nSecond',
      );
    });

    it('separates nested items at every depth', () => {
      expect(stripMarkdownForSpeech('- a\n  - b\n    - c\n      - d')).toBe(
        'a\nb\nc\nd',
      );
      expect(stripMarkdownForSpeech('1. a\n   1. b\n      1. c')).toBe(
        'a\nb\nc',
      );
    });

    it('separates task list items and drops the checkboxes', () => {
      expect(stripMarkdownForSpeech('- [ ] todo one\n- [x] done two')).toBe(
        'todo one\ndone two',
      );
    });

    it('separates the items of a loose list', () => {
      expect(stripMarkdownForSpeech('- one\n\n- two')).toBe('one\ntwo');
    });

    it('separates the paragraphs inside a single item', () => {
      expect(stripMarkdownForSpeech('- one\n\n  more\n- two')).toBe(
        'one\nmore\ntwo',
      );
    });

    it('separates tab-indented items', () => {
      expect(stripMarkdownForSpeech('-\tone\n-\ttwo')).toBe('one\ntwo');
    });

    it('drops a list item whose only content is a code block', () => {
      expect(stripMarkdownForSpeech('- Keep me\n- ```\n  code\n  ```')).toBe(
        'Keep me',
      );
    });
  });

  describe('tables', () => {
    it('separates cells and rows readably', () => {
      expect(
        stripMarkdownForSpeech(
          '| Name | Age |\n| --- | --- |\n| Ada | 36 |\n| Bob | 41 |',
        ),
      ).toBe('Name, Age\nAda, 36\nBob, 41');
    });

    it('drops the delimiter row and cell pipes', () => {
      const spoken = stripMarkdownForSpeech(
        '| A | B |\n| :-- | --: |\n| 1 | 2 |',
      );
      expect(spoken).not.toContain('|');
      expect(spoken).not.toContain('--');
    });

    it('skips empty cells instead of speaking stray separators', () => {
      expect(stripMarkdownForSpeech('| A | B |\n| --- | --- |\n| 1 |  |')).toBe(
        'A, B\n1',
      );
    });

    it('speaks an escaped pipe as a literal character', () => {
      expect(
        stripMarkdownForSpeech('| a \\| b | c |\n| --- | --- |\n| 1 | 2 |'),
      ).toBe('a | b, c\n1, 2');
    });

    it('speaks a code cell as its text', () => {
      expect(
        stripMarkdownForSpeech('| `x` | c |\n| --- | --- |\n| 1 | 2 |'),
      ).toBe('x, c\n1, 2');
    });

    it('handles rows with too few and too many cells', () => {
      // remark-gfm keeps the overflow cell rather than discarding it, so the
      // listener hears everything that is in the source.
      expect(
        stripMarkdownForSpeech(
          '| a | b |\n| --- | --- |\n| 1 |\n| 1 | 2 | 3 |',
        ),
      ).toBe('a, b\n1\n1, 2, 3');
    });

    it('speaks a header-only table', () => {
      expect(stripMarkdownForSpeech('| a |\n| --- |')).toBe('a');
    });
  });

  describe('blockquotes', () => {
    it('speaks the quoted text without the marker', () => {
      expect(stripMarkdownForSpeech('> Quoted wisdom.\n\nPlain.')).toBe(
        'Quoted wisdom.\nPlain.',
      );
    });

    it('speaks every paragraph of a multi-paragraph quote', () => {
      expect(stripMarkdownForSpeech('> One.\n>\n> Two.')).toBe('One.\nTwo.');
    });

    it('unwraps quotes nested three deep', () => {
      expect(stripMarkdownForSpeech('> a\n>\n> > b\n> >\n> > > c')).toBe(
        'a\nb\nc',
      );
    });

    it('separates the items of a list inside a quote', () => {
      expect(stripMarkdownForSpeech('> - a\n> - b')).toBe('a\nb');
    });
  });

  describe('raw HTML, breaks and rules', () => {
    it('drops HTML tags but keeps the text between them', () => {
      expect(stripMarkdownForSpeech('Hello <b>world</b> there')).toBe(
        'Hello world there',
      );
    });

    it('leaves a word gap where an inline tag was, so words do not merge', () => {
      expect(stripMarkdownForSpeech('there<br/>done')).toBe('there done');
    });

    it('drops an HTML block entirely', () => {
      expect(
        stripMarkdownForSpeech('A\n\n<div>\n<span></span>\n</div>\n\nB'),
      ).toBe('A\nB');
    });

    it('never speaks the contents of a script or style block', () => {
      expect(
        stripMarkdownForSpeech('<script>\nalert("pwned")\n</script>'),
      ).toBe('');
      expect(
        stripMarkdownForSpeech('<style>\n.x { color: red }\n</style>'),
      ).toBe('');
      expect(
        stripMarkdownForSpeech('A\n\n<script>\nalert(1)\n</script>\n\nB'),
      ).toBe('A\nB');
      expect(
        stripMarkdownForSpeech('A\n\n<style>\n.x{color:red}\n</style>\n\nB'),
      ).toBe('A\nB');
    });

    it('drops an HTML comment', () => {
      expect(stripMarkdownForSpeech('A\n\n<!-- hidden -->\n\nB')).toBe('A\nB');
      expect(stripMarkdownForSpeech('A <!-- x --> B')).toBe('A B');
    });

    it('decodes HTML entities to the characters the reader sees', () => {
      expect(stripMarkdownForSpeech('Tom &amp; Jerry')).toBe('Tom & Jerry');
      expect(stripMarkdownForSpeech('5 &lt; 6')).toBe('5 < 6');
      expect(stripMarkdownForSpeech('a&nbsp;b')).toBe('a b');
    });

    it('turns a hard line break into a word gap', () => {
      expect(stripMarkdownForSpeech('line one  \nline two')).toBe(
        'line one line two',
      );
      expect(stripMarkdownForSpeech('line one\\\nline two')).toBe(
        'line one line two',
      );
    });

    it('drops a thematic break of every flavour', () => {
      expect(stripMarkdownForSpeech('A\n\n---\n\nB')).toBe('A\nB');
      expect(stripMarkdownForSpeech('A\n\n***\n\nB')).toBe('A\nB');
      expect(stripMarkdownForSpeech('A\n\n___\n\nB')).toBe('A\nB');
    });

    it('normalises CRLF line endings', () => {
      expect(stripMarkdownForSpeech('## Title\r\n\r\nBody line\r\n')).toBe(
        'Title\nBody line',
      );
      expect(stripMarkdownForSpeech('- one\r\n- two\r\n')).toBe('one\ntwo');
    });
  });

  describe('footnotes', () => {
    it('drops the reference marker and speaks the note body', () => {
      expect(stripMarkdownForSpeech('Text[^1].\n\n[^1]: The note body.')).toBe(
        'Text.\nThe note body.',
      );
    });

    it('drops several reference markers from one paragraph', () => {
      const spoken = stripMarkdownForSpeech(
        'A[^1] and B[^2].\n\n[^1]: One.\n[^2]: Two.',
      );
      expect(spoken).toContain('A and B.');
      expect(spoken).not.toContain('[^');
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Currency vs. maths -- the highest-risk interaction                        */
  /* ------------------------------------------------------------------------ */

  describe('currency is never mistaken for maths', () => {
    const prices: ReadonlyArray<readonly [string, string]> = [
      ['bare dollars', 'It costs $5.'],
      ['decimal', 'It costs $5.00 today.'],
      ['two amounts', 'It is $5 or $6.'],
      ['thousands separator', 'That is $1,000 exactly.'],
      ['currency prefix', 'Pay US$20 now.'],
      ['end of sentence', 'Total: $9.99. Thanks!'],
      ['range', 'Between $10 and $20 per seat.'],
      ['three amounts', '$1 then $2 then $3.'],
      ['large amount', 'Revenue was $1,250,000.50 last year.'],
      ['amount in a list', '- Basic $5\n- Pro $15'],
      ['amount in a table', '| Plan | Cost |\n| --- | --- |\n| Pro | $15 |'],
      ['amount in a heading', '## Plans from $5'],
      ['amount in a quote', '> It costs $5.'],
    ];

    it.each(prices)('keeps the amounts in %s', (_name, markdown) => {
      const spoken = stripMarkdownForSpeech(markdown);
      // Every `$n` in the input must still be there in the output.
      for (const amount of markdown.match(/\$[\d,.]+/g) ?? []) {
        expect(spoken).toContain(amount);
      }
    });

    it('keeps prices verbatim in the common shapes', () => {
      expect(stripMarkdownForSpeech('It costs $5.')).toBe('It costs $5.');
      expect(stripMarkdownForSpeech('It costs $5.00 today.')).toBe(
        'It costs $5.00 today.',
      );
      expect(stripMarkdownForSpeech('It is $5 or $6.')).toBe('It is $5 or $6.');
      expect(stripMarkdownForSpeech('That is $1,000 exactly.')).toBe(
        'That is $1,000 exactly.',
      );
      expect(stripMarkdownForSpeech('Pay US$20 now.')).toBe('Pay US$20 now.');
      expect(stripMarkdownForSpeech('Total: $9.99. Thanks!')).toBe(
        'Total: $9.99. Thanks!',
      );
    });

    it('keeps a price sitting next to emphasis', () => {
      expect(stripMarkdownForSpeech('**$5** is the price')).toBe(
        '$5 is the price',
      );
      expect(stripMarkdownForSpeech('The _$5_ tier')).toBe('The $5 tier');
      expect(stripMarkdownForSpeech('Costs **$5** or **$6**')).toBe(
        'Costs $5 or $6',
      );
    });

    it('keeps a price inside a link label', () => {
      expect(stripMarkdownForSpeech('[Buy for $5](https://example.com)')).toBe(
        'Buy for $5',
      );
    });
  });

  describe('maths is dropped, not read aloud', () => {
    it('drops inline maths', () => {
      expect(stripMarkdownForSpeech('The answer is $x = 5$ ok')).toBe(
        'The answer is ok',
      );
      expect(stripMarkdownForSpeech('Value $\\frac{a}{b}$ ok')).toBe(
        'Value ok',
      );
    });

    it('drops display maths', () => {
      expect(
        stripMarkdownForSpeech('Before\n\n$$\n\\frac{a}{b}\n$$\n\nAfter'),
      ).toBe('Before\nAfter');
    });

    it('never leaks a LaTeX command', () => {
      const spoken = stripMarkdownForSpeech(
        'Given $\\sum_{i=1}^{n} x_i$ and $$\\int_0^1 f(x)\\,dx$$ we finish.',
      );
      expect(spoken).not.toContain('\\');
      expect(spoken).not.toContain('sum');
      expect(spoken).not.toContain('int_');
    });

    it('separates a price from an equation in the same sentence', () => {
      expect(stripMarkdownForSpeech('It costs $5 when $x = 2$ holds.')).toBe(
        'It costs $5 when holds.',
      );
      expect(
        stripMarkdownForSpeech('Solve $y = mx + b$ to price it at $12.'),
      ).toBe('Solve to price it at $12.');
    });

    it('drops maths from a heading', () => {
      expect(stripMarkdownForSpeech('## Solve $x$ now')).toBe('Solve now');
    });

    it('survives an unbalanced dollar sign', () => {
      const spoken = stripMarkdownForSpeech('a $ b');
      expect(spoken).toContain('a');
      expect(spoken).toContain('b');
    });

    it('survives an unclosed display maths block', () => {
      expect(() => stripMarkdownForSpeech('$$\nx^2')).not.toThrow();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Internationalisation                                                      */
  /* ------------------------------------------------------------------------ */

  describe('unicode passes through intact', () => {
    const samples: ReadonlyArray<readonly [string, string]> = [
      ['accented latin', 'Café naïve résumé Ångström œuvre'],
      ['german and nordic', 'Grüße aus Köln, Ærø, Þórr'],
      ['cyrillic', 'Привет, мир! Как дела?'],
      ['greek', 'Γειά σου Κόσμε'],
      ['chinese', '你好世界，这是一个测试。'],
      ['japanese', 'こんにちは世界。これはテストです。'],
      ['korean', '안녕하세요 세계'],
      ['arabic rtl', 'مرحبا بالعالم، هذا اختبار.'],
      ['hebrew rtl', 'שלום עולם'],
      ['thai', 'สวัสดีชาวโลก'],
      ['devanagari', 'नमस्ते दुनिया'],
      ['emoji', 'Great 👍 work 🎉'],
      ['emoji with skin tone', 'Nice 👍🏽 job'],
      ['zwj emoji family', 'Family 👨‍👩‍👧‍👦 here'],
      ['flag emoji', 'Flags 🇬🇧 🇯🇵 here'],
      ['combining marks', 'é ä ñ'],
      ['zero width space', 'a​b'],
    ];

    it.each(samples)('preserves %s in plain prose', (_name, text) => {
      expect(stripMarkdownForSpeech(text)).toBe(text);
    });

    it.each(samples)('preserves %s inside markdown', (_name, text) => {
      const spoken = stripMarkdownForSpeech(`## Heading\n\n**${text}**`);
      expect(spoken).toBe(`Heading\n${text}`);
    });

    it('preserves RTL text inside a list and a table', () => {
      expect(stripMarkdownForSpeech('- مرحبا\n- بالعالم')).toBe(
        'مرحبا\nبالعالم',
      );
      expect(
        stripMarkdownForSpeech('| اسم | عمر |\n| --- | --- |\n| علي | ٣٦ |'),
      ).toBe('اسم, عمر\nعلي, ٣٦');
    });

    it('preserves CJK text across headings and quotes', () => {
      expect(stripMarkdownForSpeech('## 標題\n\n> 引用文字')).toBe(
        '標題\n引用文字',
      );
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Realistic assistant replies                                               */
  /* ------------------------------------------------------------------------ */

  describe('realistic assistant replies', () => {
    it('strips a numbered walkthrough with code between the steps', () => {
      const markdown = [
        '## Getting started',
        '',
        'Here is how to set up the project.',
        '',
        '1. Install the dependencies:',
        '',
        '```bash',
        'pnpm install',
        '```',
        '',
        '2. Copy the environment file:',
        '',
        '```bash',
        'cp .env.example .env',
        '```',
        '',
        '3. Start the dev server with `pnpm dev`.',
        '',
        'You should now see the app at [localhost:3000](http://localhost:3000).',
      ].join('\n');

      const spoken = stripMarkdownForSpeech(markdown);

      expect(spoken).toBe(
        [
          'Getting started',
          'Here is how to set up the project.',
          'Install the dependencies:',
          'Copy the environment file:',
          'Start the dev server with pnpm dev.',
          'You should now see the app at localhost:3000.',
        ].join('\n'),
      );
      expect(spoken).not.toContain('pnpm install');
      expect(spoken).not.toContain('http://');
    });

    it('strips a comparison table', () => {
      const markdown = [
        '### Plan comparison',
        '',
        'A quick summary:',
        '',
        '| Plan | Price | Seats |',
        '| --- | --- | --- |',
        '| Free | $0 | 1 |',
        '| Team | $15 | 10 |',
        '| Enterprise | Custom | Unlimited |',
        '',
        'Let me know which one fits.',
      ].join('\n');

      expect(stripMarkdownForSpeech(markdown)).toBe(
        [
          'Plan comparison',
          'A quick summary:',
          'Plan, Price, Seats',
          'Free, $0, 1',
          'Team, $15, 10',
          'Enterprise, Custom, Unlimited',
          'Let me know which one fits.',
        ].join('\n'),
      );
    });

    it('strips a bulleted summary with bold lead-ins', () => {
      const markdown = [
        'Three things stand out:',
        '',
        '- **Performance** — the build is 40% faster.',
        '- **Reliability** — no flakes in the last _200_ runs.',
        '- **Cost** — roughly $120 a month cheaper.',
        '',
        'Happy to dig into any of these.',
      ].join('\n');

      expect(stripMarkdownForSpeech(markdown)).toBe(
        [
          'Three things stand out:',
          'Performance — the build is 40% faster.',
          'Reliability — no flakes in the last 200 runs.',
          'Cost — roughly $120 a month cheaper.',
          'Happy to dig into any of these.',
        ].join('\n'),
      );
    });

    it('strips a reply mixing prose, inline code and a link', () => {
      const markdown =
        'You can call `stripMarkdownForSpeech()` from anywhere. ' +
        'The full API is in [the docs](https://example.com/api), ' +
        'and the source lives in `lib/strip-markdown.ts`.';

      expect(stripMarkdownForSpeech(markdown)).toBe(
        'You can call stripMarkdownForSpeech() from anywhere. ' +
          'The full API is in the docs, ' +
          'and the source lives in lib/strip-markdown.ts.',
      );
    });

    it('strips a reply that quotes the user and answers below', () => {
      const markdown = [
        '> Can I use this in production?',
        '',
        'Yes. It has **no** runtime dependencies beyond `remark`,',
        'and it degrades gracefully.',
      ].join('\n');

      expect(stripMarkdownForSpeech(markdown)).toBe(
        [
          'Can I use this in production?',
          'Yes. It has no runtime dependencies beyond remark,',
          'and it degrades gracefully.',
        ].join('\n'),
      );
    });

    it('strips a maths tutoring reply', () => {
      const markdown = [
        '## Solving for x',
        '',
        'Start from $2x + 3 = 11$.',
        '',
        '1. Subtract three from both sides.',
        '2. Divide by two.',
        '',
        'So $$x = 4$$ and the tickets cost $4 each.',
      ].join('\n');

      const spoken = stripMarkdownForSpeech(markdown);

      expect(spoken).toContain('Solving for x');
      expect(spoken).toContain('Subtract three from both sides.');
      expect(spoken).toContain('$4 each');
      expect(spoken).not.toContain('2x + 3');
      expect(spoken).not.toContain('#');
    });

    it('returns nothing for a reply that is only a code block', () => {
      expect(
        stripMarkdownForSpeech(
          '```typescript\nexport function add(a: number, b: number) {\n  return a + b;\n}\n```',
        ),
      ).toBe('');
    });

    it('returns nothing for a reply that is only an image', () => {
      expect(
        stripMarkdownForSpeech('![chart](https://example.com/c.png)'),
      ).toBe('');
    });

    it('returns nothing for a reply that is only maths', () => {
      expect(stripMarkdownForSpeech('$$\nE = mc^2\n$$')).toBe('');
    });
  });

  describe('whitespace', () => {
    it('collapses runs of spaces and blank lines with no leading or trailing gap', () => {
      expect(
        stripMarkdownForSpeech('\n\n\n#  Title  \n\n\n\nSome    text\n\n\n'),
      ).toBe('Title\nSome text');
    });

    it('collapses tabs inside a line', () => {
      expect(stripMarkdownForSpeech('one\t\ttwo')).toBe('one two');
    });

    it('collapses many consecutive blank lines to one break', () => {
      expect(stripMarkdownForSpeech('a\n\n\n\n\n\nb')).toBe('a\nb');
    });

    it('trims each line', () => {
      expect(stripMarkdownForSpeech('  a  \n  b  ')).toBe('a b');
    });

    it('returns an empty string when every block is silent', () => {
      expect(
        stripMarkdownForSpeech('![alt](/a.png)\n\n---\n\n```\ncode\n```'),
      ).toBe('');
    });
  });

  describe('combined document', () => {
    it('strips every construct from a realistic assistant reply', () => {
      const markdown = [
        '## Setup guide',
        '',
        'Install **the package** and read [the docs](https://example.com).',
        '',
        '```bash',
        'pnpm add thing',
        '```',
        '',
        '1. Run `pnpm dev`',
        '2. Open the app',
        '',
        '> Note: this is _important_.',
      ].join('\n');

      const spoken = stripMarkdownForSpeech(markdown);

      expect(spoken).toBe(
        [
          'Setup guide',
          'Install the package and read the docs.',
          'Run pnpm dev',
          'Open the app',
          'Note: this is important.',
        ].join('\n'),
      );
      expect(spoken).not.toContain('#');
      expect(spoken).not.toContain('**');
      expect(spoken).not.toContain('https://');
    });

    it('handles a document that uses every construct at once', () => {
      const markdown = [
        '# Title',
        '',
        '> quote with **bold** and `code`',
        '',
        '- item with [link](https://example.com)',
        '- item with ![img](https://example.com/i.png)',
        '',
        '| a | b |',
        '| --- | --- |',
        '| $1 | $x$ |',
        '',
        '```js',
        'ignored();',
        '```',
        '',
        '---',
        '',
        'Tail[^1] text.',
        '',
        '[^1]: Footnote.',
      ].join('\n');

      const spoken = stripMarkdownForSpeech(markdown);

      expect(spoken).toContain('Title');
      expect(spoken).toContain('quote with bold and code');
      expect(spoken).toContain('item with link');
      expect(spoken).toContain('a, b');
      expect(spoken).toContain('$1');
      expect(spoken).toContain('Tail text.');
      expect(spoken).toContain('Footnote.');
      expect(spoken).not.toContain('ignored');
      expect(spoken).not.toContain('https://');
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Fallback safety net                                                         */
/* -------------------------------------------------------------------------- */

// The parser-outage half of the safety net lives in
// `strip-markdown-fallback.test.ts`, where the `remark` mock can be hoisted.
describe('stripMarkdownForSpeech failure fallback', () => {
  afterEach(() => {
    vi.doUnmock('../preprocess-latex');
    vi.resetModules();
  });

  it('falls back when the pre-pass throws', async () => {
    vi.resetModules();
    vi.doMock('../preprocess-latex', () => ({
      preprocessLaTeX: () => {
        throw new Error('boom');
      },
    }));

    const { stripMarkdownForSpeech: strip } = await import('../strip-markdown');

    // A fenced block is the tell: the real walk drops it entirely, so text
    // coming back out proves the fallback produced this and the mock took.
    expect(strip('```\nsecret code\n```')).toBe('secret code');
    expect(strip('## Foo\n\n\nbar   baz')).toBe('Foo\nbar baz');
  });
});
