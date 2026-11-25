import { test } from '@playwright/test';

/**
 * Journey 77 — Mentor Tools Tab (retired).
 *
 * The SDK removed `AgentToolsTab` in @iblai/iblai-js 3.0.0: a capability is no
 * longer switched on from one central Tools tab, but from a switch inside the
 * tab that uses it — Screen Share, Grader, LTI. There is no Tools tab left to
 * drive, so every checkpoint here is marked `deprecated` in `e2e/coverage.json`
 * rather than deleted, which keeps the coverage total honest about what was
 * once tested and why it stopped.
 *
 * The file stays because `check-journey-coverage.mjs` requires a spec to exist
 * for every journey it knows about. Delete both together if the journey is ever
 * dropped from coverage.json.
 */
test.describe.skip('Journey 77: Mentor Tools Tab (retired in iblai-js 3.0.0)', () => {
  test('the Tools tab no longer exists', () => {});
});
