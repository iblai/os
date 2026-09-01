import { describe, it, expect } from 'vitest';
import { normalizeListIndentation } from '@/lib/normalize-list-indentation';

describe('normalizeListIndentation', () => {
  it('returns empty string for non-string input and passes empty through', () => {
    expect(normalizeListIndentation(null as unknown as string)).toBe('');
    expect(normalizeListIndentation(undefined as unknown as string)).toBe('');
    expect(normalizeListIndentation('')).toBe('');
  });

  it('re-indents a 2-space bullet under an ordered item to the marker width (issue #2109)', () => {
    expect(normalizeListIndentation('1. Item\n  - sub\n2. Next')).toBe(
      '1. Item\n   - sub\n2. Next',
    );
  });

  it('re-indents a 2-space ordered child that CommonMark would flatten (issue #2109)', () => {
    expect(normalizeListIndentation('2. Second\n  1. sub\n3. Third')).toBe(
      '2. Second\n   1. sub\n3. Third',
    );
  });

  it('does not touch a 2-space bullet under an unordered item (valid nesting)', () => {
    const input = '- Item\n  - sub\n- Next';
    expect(normalizeListIndentation(input)).toBe(input);
  });

  it('does not touch an already correctly indented ordered child', () => {
    const input = '1. Item\n   - sub\n2. Next';
    expect(normalizeListIndentation(input)).toBe(input);
  });

  it('handles multi-level mixed ordered/unordered nesting', () => {
    const input = ['1. a', '  1. b', '    - c', '  2. d', '2. e'].join('\n');
    expect(normalizeListIndentation(input)).toBe(
      ['1. a', '   1. b', '      - c', '   2. d', '2. e'].join('\n'),
    );
  });

  it('accounts for wide ordered markers when computing the content column', () => {
    expect(normalizeListIndentation('10. Item\n   - sub')).toBe(
      '10. Item\n    - sub',
    );
    expect(normalizeListIndentation('10. Item\n    - sub')).toBe(
      '10. Item\n    - sub',
    );
  });

  it('supports paren-delimited ordered markers', () => {
    expect(normalizeListIndentation('1) Item\n  - sub')).toBe(
      '1) Item\n   - sub',
    );
  });

  it('keeps blank-separated siblings in the same list frame', () => {
    expect(normalizeListIndentation('1. a\n  - s1\n\n  - s2\n2. b')).toBe(
      '1. a\n   - s1\n\n   - s2\n2. b',
    );
  });

  it('shifts indented continuation lines along with their re-indented item', () => {
    expect(normalizeListIndentation('1. Item\n  - sub\n    wrapped text')).toBe(
      '1. Item\n   - sub\n     wrapped text',
    );
  });

  it('closes lists at a flush-left paragraph after a blank line', () => {
    const input = '1. a\n\nparagraph\n  - fresh list';
    expect(normalizeListIndentation(input)).toBe(input);
  });

  it('treats a lazy continuation as still inside the item', () => {
    expect(normalizeListIndentation('1. a\nlazy line\n  - sub')).toBe(
      '1. a\nlazy line\n   - sub',
    );
  });

  it('leaves fenced code bodies untouched', () => {
    const input = [
      '1. Item',
      '',
      '```text',
      '1. not a list',
      '  - not a sub',
      '```',
      '2. Next',
    ].join('\n');
    expect(normalizeListIndentation(input)).toBe(input);
  });

  it('leaves tilde-fenced code bodies untouched', () => {
    const input = ['1. Item', '~~~\n  - code\n~~~', '2. Next'].join('\n');
    expect(normalizeListIndentation(input)).toBe(input);
  });

  it('leaves an unclosed streaming fence untouched', () => {
    const input = ['1. Item', '```python', '  - partial code'].join('\n');
    expect(normalizeListIndentation(input)).toBe(input);
  });

  it('leaves inline code spans untouched', () => {
    const input = '1. Item with `  - code` span\n  - real sub';
    expect(normalizeListIndentation(input)).toBe(
      '1. Item with `  - code` span\n   - real sub',
    );
  });

  it('leaves block math lines that look like bullets untouched', () => {
    const input = ['1. Solve:', '$$', '- x + y = 3', '$$', '2. Next'].join(
      '\n',
    );
    expect(normalizeListIndentation(input)).toBe(input);
  });

  it('handles a streaming partial where the sub-item arrives mid-line', () => {
    expect(normalizeListIndentation('1. Item\n  - par')).toBe(
      '1. Item\n   - par',
    );
    expect(normalizeListIndentation('1. Item\n  ')).toBe('1. Item\n  ');
  });

  it('leaves flat lists and prose byte-for-byte identical', () => {
    const input = [
      '# Title',
      '',
      'Some prose.',
      '',
      '1. one',
      '2. two',
      '3. three',
      '',
      '- a',
      '- b',
    ].join('\n');
    expect(normalizeListIndentation(input)).toBe(input);
  });
});
