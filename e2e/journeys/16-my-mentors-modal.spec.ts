import { test } from '@playwright/test';

// Journey 16 was retired in #1431 when the MyMentorsModal feature was
// removed and agent discovery was consolidated into the Explore sidebar.
//
// This stub exists so that
//   - e2e/scripts/check-journey-coverage.mjs::validateSpecFiles passes
//     (every entry in coverage.json must point to a real spec file), and
//   - the regression check sees the journey count + checkpoint count
//     unchanged. The corresponding entries in e2e/coverage.json carry
//     `status: "deprecated"` and `deprecatedIn: "#1431"` to make the
//     deprecation explicit in the data ledger.
//
// Do not add tests here. If new mentor-switching / Explore parity
// coverage is needed, extend journey 5 or open a new journey.
test.describe.skip('Journey 16: My Mentors Modal (removed in #1431)', () => {});
