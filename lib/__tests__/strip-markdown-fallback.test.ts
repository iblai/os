/**
 * The parser-outage safety net, in its own file so the `remark` mock can be
 * hoisted. A `vi.doMock` inside the main suite is order-dependent once other
 * files share the worker's module cache, and a fallback that silently stops
 * being exercised is worse than no test at all.
 */
import { describe, it, expect, vi } from 'vitest';

// `vi.hoisted` so the spy exists before the hoisted `vi.mock` factory runs.
const { parse } = vi.hoisted(() => ({
  parse: vi.fn(() => {
    throw new Error('parser exploded');
  }),
}));

vi.mock('remark', () => {
  const processor = { use: () => processor, parse };
  return { remark: () => processor };
});

import { stripMarkdownForSpeech } from '../strip-markdown';

describe('stripMarkdownForSpeech when the parser throws', () => {
  it('falls back instead of propagating the error', () => {
    expect(() => stripMarkdownForSpeech('## Foo')).not.toThrow();
    expect(parse).toHaveBeenCalled();
  });

  it('degrades to a sigil-stripped rendition of the raw input', () => {
    // A fenced block is the tell: the real walk drops it entirely, so text
    // coming back out proves the fallback -- not the parser -- produced this.
    expect(stripMarkdownForSpeech('```\nsecret code\n```')).toBe('secret code');
  });

  it('still removes the syntax it can see without a parse tree', () => {
    expect(stripMarkdownForSpeech('## Foo\n\n**bar**   `baz`')).toBe(
      'Foo\nbar baz',
    );
    expect(stripMarkdownForSpeech('# A\n\n\n\n~~b~~')).toBe('A\nb');
  });

  it('still returns an empty string for blank input', () => {
    expect(stripMarkdownForSpeech('   \n  ')).toBe('');
    expect(stripMarkdownForSpeech('')).toBe('');
  });

  it('still returns an empty string for a non-string input', () => {
    expect(stripMarkdownForSpeech(null as unknown as string)).toBe('');
  });
});
