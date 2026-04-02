---
description: Automatically keep e2e test coverage in sync with code changes. Triggers when features are added, bugs are fixed, or UI components are modified. Ensures coverage never regresses.
---

# E2E Coverage Sync Skill

You are responsible for keeping the e2e test coverage in sync with code changes. After making any code change that affects user-facing behavior, you MUST evaluate whether the change requires updates to the e2e test suite.

## When This Applies

This skill applies whenever you:

- Add a new feature or page
- Fix a bug that changes user-visible behavior
- Modify a UI component's behavior, layout, or accessibility
- Add/remove/rename routes or navigation paths
- Change form fields, buttons, modals, or interactive elements

## Decision Process

After completing a code change, evaluate:

### 1. Does this need a NEW journey?

Create a new journey (`e2e/journeys/XX-name.spec.ts`) if:

- A completely new feature/page was added (e.g., Workflows, Reports)
- The feature has its own URL route or major UI section
- It requires 3+ test checkpoints

### 2. Does this need NEW checkpoints in an EXISTING journey?

Add checkpoints to an existing journey if:

- A new button, toggle, or interaction was added to an existing feature
- A new tab or section was added to an existing modal/page
- New validation or error handling was added

### 3. Does this need UPDATED checkpoints?

Update existing checkpoints if:

- A locator changed (button text, aria-label, role)
- The user flow changed (different steps, different order)
- A feature was removed (remove the checkpoint AND add a replacement if behavior was relocated)

### 4. No e2e changes needed if:

- The change is purely internal (refactoring, performance, types)
- The change is in test infrastructure only
- The change is cosmetic with no behavior change (colors, spacing)

## Coverage Regression Prevention

**CRITICAL: Coverage must NEVER decrease.** This is enforced at two levels:

1. **Pre-push hook**: `node e2e/scripts/check-journey-coverage.mjs --no-regress` runs automatically and blocks pushes if:

   - Checkpoint count decreased vs origin/main
   - Journey count decreased
   - New page.tsx routes lack journey coverage in coverage.json

2. **CI workflow**: The `e2e-coverage-check` job in spa-pr-validation.yml runs the same script with `--all --no-regress` and blocks merge on failure. Additionally, `claude-review-coverage` uses Claude to analyze whether changed files need new/updated journeys.

If you remove a checkpoint, you MUST either:

- Replace it with an equivalent checkpoint for the new behavior
- Document why the checkpoint is no longer needed (the feature was removed entirely)

## Actions Required

When e2e changes ARE needed:

1. **Write/update the spec file** in `e2e/journeys/` following the existing patterns:

   - Use `test` and `expect` from `../fixtures/mentor-test`
   - Use `navigateToMentorApp`, `checkAdminStatus` from `../utils/auth`
   - Use page objects from `../page-objects/` when available
   - Test names follow: `"admin/user goes to [page] and [action] [expected result]"`
   - Add `test.fixme()` with a comment if the test can't pass due to app-level issues
   - Each test should clean up after itself

2. **Create helpers** in `e2e/utils/` if the journey needs reusable functions

3. **Update `e2e/COVERAGE.md`**:

   - Add/update the journey section with all checkpoints
   - Update the header stats (checkpoint count, journey count, percent)
   - Keep checkpoints marked `[x]` when the test exists and passes
   - List relevant source files in the `**Source files:**` line

4. **Update `e2e/coverage.json`**:

   - Add the journey entry with id, name, spec, sourceFiles, and checkpoints
   - Update the summary stats (totalCheckpoints, coveredCheckpoints, percent, totalJourneys)
   - Ensure every source file in the journey is listed in the sourceFiles array

5. **Verify tests pass**: After writing tests, use the `/healer` skill to verify they actually pass. Mark tests as `test.fixme()` with a descriptive comment if they fail due to app-level issues (not test code bugs).

## Syncing Non-Journey Tests

Tests in `e2e/tests/` (outside `e2e/journeys/`) must be migrated into the journey structure:

- Determine which journey they belong to (or create a new one)
- Move the spec file to `e2e/journeys/` with proper naming
- Update coverage.json and COVERAGE.md
- Remove the old file from `e2e/tests/`

## Journey Naming Convention

- File: `e2e/journeys/{NN}-{kebab-case-name}.spec.ts`
- Number sequentially after the last journey
- Describe block: `"Journey {NN}: {Title Case Name}"`

## COVERAGE.md Format

```markdown
## Journey {NN}: {Title} ({N} checkpoints) — `journeys/{NN}-{name}.spec.ts`

**Source files:** `path/to/component.tsx`, `path/to/hook.ts`

- [x] Description of what the test verifies
- [x] Another checkpoint
- [ ] Planned but not yet implemented
```

## coverage.json Format

```json
{
  "id": "kebab-case-id",
  "name": "Human Readable Name",
  "spec": "NN-kebab-case-name.spec.ts",
  "sourceFiles": ["app/path/to/page.tsx", "components/path/to/component.tsx"],
  "checkpoints": [
    {
      "id": "prefix-01",
      "description": "What the test verifies",
      "status": "covered"
    }
  ]
}
```
