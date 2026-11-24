import { test } from '@playwright/test';

// Journey 77 (Mentor Tools Tab) was retired in #2838 when the Tools tab was
// removed. What an agent can do is now a set of capability switches (Settings
// > Capabilities, Grader, Support and Screen tabs), covered by journey 107.
//
// This stub exists so that
//   - e2e/scripts/check-journey-coverage.mjs::validateSpecFiles passes
//     (every entry in coverage.json must point to a real spec file), and
//   - the regression check sees the journey count + checkpoint count
//     unchanged. The entries in e2e/coverage.json carry
//     `status: "deprecated"` and `deprecatedIn: "#2838"`.
//
// Do not add tests here.
test.describe.skip('Journey 77: Mentor Tools Tab (removed in #2838)', () => {});
