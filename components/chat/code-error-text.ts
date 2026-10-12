/**
 * Plain-words keys (`chatCodeErrors.*`) for the Code errors the Rust side and
 * the SDK surface as raw strings. Only the developer-shaped ones are mapped; a
 * string that is already a sentence (install, sign-in, a refused model) shows
 * as it is. First match wins.
 */
const PLAIN_CODE_ERRORS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /^opencode error on |opencode closed before responding|failed writing to opencode|no user message to send/,
    'stopped',
  ],
  [/did not answer within \d+s|turn timed out/, 'noAnswer'],
  [/no model selected for Code/, 'noModel'],
  [
    /^failed to launch|returned no sessionId|ibl\.ai guidance anchor missing/,
    'couldNotStart',
  ],
  [/Not signed in .*missing tenant or token/, 'signedOut'],
];

export function plainCodeError(raw: string): string | null {
  const text = raw.replace(/^opencode failed: /, '');
  const hit = PLAIN_CODE_ERRORS.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : null;
}
