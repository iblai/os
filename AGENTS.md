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

## Code mode: ibl.ai instruction layers

Three OS-owned layers steer the Code agent (opencode); each has guard tests pinning its load-bearing lines — update the pins in the same change as any text edit.

1. **Voice**: `src-tauri/src/opencode_build_prompt.txt` fully replaces opencode's per-model prompt (`enforce_build_prompt` writes `agent.build.prompt` + `default_agent: "build"` on every spawn). Fork of upstream `gpt.txt` at the pinned `OPENCODE_VERSION` — re-diff on pin bumps.
2. **Desktop policy**: `IBLAI_INSTRUCTIONS` in `src-tauri/src/opencode_proxy.rs` — the three asked setup steps (default template? → local preview at localhost:3000? → deploy?, once per project, yes = auto-redeploy after), nothing localhost- or deploy-shaped unasked, "our hosting" never "Vercel", RESOLVED env values, auto-minted `IBLAI_API_KEY`. `guidance_with_identity` composes it with per-user identity lines at spawn; `write_iblai_guidance` (`opencode_acp.rs`) writes it as `<config_home(session)>/opencode/AGENTS.md` on every spawn, strictly BEFORE `cmd.spawn()`, and a failed write aborts the spawn — opencode silently ignores missing instruction files, so never soften that error. opencode re-reads the file on every model call: main turns, subagents, ACP, and on-device (ollama/foundry) sessions alike. Never write that AGENTS.md outside the per-session ibl.ai config home (it is unrelated to this repo-root AGENTS.md). The retired delivery paths — loopback-proxy body injection and the config `instructions` key — must not come back.
3. **Skills**: vibe SKILL.md files sync from the LATEST vibe GitHub release at startup. Portable procedures go there; desktop-only policy goes in layer 2, which supersedes skill wording.

When `OPENCODE_VERSION` bumps: re-verify upstream `session/instruction.ts` still loads the global AGENTS.md, then re-prove it empirically — run `opencode run "hi"` (the managed pinned binary) with a scratch `XDG_CONFIG_HOME` holding `opencode/opencode.json` (provider baseURL pointed at a local stub that captures the request body) plus `opencode/AGENTS.md` with a marker, and grep the captured system content for `# ibl.ai guidance`.
