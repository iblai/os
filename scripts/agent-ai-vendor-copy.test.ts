import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VENDORED = 'extensions/chrome/public/vendor/agent-ai.umd.js';
const E2E_COPY = 'e2e/fixtures/agent-ai.umd.js';

/**
 * Which release the committed bytes are, and their hash.
 *
 * The bundle is minified and carries no version of its own, so without this the
 * only record is prose in the README — which is exactly how the extension came
 * to run a branch build for two weeks with nothing noticing. Re-vendoring means
 * updating both, deliberately:
 *
 *   npm pack @iblai/agent-ai@<version>     # or: pnpm --filter @iblai/agent-ai build
 *   shasum -a 256 <dist/index.umd.js>
 */
const VENDORED_VERSION = '2.15.1';
const VENDORED_SHA256 =
  '2392e163366a70c884a62ade42d028e96d8bc712d3fd034039980a7575536382';

describe('e2e copy of the vendored agent-ai launcher', () => {
  it('is byte-identical to the extension vendor file', () => {
    const same = readFileSync(VENDORED).equals(readFileSync(E2E_COPY));
    expect(
      same,
      `${E2E_COPY} differs from ${VENDORED}; run: cp ${VENDORED} ${E2E_COPY}`,
    ).toBe(true);
  });
});

/**
 * The panel depends on behaviour that is only in the bundle — there is no type
 * to break and no import to fail, so a bundle built without it installs
 * silently and the panel stops working.
 *
 * That is not hypothetical: from 5 November the vendored file was built from an
 * unmerged branch, and the published package did NOT have `hostownschooser`.
 * Re-vendoring from npm would have replaced a working bundle with one that
 * tears the chat out of the panel, and nothing here would have said so. The
 * behaviour reached main in iblai-web-frontend#2257.
 */
describe('what the panel needs from the vendored bundle', () => {
  const bundle = readFileSync(VENDORED, 'utf8');

  // `mentor-chat.tsx` sets this attribute. Without it the embed opens its own
  // chooser window as well as handing the request to the panel, and navigates
  // the iframe out from under the chat.
  // Both halves: the attribute a minifier emits for any accessor, and the
  // branch that actually defers. A bundle can declare the attribute and still
  // have lost the behaviour, which would leave the panel with two choosers and
  // its iframe navigated away.
  it('honours hostownschooser, so the panel owns the chooser', () => {
    expect(
      bundle.includes('hostownschooser'),
      'the vendored agent-ai has no `hostownschooser`: it predates ' +
        'iblai-web-frontend#2257, and the panel would get the embed’s chooser too',
    ).toBe(true);
    expect(
      bundle.includes('defer-to-host'),
      'the vendored agent-ai declares `hostownschooser` but has no ' +
        '`defer-to-host` branch: the embed would open its own chooser anyway',
    ).toBe(true);
  });

  // The embed authorises against the host's session rather than redirecting,
  // which is the whole basis of the panel's auth. `authrelyonhost` alone is
  // just the attribute accessor a minifier emits for any attribute, so pin the
  // relay it gates too.
  it('supports authrelyonhost, and the relay behind it', () => {
    expect(bundle.includes('authrelyonhost')).toBe(true);
    expect(
      bundle.includes('relayauthmessage'),
      'the vendored agent-ai declares `authrelyonhost` but has no auth relay: ' +
        'the panel hands it a session it would ignore',
    ).toBe(true);
  });

  // `mentor-frame.ts` reaches into the bundle's shadow DOM by these ids —
  // `mentorIframe()` and the spinner removal. Rename either upstream and
  // `installSession()` returns false forever, silently: the chat never routes
  // and nothing here would have said why.
  it('keeps the shadow-DOM ids the panel reaches for', () => {
    expect(
      bundle.includes('ibl-chat-widget-container'),
      'the vendored agent-ai renamed its chat container: `mentorIframe()` ' +
        'finds nothing and the panel can never install a session',
    ).toBe(true);
    expect(
      bundle.includes('refresh-instruction'),
      'the vendored agent-ai renamed its refresh element: the panel cannot ' +
        'remove the widget spinner that sits over the chat',
    ).toBe(true);
  });

  // The one bundle-only behaviour that HAS regressed in production: downloads
  // from the chat silently did nothing until the iframe sandbox was given
  // `allow-downloads` (iblai-platform#2680, vendored in 04a6cfb2). Only the
  // live-backend journey would notice it going again.
  it('keeps allow-downloads in the iframe sandbox', () => {
    expect(
      bundle.includes('allow-downloads'),
      'the vendored agent-ai has no `allow-downloads`: downloads from the ' +
        'chat will silently do nothing (iblai-platform#2680)',
    ).toBe(true);
  });

  // Ties the bytes to a release. The README's version line is prose and cannot
  // fail; this does, and names what to do about it.
  it('is the release it says it is', () => {
    const sha = createHash('sha256')
      .update(readFileSync(VENDORED))
      .digest('hex');
    expect(
      sha,
      `the vendored bundle is not @iblai/agent-ai@${VENDORED_VERSION}. ` +
        'If you re-vendored, update VENDORED_VERSION and VENDORED_SHA256 ' +
        'here and the version line in extensions/chrome/README.md.',
    ).toBe(VENDORED_SHA256);
  });
});
