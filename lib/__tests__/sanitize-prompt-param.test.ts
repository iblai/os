import { describe, it, expect } from 'vitest';
import { sanitizePromptParam } from '../utils';
import { MAX_PROMPT_PARAM_LENGTH } from '../constants';

describe('sanitizePromptParam', () => {
  it('leaves an XSS-ish payload unchanged', () => {
    // HTML escaping is intentionally NOT done here: the render layer
    // auto-escapes user turns (plain React text), so escaping would only
    // corrupt legitimate prompts without adding any safety.
    const payload = '<img src=x onerror=alert(1)>';
    expect(sanitizePromptParam(payload)).toBe(payload);
  });

  it('leaves a legitimate prompt intact', () => {
    expect(sanitizePromptParam('Explain recursion in Python')).toBe(
      'Explain recursion in Python',
    );
  });

  it('strips zero-width and invisible characters', () => {
    // U+200B zero-width space, U+200D zero-width joiner, U+FEFF BOM.
    const input = 'he​ll‍o﻿';
    expect(sanitizePromptParam(input)).toBe('hello');
  });

  it('strips a Unicode tag-block character (invisible-instruction injection)', () => {
    const input = 'safe\u{E0041}prompt';
    expect(sanitizePromptParam(input)).toBe('safeprompt');
  });

  it('strips bidirectional control chars (Trojan Source, CVE-2021-42574)', () => {
    // LRM, RLM, RLO (override), and the FSI/PDI isolates are all invisible and
    // can visually reorder text to hide the real injected instruction.
    const input = 'safe\u200E\u200F\u202E\u2066\u2069prompt';
    expect(sanitizePromptParam(input)).toBe('safeprompt');
  });

  it('strips control characters but preserves newlines and tabs', () => {
    const input = 'line1\x00\x1F\x7F\nline2\tend';
    expect(sanitizePromptParam(input)).toBe('line1\nline2\tend');
  });

  it('truncates oversized input to MAX_PROMPT_PARAM_LENGTH', () => {
    const input = 'a'.repeat(MAX_PROMPT_PARAM_LENGTH + 500);
    const result = sanitizePromptParam(input);
    expect(result).toHaveLength(MAX_PROMPT_PARAM_LENGTH);
  });

  it('re-trims after slicing so no trailing whitespace remains at the cap', () => {
    // Fill exactly to the cap with content, then whitespace right at the
    // boundary that the slice would otherwise leave dangling.
    const input = 'a'.repeat(MAX_PROMPT_PARAM_LENGTH - 1) + '   more';
    const result = sanitizePromptParam(input);
    expect(result).toBe('a'.repeat(MAX_PROMPT_PARAM_LENGTH - 1));
    expect(result?.endsWith(' ')).toBe(false);
  });

  it('returns undefined for null', () => {
    expect(sanitizePromptParam(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(sanitizePromptParam(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(sanitizePromptParam('')).toBeUndefined();
  });

  it('returns undefined for a whitespace-only string', () => {
    expect(sanitizePromptParam('   \t\n  ')).toBeUndefined();
  });

  it('returns undefined when the value is empty after stripping', () => {
    expect(sanitizePromptParam('​‍﻿')).toBeUndefined();
  });
});
