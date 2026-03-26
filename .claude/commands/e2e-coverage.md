Analyze recent code changes and sync the e2e test coverage. Follow these steps:

1. **Identify what changed**: Run `git diff main --name-only` (or `git diff HEAD~1 --name-only` if on main) to find modified files. Focus on files in `app/`, `components/`, `hooks/`, `lib/`, and `providers/` — these affect user-facing behavior.

2. **Read COVERAGE.md**: Read `e2e/COVERAGE.md` to understand existing journey coverage and checkpoint counts.

3. **Analyze each change**: For each modified source file, determine:
   - Does it belong to an existing journey? (Check the `**Source files:**` lines in COVERAGE.md)
   - Does the change add new user-visible behavior that needs new checkpoints?
   - Does the change introduce a completely new feature that needs a new journey?
   - Did any locators, labels, or flows change that would break existing tests?

4. **Write or update tests**: For each gap found:
   - Create new journey spec files in `e2e/journeys/` following existing patterns
   - Add new checkpoints to existing journeys if the change extends a feature
   - Update existing test locators if UI elements changed
   - Create helper utilities in `e2e/utils/` for reusable test functions
   - Use page objects from `e2e/page-objects/` when available

5. **Update COVERAGE.md**: Add/update journey sections, checkpoint lists, source file references, and header stats (total checkpoints, total journeys).

6. **Verify tests**: Use the `/healer` skill to verify the new/updated tests actually pass. Mark tests as `test.fixme()` with a descriptive comment if they fail due to app-level issues (not test bugs).

7. **Report**: Summarize what was added/changed:
   - New journeys created
   - New checkpoints added to existing journeys
   - Updated checkpoints (locator fixes, flow changes)
   - Tests marked as fixme (with reasons)
