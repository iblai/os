# MentorAI — Claude Code Rules

## Formatting

After editing any `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, or `.json` file, run prettier on the changed files before committing:

```bash
pnpm prettier --write <changed-files>
git add -u
```

The pre-commit hook does this automatically, but running it upfront avoids formatting noise in diffs. The project uses `prettier-plugin-tailwindcss`, so Tailwind class order is enforced too.

See `.claude/skills/prettier-format.md` for full details.

## Git push — --no-verify is NEVER allowed

Never use `--no-verify` when committing or pushing. The pre-push hook runs typecheck, lint, build, unit tests, and e2e coverage checks. These are required. If a hook fails, fix the root cause.

Only exception: the user explicitly instructs it in the current message.

See `.claude/skills/safe-push.md` for the full push protocol and how to handle each failure type.

## E2E coverage

After any change to user-facing behavior, evaluate whether `e2e/coverage.json` and `e2e/COVERAGE.md` need updating. Coverage must never regress.

See `.claude/skills/e2e-coverage.md` for the full decision process.
