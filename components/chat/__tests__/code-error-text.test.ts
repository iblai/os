import { describe, it, expect } from 'vitest';
import { plainCodeError } from '../code-error-text';

/**
 * The raw strings Rust and the SDK surface for a failed Code turn, and the
 * plain-words key each one becomes. Anything already a sentence stays raw.
 */
describe('plainCodeError', () => {
  it.each([
    ['opencode error on session/prompt: {"code":-32603}', 'stopped'],
    ['opencode closed before responding', 'stopped'],
    ['failed writing to opencode', 'stopped'],
    ['no user message to send to opencode', 'stopped'],
    ['Codex did not answer within 30s.', 'noAnswer'],
    ['turn timed out', 'noAnswer'],
    ['no model selected for Code', 'noModel'],
    [
      'failed to launch the sandboxed `opencode acp` (is bubblewrap (bwrap) installed?): ENOENT',
      'couldNotStart',
    ],
    ['session/new returned no sessionId', 'couldNotStart'],
    ['ibl.ai guidance anchor missing for codex: "x"', 'couldNotStart'],
    ['Not signed in — missing tenant or token for Coding Mode.', 'signedOut'],
  ])('reads %j as %s', (raw, key) => {
    expect(plainCodeError(raw)).toBe(key);
  });

  it('looks past the SDK’s "opencode failed:" wrapper', () => {
    expect(
      plainCodeError('opencode failed: failed to launch the codex agent: boom'),
    ).toBe('couldNotStart');
  });

  it.each([
    'Codex isn’t installed — install it from the Code menu.',
    'Claude Code rejected the model gpt-x: unknown — pick another one in the top-left.',
    'Coding Mode needs the desktop app, or a phone paired with one.',
    'Something else entirely',
  ])('leaves a sentence alone: %s', (raw) => {
    expect(plainCodeError(raw)).toBeNull();
  });
});
