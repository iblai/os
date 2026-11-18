import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const VENDORED = 'extensions/chrome/public/vendor/agent-ai.umd.js';
const E2E_COPY = 'e2e/fixtures/agent-ai.umd.js';

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
  it('honours hostownschooser, so the panel owns the chooser', () => {
    expect(
      bundle.includes('hostownschooser'),
      'the vendored agent-ai has no `hostownschooser`: it predates ' +
        'iblai-web-frontend#2257, and the panel would get the embed’s chooser too',
    ).toBe(true);
  });

  // `watchTenantSwitch` listens for this. Without it "Organizations" does
  // nothing at all.
  it('posts tenantSwitch, which is how the picker is raised', () => {
    expect(bundle.includes('tenantSwitch')).toBe(true);
  });

  // The embed authorises against the host's session rather than redirecting,
  // which is the whole basis of the panel's auth.
  it('supports authrelyonhost', () => {
    expect(bundle.includes('authrelyonhost')).toBe(true);
  });
});
