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
