Analyze recent code changes and sync the e2e test coverage. Follow these steps:

1. **Identify what changed**: Run `git diff main --name-only` (or `git diff HEAD~1 --name-only` if on main) to find modified files. Focus on files in `app/`, `components/`, `hooks/`, `lib/`, and `providers/` — these affect user-facing behavior.

2. **Run the coverage checker**: Execute `node e2e/scripts/check-journey-coverage.mjs --no-regress` to identify coverage gaps and regressions. Review its output carefully.

3. **Read COVERAGE.md and coverage.json**: Read `e2e/COVERAGE.md` and `e2e/coverage.json` to understand existing journey coverage and checkpoint counts.

4. **Analyze each change**: For each modified source file, determine:

   - Does it belong to an existing journey? (Check the `sourceFiles` arrays in coverage.json)
   - Does the change add new user-visible behavior that needs new checkpoints?
   - Does the change introduce a completely new feature that needs a new journey?
   - Did any locators, labels, or flows change that would break existing tests?

5. **Write or update tests**: For each gap found:

   - Create new journey spec files in `e2e/journeys/` following existing patterns
   - Add new checkpoints to existing journeys if the change extends a feature
   - Update existing test locators if UI elements changed
   - Use page objects from `e2e/page-objects/` when available
   - Use `navigateToMentorApp` and `checkAdminStatus` from `e2e/utils/auth`

6. **Update coverage artifacts**: Keep ALL THREE in sync:

   - `e2e/coverage.json` — structured data (sourceFiles, checkpoints, summary stats)
   - `e2e/COVERAGE.md` — human-readable checklist (header stats, journey sections)
   - Spec files in `e2e/journeys/` — actual test implementations

7. **Verify tests**: Use the `/healer` skill to verify the new/updated tests actually pass. Mark tests as `test.fixme()` with a descriptive comment if they fail due to app-level issues (not test bugs).

8. **Run the coverage checker again**: Execute `node e2e/scripts/check-journey-coverage.mjs --no-regress` to confirm all gaps are resolved and no regressions were introduced.

9. **Report**: Summarize what was added/changed:
   - New journeys created
   - New checkpoints added to existing journeys
   - Updated checkpoints (locator fixes, flow changes)
   - Tests marked as fixme (with reasons)
   - Coverage stats: before → after (checkpoints, journeys)
