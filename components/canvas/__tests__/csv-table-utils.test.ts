import { describe, it, expect } from 'vitest';
import {
  getDelimitedFileDelimiter,
  isDelimitedFileExtension,
  resolveDelimitedFileExtension,
  parseDelimitedText,
  isGfmTable,
  delimitedTextToMarkdownTable,
  markdownTableToDelimitedText,
  editorHtmlToDelimitedText,
} from '../csv-table-utils';
import { markdownToHtml } from '@/lib/utils';

const LEADS_CSV = [
  'lead_id,first_name,profile_url,signal_summary',
  'linkedin:neel,Neel,https://www.linkedin.com/in/neel-khatri,"Just passed AWS SA – Associate. Posted today: ""I did it!"""',
  'linkedin:devesh,Devesh,https://www.linkedin.com/in/devesh-sahoo,"Terraform background, upskilling into cloud"',
].join('\n');

/** A rendered cell: literal text wrapped in <samp>. */
const cell = (text: string) => `<samp>${text}</samp>`;

describe('csv-table-utils', () => {
  describe('getDelimitedFileDelimiter / isDelimitedFileExtension', () => {
    it('maps csv and tsv (any case, with or without a dot) to their delimiters', () => {
      expect(getDelimitedFileDelimiter('csv')).toBe(',');
      expect(getDelimitedFileDelimiter('.CSV')).toBe(',');
      expect(getDelimitedFileDelimiter('tsv')).toBe('\t');
      expect(isDelimitedFileExtension('csv')).toBe(true);
    });

    it('leaves every other extension alone', () => {
      expect(getDelimitedFileDelimiter('md')).toBeUndefined();
      expect(getDelimitedFileDelimiter('txt')).toBeUndefined();
      expect(getDelimitedFileDelimiter(undefined)).toBeUndefined();
      expect(isDelimitedFileExtension('py')).toBe(false);
    });
  });

  describe('resolveDelimitedFileExtension', () => {
    it('uses an explicit csv/tsv extension', () => {
      expect(resolveDelimitedFileExtension('csv', 'anything')).toBe('csv');
      expect(resolveDelimitedFileExtension('TSV', undefined)).toBe('tsv');
    });

    it('falls back to a filename-style title when the extension is missing or the txt placeholder', () => {
      expect(resolveDelimitedFileExtension(undefined, 'leads_2026.csv')).toBe(
        'csv',
      );
      expect(resolveDelimitedFileExtension('txt', 'Leads.CSV')).toBe('csv');
      expect(resolveDelimitedFileExtension('', 'data.tsv')).toBe('tsv');
    });

    it('never overrides a real non-placeholder extension from the title', () => {
      expect(resolveDelimitedFileExtension('md', 'notes.csv')).toBeUndefined();
    });

    it('is undefined for plain text files', () => {
      expect(resolveDelimitedFileExtension('txt', 'hello.txt')).toBeUndefined();
      expect(
        resolveDelimitedFileExtension(undefined, 'Report'),
      ).toBeUndefined();
    });
  });

  describe('parseDelimitedText', () => {
    it('splits rows and fields', () => {
      expect(parseDelimitedText('a,b,c\n1,2,3', ',')).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ]);
    });

    it('honors quoted fields with delimiters, doubled quotes and newlines', () => {
      expect(
        parseDelimitedText(
          'name,note\n"Doe, Jane","said ""hi""\nand left"',
          ',',
        ),
      ).toEqual([
        ['name', 'note'],
        ['Doe, Jane', 'said "hi"\nand left'],
      ]);
    });

    it('accepts CRLF endings, a trailing newline, and drops blank lines', () => {
      expect(parseDelimitedText('a,b\r\n1,2\r\n\r\n3,4\n', ',')).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('parses tab-separated text', () => {
      expect(parseDelimitedText('a\tb\n1\t2', '\t')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });
  });

  describe('isGfmTable', () => {
    it('recognizes a header row followed by a separator row', () => {
      expect(isGfmTable('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe(true);
      expect(isGfmTable('| a | b |\n|:--|--:|')).toBe(true);
    });

    it('rejects prose and raw csv', () => {
      expect(isGfmTable('a,b\n1,2')).toBe(false);
      expect(isGfmTable('| a | b |')).toBe(false);
      expect(isGfmTable('| a | b |\n| 1 | 2 |')).toBe(false);
    });
  });

  describe('delimitedTextToMarkdownTable', () => {
    it('renders csv as a GFM table with the first row as the header and literal cells', () => {
      expect(delimitedTextToMarkdownTable('a,b\n1,2', 'csv')).toBe(
        `| ${cell('a')} | ${cell('b')} |\n| --- | --- |\n| ${cell('1')} | ${cell('2')} |`,
      );
    });

    it('escapes pipes, flattens embedded newlines, pads ragged rows and leaves empty cells empty', () => {
      expect(
        delimitedTextToMarkdownTable('a,b,c\n"x|y","line1\nline2"', 'csv'),
      ).toBe(
        `| ${cell('a')} | ${cell('b')} | ${cell('c')} |\n| --- | --- | --- |\n| ${cell('x\\|y')} | ${cell('line1 line2')} |  |`,
      );
    });

    it('widens the header when a body row is longer', () => {
      expect(delimitedTextToMarkdownTable('a\n1,2', 'csv')).toBe(
        `| ${cell('a')} |  |\n| --- | --- |\n| ${cell('1')} | ${cell('2')} |`,
      );
    });

    it('escapes inline markdown so cell data is shown literally', () => {
      expect(
        delimitedTextToMarkdownTable(
          'v\n*x* _y_ `z` <b>w</b> $1 a&amp;b x_1 ~s~',
          'csv',
        ),
      ).toBe(
        `| ${cell('v')} |\n| --- |\n| ${cell('\\*x\\* \\_y\\_ \\`z\\` \\<b\\>w\\</b\\> \\$1 a\\&amp;b x\\_1 \\~s\\~')} |`,
      );
    });

    it('keeps bare URLs unescaped so they stay clickable', () => {
      expect(
        delimitedTextToMarkdownTable(
          'u\nsee https://x.test/a_b?q=1&r=2 now',
          'csv',
        ),
      ).toBe(
        `| ${cell('u')} |\n| --- |\n| ${cell('see https://x.test/a_b?q=1&r=2 now')} |`,
      );
    });

    it('renders tsv', () => {
      expect(delimitedTextToMarkdownTable('a\tb\n1\t2', 'tsv')).toBe(
        `| ${cell('a')} | ${cell('b')} |\n| --- | --- |\n| ${cell('1')} | ${cell('2')} |`,
      );
    });

    it('is idempotent: an already-converted table passes through unchanged', () => {
      const table = delimitedTextToMarkdownTable(LEADS_CSV, 'csv');
      expect(delimitedTextToMarkdownTable(table, 'csv')).toBe(table);
    });

    it('leaves non-delimited extensions and empty input untouched', () => {
      expect(delimitedTextToMarkdownTable('a,b\n1,2', 'md')).toBe('a,b\n1,2');
      expect(delimitedTextToMarkdownTable('a,b\n1,2', undefined)).toBe(
        'a,b\n1,2',
      );
      expect(delimitedTextToMarkdownTable('   ', 'csv')).toBe('   ');
    });
  });

  describe('markdownTableToDelimitedText', () => {
    it('turns table rows back into records and drops the separator row', () => {
      expect(
        markdownTableToDelimitedText(
          '| a | b |\n| --- | --- |\n| 1 | 2 |',
          'csv',
        ),
      ).toBe('a,b\n1,2');
    });

    it('round-trips our own generated table, escapes and all', () => {
      const csv =
        'v,u\n"*x* _y_ `z` <b>w</b> $1 a&amp;b, x|y",https://x.test/a_b?q=1';
      expect(
        markdownTableToDelimitedText(
          delimitedTextToMarkdownTable(csv, 'csv'),
          'csv',
        ),
      ).toBe(csv);
      expect(
        markdownTableToDelimitedText(
          delimitedTextToMarkdownTable(LEADS_CSV, 'csv'),
          'csv',
        ),
      ).toBe(LEADS_CSV);
    });

    it('quotes fields containing the delimiter or quotes, and unescapes \\|', () => {
      expect(
        markdownTableToDelimitedText(
          '| name | note |\n| --- | --- |\n| Doe, Jane | said "hi" x\\|y |',
          'csv',
        ),
      ).toBe('name,note\n"Doe, Jane","said ""hi"" x|y"');
    });

    it('reduces the escapes and links the editor serializer adds to plain cell text', () => {
      expect(
        markdownTableToDelimitedText(
          '| first\\_name | url |\n| --- | --- |\n| Neel | <https://x.test/a> |\n| Dev | [https://x.test/b](https://x.test/b) |\n| Sam | [Profile](https://x.test/c) |\n| Kim | <tel:5551234567> |',
          'csv',
        ),
      ).toBe(
        'first_name,url\nNeel,https://x.test/a\nDev,https://x.test/b\nSam,Profile\nKim,5551234567',
      );
    });

    it('keeps non-table lines as their own records and writes tsv', () => {
      expect(
        markdownTableToDelimitedText(
          'note\n\n| a | b |\n| --- | --- |\n| 1 | 2 |',
          'tsv',
        ),
      ).toBe('note\na\tb\n1\t2');
    });

    it('returns markdown unchanged for non-delimited extensions', () => {
      const md = '| a |\n| --- |\n| 1 |';
      expect(markdownTableToDelimitedText(md, 'md')).toBe(md);
    });
  });

  describe('editorHtmlToDelimitedText', () => {
    const TIPTAP_HTML =
      '<table><tbody>' +
      '<tr><th><p>run_id</p></th><th><p>note</p></th></tr>' +
      '<tr><td><p><a href="tel:202609081109">2026-09-08_1109</a></p></td><td><p>Doe, Jane</p><p>said "hi"</p></td></tr>' +
      '<tr><td><p>x<br>y</p></td><td><p></p></td></tr>' +
      '</tbody></table>';

    it('reads visible cell text from the editor DOM: links by their text, paragraphs and <br> as newlines', () => {
      expect(editorHtmlToDelimitedText(TIPTAP_HTML, 'csv')).toBe(
        'run_id,note\n2026-09-08_1109,"Doe, Jane\nsaid ""hi"""\n"x\ny",',
      );
    });

    it('keeps content outside the table as its own records', () => {
      expect(
        editorHtmlToDelimitedText(`<p>heading note</p>${TIPTAP_HTML}`, 'tsv'),
      ).toBe(
        'heading note\nrun_id\tnote\n2026-09-08_1109\t"Doe, Jane\nsaid ""hi"""\n"x\ny"\t',
      );
    });

    it('returns null without a table or for non-delimited extensions', () => {
      expect(editorHtmlToDelimitedText('<p>a,b</p>', 'csv')).toBeNull();
      expect(editorHtmlToDelimitedText(TIPTAP_HTML, 'md')).toBeNull();
    });
  });

  describe('through the real markdown pipeline', () => {
    it('renders a csv artifact as an HTML table, not a paragraph of comma-separated words', () => {
      const html = markdownToHtml(
        delimitedTextToMarkdownTable(LEADS_CSV, 'csv'),
      );
      expect(html).toMatch(/<table/);
      expect(html).toMatch(/<th[^>]*>\s*<samp>first_name<\/samp>\s*<\/th>/);
      expect(html).toMatch(/<td[^>]*>\s*<samp>Devesh<\/samp>\s*<\/td>/);
      expect(html).toContain('href="https://www.linkedin.com/in/neel-khatri"');
      expect(html).not.toMatch(/<p[^>]*>\s*lead_id,first_name/);
    });

    // Regression: `2026-09-08_1109` rendered as "2026-09-08" + subscript,
    // lost its underscore on save, was then linkified as a phone number, and
    // every subsequent save appended another "(tel:202609081109)".
    it('is stable across repeated render → save cycles: ids, phone numbers and URLs survive verbatim', () => {
      const csv = [
        'run_id,phone,profile_url,job_title',
        '2026-09-08_1109,+1 555-123-4567,https://www.linkedin.com/in/neel-khatri-20b9b2273,"SIH\'25 Finalist | Applied NLP, x_1 & *more*"',
      ].join('\n');
      let current = csv;
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const html = markdownToHtml(
          delimitedTextToMarkdownTable(current, 'csv'),
        );
        expect(html).not.toContain('<sub>');
        expect(html).not.toContain('tel:');
        expect(html).not.toContain('<em>');
        expect(html).toContain('2026-09-08_1109');
        const saved = editorHtmlToDelimitedText(html, 'csv');
        expect(saved).toBe(csv);
        current = saved ?? '';
      }
    });
  });
});
