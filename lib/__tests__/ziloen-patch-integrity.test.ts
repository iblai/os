/**
 * The markdown stack depends on a patched copy of @ziloen/remark-math. The
 * patch is the only thing standing between us and two classes of production
 * failure, and pnpm applies it by content hash — a bumped version, a bad merge
 * of the patch file, or a `pnpm install` that silently resolves the unpatched
 * copy would all remove it with no other signal.
 *
 * These assertions read the module the app actually resolves, so they fail if
 * the patch stops being applied for any reason.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const source = readFileSync(
  createRequire(import.meta.url).resolve('@ziloen/remark-math'),
  'utf8',
);

describe('@ziloen/remark-math patch integrity', () => {
  describe('crash guards (Sentry: "Cannot read properties of undefined (reading \'start\')")', () => {
    it('does not read first.position.start unguarded in splitParagraph', () => {
      // The exact expression that took the chat page down in 0.141.0.
      expect(source).not.toContain('start: first.position.start');
      expect(source).toContain('first?.position?.start');
    });

    it('does not merge two text positions unguarded in processHtmlChildren', () => {
      expect(source).not.toMatch(
        /^\t*previous\.position\.end = next\.position\.end;$/m,
      );
      expect(source).toContain('previous.position && next.position');
    });
  });

  describe('tokenizer rules (issue #2441)', () => {
    it('keeps the whitespace-before-closer rule so currency cannot open a span', () => {
      expect(source).toContain('afterWhitespace');
    });

    it('keeps the no-span-across-a-line-ending rule', () => {
      expect(source).toContain(
        'if (markdownLineEnding(code)) return nok(code);',
      );
    });

    it('keeps the backslash-only escape check for a preceding dollar', () => {
      expect(source).toContain('if (code !== codes.backslash) return true;');
    });
  });
});
