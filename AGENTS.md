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

1. **Suppressor stub**: `src-tauri/src/opencode_build_prompt.txt` is TWO lines — identity plus the silence rule (no text before or between tool calls, one reply at the end), the one rule that needs the top-of-prompt slot — whose job is to exist: `enforce_build_prompt` writes it as `agent.build.prompt` + `default_agent: "build"` on every spawn, which suppresses opencode's built-in per-model prompts (they mandate step-by-step narration; upstream's `agent.prompt ? … : provider prompt` ternary means an EMPTY prompt would silently restore them — pinned by `the_build_prompt_is_a_minimal_suppressor_stub`). Never grow it back into a fork: everything else belongs in layer 2. The streaming path enforces the silence rule deterministically too: text the model emits before a tool call is reclassified into the reasoning section (`TurnState::take_narration`, `opencode_acp.rs`), so the visible reply is what follows the last tool call.
2. **The authored prompt — desktop policy + voice + working discipline**: `IBLAI_INSTRUCTIONS` in `src-tauri/src/opencode_proxy.rs` — the three asked setup steps (default template? → local preview at localhost:3000? → deploy?, once per project, yes = auto-redeploy after), nothing localhost- or deploy-shaped unasked, "our hosting" never "Vercel", RESOLVED env values, auto-minted `IBLAI_API_KEY`, the three-sentence reply cap, and the working-discipline rules moved from the retired prompt fork (smallest correct change, ASCII, Glob/Grep + parallel reads, git safety: never revert others' changes / no `git reset --hard` / non-interactive git only). `guidance_with_identity` composes it with per-user identity lines at spawn; `write_iblai_guidance` (`opencode_acp.rs`) writes it as `<config_home(session)>/opencode/AGENTS.md` on EVERY spawn — unconditionally, skills wired or not, since it is the agent's entire authored behavior — strictly BEFORE `cmd.spawn()`, and a failed write aborts the spawn (opencode silently ignores missing instruction files, so never soften that error). opencode re-reads the file on every model call: main turns, subagents, ACP, and on-device (ollama/foundry) sessions alike. Never write that AGENTS.md outside the per-session ibl.ai config home (it is unrelated to this repo-root AGENTS.md). The retired delivery paths — loopback-proxy body injection and the config `instructions` key — must not come back.
3. **Skills**: vibe SKILL.md files sync from the LATEST vibe GitHub release at startup. Portable procedures go there; desktop-only policy goes in layer 2, which supersedes skill wording.

When `OPENCODE_VERSION` bumps: re-verify upstream `session/instruction.ts` still loads the global AGENTS.md, then re-prove it empirically by running the always-on tests in `src-tauri/src/opencode_installer.rs` — `the_pinned_opencode_binary_is_reused_when_current_and_downloaded_when_not` (fetches the new pin into the managed bin dir when absent/stale) and `opencode_run_carries_the_agents_md_guidance_on_every_model_call` (drives the real pinned binary through two `opencode run` turns against a local stub and asserts every agent-turn model call carries the AGENTS.md guidance, rewritten between turns to prove the per-call re-read; the title-summarizer call is exempted by name and any unrecognized call type fails loudly): `cd src-tauri && cargo test pinned_binary -- --nocapture`.
