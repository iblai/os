---
description: Enforce safe git push discipline — never use --no-verify, always fix hook failures at the root cause.
---

# Safe Push Skill

## Hard rule: --no-verify is NEVER allowed

Do not use `--no-verify`, `--no-gpg-sign`, or any other flag that bypasses git hooks when committing or pushing. This applies even if:

- The pre-push hook is taking a long time (build, typecheck, tests)
- The user has used `--no-verify` themselves in a previous message
- A previous push in this session used `--no-verify`

The pre-push hook exists to protect the branch. Bypassing it defeats the purpose.

## What to do instead when the hook fails

| Hook failure              | Correct action                                          |
| ------------------------- | ------------------------------------------------------- |
| TypeScript errors         | Fix the type errors                                     |
| Lint errors               | Fix the lint violations                                 |
| Build failure             | Fix the build error                                     |
| Unit test failures        | Fix or investigate the failing tests                    |
| Coverage regression       | Update `e2e/coverage.json` and `e2e/COVERAGE.md`        |
| `pnpm: command not found` | Source the shell profile: `. ~/.zshrc` or `. ~/.bashrc` |

## Push sequence

Always push like this:

```bash
git push
```

If the remote has new commits:

```bash
git pull --rebase && git push
```

If the push is rejected by branch protection (requires PR):

- Do not force push to main
- Create a PR instead

## If the user explicitly asks for --no-verify

If the user directly instructs you to push with `--no-verify`, acknowledge the risk and ask them to confirm, then proceed once confirmed. Do not use it proactively on your own initiative.

## Pre-push hook contents (for context)

The `.husky/pre-push` hook runs:

1. `pnpm typecheck`
2. `pnpm lint:check`
3. `pnpm build`
4. `pnpm test`
5. `bash ./scripts/check-test-coverage.sh`
6. `node e2e/scripts/check-journey-coverage.mjs --no-regress`

These are all required checks. A failure in any of them indicates a real problem that must be fixed before the code ships.
