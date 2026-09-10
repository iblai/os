import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Link } from 'mdast';

import { remarkTrimAutolinkHost } from '../remark-trim-autolink-host';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkTrimAutolinkHost);

function parse(md: string): Root {
  return processor.runSync(processor.parse(md)) as Root;
}

function links(md: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  const walk = (node: { type: string; children?: unknown[] }): void => {
    if (node.type === 'link') {
      const link = node as unknown as Link;
      out.push({
        href: link.url,
        text: link.children
          .map((c) => (c.type === 'text' ? c.value : ''))
          .join(''),
      });
    }
    for (const child of (node.children ?? []) as Array<{
      type: string;
      children?: unknown[];
    }>) {
      walk(child);
    }
  };
  walk(parse(md) as unknown as { type: string; children?: unknown[] });
  return out;
}

function textOf(md: string): string {
  const parts: string[] = [];
  const walk = (node: {
    type: string;
    value?: string;
    children?: unknown[];
  }) => {
    if (node.type === 'text') parts.push(node.value ?? '');
    for (const child of (node.children ?? []) as Array<{
      type: string;
      value?: string;
      children?: unknown[];
    }>) {
      walk(child);
    }
  };
  walk(parse(md) as unknown as { type: string; children?: unknown[] });
  return parts.join('');
}

describe('remarkTrimAutolinkHost', () => {
  describe('punctuation that cannot be in a host is trimmed', () => {
    // Each of these linked to a host that is not the one the reader sees.
    const cases: Array<[string, string]> = [
      ['Our site—www.google.com—has more.', 'http://www.google.com'],
      ['Visit www.google.com—it is great.', 'http://www.google.com'],
      ['Email—www.paypal.com—now.', 'http://www.paypal.com'],
      ['See “www.fordham.edu” for details.', 'http://www.fordham.edu'],
      ['Try https://example.com—right now.', 'https://example.com'],
      ['Go – www.example.org–then stop.', 'http://www.example.org'],
    ];

    for (const [md, href] of cases) {
      it(`links ${JSON.stringify(md)} to ${href}`, () => {
        expect(links(md)[0].href).toBe(href);
      });
    }

    it('keeps the host the reader sees as the host that is linked', () => {
      const [link] = links('Our site—www.google.com—has more.');
      expect(new URL(link.href).host).toBe('www.google.com');
      expect(link.text).toBe('www.google.com');
    });

    it('returns the trimmed punctuation to the prose rather than dropping it', () => {
      expect(textOf('Our site—www.google.com—has more.')).toBe(
        'Our site—www.google.com—has more.',
      );
    });
  });

  describe('legitimate links are left alone', () => {
    it('leaves a whitespace-separated autolink untouched', () => {
      expect(links('Our site www.google.com has more.')).toEqual([
        { href: 'http://www.google.com', text: 'www.google.com' },
      ]);
    });

    it('leaves punctuation in a path untouched', () => {
      expect(links('See https://example.com/a—b for more.')[0].href).toBe(
        'https://example.com/a—b',
      );
    });

    it('leaves a query string untouched', () => {
      expect(links('Try https://example.com/s?q=a—b now.')[0].href).toBe(
        'https://example.com/s?q=a—b',
      );
    });

    it('leaves an internationalised host untouched', () => {
      expect(links('Go to www.münchen.de today.')[0].href).toBe(
        'http://www.münchen.de',
      );
    });

    it('leaves a port untouched', () => {
      expect(links('Hit http://localhost:3000 now.')[0].href).toBe(
        'http://localhost:3000',
      );
    });

    it('does not touch an authored link whose label is not the URL', () => {
      expect(links('[click—here](https://example.com—x)')).toEqual([
        { href: 'https://example.com—x', text: 'click—here' },
      ]);
    });

    it('leaves an email autolink untouched', () => {
      // The local part legitimately holds `@`, which is not a host character;
      // trimming there produced mailto:test and dropped the domain.
      expect(links('Mail test@example.com today.')).toEqual([
        { href: 'mailto:test@example.com', text: 'test@example.com' },
      ]);
    });

    it('leaves an email wrapped in em dashes untouched', () => {
      expect(links('Reach us—test@example.com—today.')[0].href).toBe(
        'mailto:test@example.com',
      );
    });

    it('still trims GFM trailing punctuation the same way it always did', () => {
      expect(links('See www.google.com, then stop.')[0].href).toBe(
        'http://www.google.com',
      );
    });

    it('trims each of two autolinks in a paragraph independently', () => {
      // Realistic prose: GFM ends each autolink at whitespace, so both are
      // separate link nodes and both get trimmed.
      expect(
        links('Our site—www.one.com—and www.two.com—are both up.').map(
          (l) => l.href,
        ),
      ).toEqual(['http://www.one.com', 'http://www.two.com']);
    });

    it('leaves the trimmed remainder as prose rather than re-linking it', () => {
      // With no whitespace anywhere GFM produces ONE link spanning both hosts.
      // We keep the first and hand the rest back as text; it is not re-scanned,
      // because the autolink transform has already run. An unlinked URL is the
      // safe outcome -- the alternative was a link to a host the reader never
      // saw.
      const md = 'a—www.one.com—b—www.two.com—c';
      expect(links(md).map((l) => l.href)).toEqual(['http://www.one.com']);
      expect(textOf(md)).toBe(md);
    });
  });

  describe('degenerate input', () => {
    it('leaves a link alone when trimming would empty the host', () => {
      // Nothing resolvable would remain, so the node is better left as GFM
      // produced it than replaced by a link to nothing.
      const before = links('see http://—x now');
      expect(before.every((l) => l.href.length > 0)).toBe(true);
    });

    it('does not throw on a paragraph of bare punctuation', () => {
      expect(() => parse('— — —')).not.toThrow();
    });
  });
});
