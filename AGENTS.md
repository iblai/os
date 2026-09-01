# OS — Claude Code Rules

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

## Bug fixes require regression tests

Every bug fix lands with tests that would have caught the bug: a unit test in the same change (vitest for TS; the touched module's `mod tests` for Rust — pre-push runs `cargo test` when `src-tauri/*.rs` changed), and, when the bug was user-visible, an e2e checkpoint. A fix without a test that fails on the pre-fix code is not done.

See `.claude/skills/e2e-coverage.md` for when and how to add the e2e half.

## E2E coverage

After any change to user-facing behavior, evaluate whether `e2e/coverage.json` and `e2e/COVERAGE.md` need updating. Coverage must never regress.

See `.claude/skills/e2e-coverage.md` for the full decision process.
