---
description: Automatically keep e2e test coverage in sync with code changes. Triggers when features are added, bugs are fixed, or UI components are modified.
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
- A feature was removed (remove the checkpoint)

### 4. No e2e changes needed if:
- The change is purely internal (refactoring, performance, types)
- The change is in test infrastructure only
- The change is cosmetic with no behavior change (colors, spacing)

## Actions Required

When e2e changes ARE needed:

1. **Write/update the spec file** in `e2e/journeys/` following the existing patterns:
   - Use `test` and `expect` from `../fixtures/mentor-test`
   - Use `navigateToMentorApp`, `checkAdminStatus` from `../utils/auth`
   - Use page objects from `../page-objects/` when available
   - Test names follow: `"admin/user goes to [page] and [action] [expected result]"`
   - Add `test.fixme()` with a comment if the test can't pass due to app-level issues
   - Each test should clean up after itself

2. **Create helpers** in `e2e/utils/` if the journey needs reusable functions (e.g., `e2e/utils/workflows.ts`)

3. **Update `e2e/COVERAGE.md`**:
   - Add/update the journey section with all checkpoints
   - Update the header stats (checkpoint count, journey count)
   - Keep checkpoints marked `[x]` when the test exists and passes
   - List relevant source files in the `**Source files:**` line

4. **Update `e2e/coverage.json`** if it exists, to keep it in sync with COVERAGE.md

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
