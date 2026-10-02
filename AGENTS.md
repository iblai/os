# OS — Claude Code Rules

## Formatting

After editing any `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, or `.json` file, run prettier on the changed files before committing:

```bash
pnpm prettier --write <changed-files>
git add -u
```

The pre-commit hook does this automatically, but running it upfront avoids formatting noise in diffs. The project uses `prettier-plugin-tailwindcss`, so Tailwind class order is enforced too.

See `.claude/skills/prettier-format.md` for full details.

## Code comments — only when necessary

Comments are a cost. Most well-named code needs none. Do not narrate the code — prefer clear names over prose that restates what the code already says.

Add a comment ONLY to capture what the code cannot:

- A non-obvious **why**: a rationale, trade-off, or business rule that isn't visible from the code.
- A **gotcha or workaround**: why something is done an unusual way (ideally with a ticket/link).
- A **warning**: a non-obvious consequence or ordering requirement.

Do NOT add:

- Comments that describe the next line (`// set the tenant`, `// loop over items`, `// fetch the data`).
- Restatements of signatures, types, or obvious control flow.
- Section-banner or decorative comments.
- Scaffolding/attribution/changelog notes (`// added by …`, resolved `TODO`s, "this now does X").

When in doubt, leave it out. If deleting a comment loses nothing a competent reader wouldn't get from the code itself, delete it. This applies to code you write **and** code you edit — don't leave behind noise.

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

## The user has never coded

Everything a user reads — UI strings, the Code agent's replies, errors we surface — is written for someone who has never coded: everyday words, what they get and what we need from them, never developer vocabulary (scaffold, repo, build, lint, typecheck, dependency, DNS, …) and never how something was made. For the Code agent that rule is the voice bullet of `IBLAI_INSTRUCTIONS` (`src-tauri/src/opencode_proxy.rs`), pinned by the `result-or-obstacle-only` guard; when a reply leaks jargon, extend that bullet — never a skill, and never the agent-facing text with words you would not want echoed.

## Code mode: ibl.ai instruction layers

Three OS-owned layers steer the Code agent (opencode, or Codex / Claude Code — see the paragraph after the list); each has guard tests pinning its load-bearing lines — update the pins in the same change as any text edit.

1. **Suppressor stub**: `src-tauri/src/opencode_build_prompt.txt` is TWO lines — identity plus the silence rule (no text before or between tool calls, one reply at the end), the one rule that needs the top-of-prompt slot — whose job is to exist: `enforce_build_prompt` writes it as `agent.build.prompt` + `default_agent: "build"` on every spawn, which suppresses opencode's built-in per-model prompts (they mandate step-by-step narration; upstream's `agent.prompt ? … : provider prompt` ternary means an EMPTY prompt would silently restore them — pinned by `the_build_prompt_is_a_minimal_suppressor_stub`). Never grow it back into a fork: everything else belongs in layer 2. The streaming path enforces the silence rule deterministically too: text the model emits before a tool call is reclassified into the reasoning section (`TurnState::take_narration`, `opencode_acp.rs`), so the visible reply is what follows the last tool call.
2. **The authored prompt — desktop policy + voice + working discipline**: `IBLAI_INSTRUCTIONS` in `src-tauri/src/opencode_proxy.rs` — the three asked setup steps (default template? → local preview at localhost:3000? → deploy?, plus the app’s name on the first deploy, which the agent turns into its subdomain, once per project, yes = auto-redeploy after; the deploy offer rides the preview reply and every deploy reply points at Open in Finder), the app named right after the template (package.json, the layout title, `NEXT_PUBLIC_APP_NAME`, the README) so the template's name never ships or deploys, nothing localhost- or deploy-shaped unasked, "our hosting" never "Vercel", RESOLVED env values, auto-minted `IBLAI_API_KEY`, the three-sentence reply cap, the plain-words voice rule for users who have never coded (what the app does, never how it was made) and the non-technical-user voice rule, and the working-discipline rules moved from the retired prompt fork (smallest correct change, ASCII, Glob/Grep + parallel reads, git safety: never revert others' changes / no `git reset --hard` / non-interactive git only). `guidance_with_identity` composes it with per-user identity lines at spawn; `write_iblai_guidance` (`opencode_acp.rs`) writes it as `<config_home(session)>/opencode/AGENTS.md` on EVERY spawn — unconditionally, skills wired or not, since it is the agent's entire authored behavior — strictly BEFORE `cmd.spawn()`, and a failed write aborts the spawn (opencode silently ignores missing instruction files, so never soften that error). opencode re-reads the file on every model call: main turns, subagents, ACP, and on-device (ollama/foundry) sessions alike. Never write that AGENTS.md outside the per-session ibl.ai config home (it is unrelated to this repo-root AGENTS.md). The retired delivery paths — loopback-proxy body injection and the config `instructions` key — must not come back.
3. **Skills**: vibe SKILL.md files sync from the LATEST vibe GitHub release at startup (or from the tag `IBL_VIBE_SKILLS_TAG` names — set it in `src-tauri/.env.local` to touch-test a vibe pre-release in a dev build). Portable procedures go there; desktop-only policy goes in layer 2, which supersedes skill wording.

**Codex and Claude Code.** The model string picks the agent — exactly `codex/default` → Codex (`@agentclientprotocol/codex-acp`), exactly `claude/default` → Claude Code (`@agentclientprotocol/claude-agent-acp`), anything else → opencode (`Backend::of` in `opencode_acp.rs`; exact strings, never a prefix, because a platform provider could be named `claude`). Both adapters are Node programs wrapping the vendor's native binary; the OS installs a pinned Node plus the pinned adapters into `~/.local/share/iblai` with npm (`code_agent_installer.rs`, Zed's recipe, SHASUMS-verified; own cache, blank npmrc files and every `npm_config_*` variable stripped — pnpm 10 exports the repo's `.npmrc`, `min-release-age=7` included, to `pnpm tauri:dev` as env) and runs everything by absolute path — nothing on the user's PATH is ever used. That install runs by itself, in the background, on every launch (`ensure_agents_current`, spawned in both twins' setup beside `ensure_opencode_current`; a pin bump therefore reaches every desktop on its next launch) and blocks nothing: `check_code_agent_status` reports `installing` while it runs, the popover shows that agent with a spinner and refuses the choice until its `code-agent:changed` lands (ibl.ai and any finished agent stay selectable), a turn on it fails with "still installing" (`agent_ready`), and a failed install shows its reason (`error`) with Install to retry — `install_with` returns early once the pin is installed, so a click queued behind the launch install never downloads twice. The model each agent runs is picked in the top-left while Code runs on it (`nav-bar/agent-model-selector.tsx`, an OS-only branch of the nav bar keyed on `useCodeAgent()`, opening the SDK's own `LLMProviderModal` in its `cloudOnly` mode — the LLM Selection dialog the cloud picker opens behind a provider card, so the two cannot drift; `@iblai/iblai-js` ≥ 2.27.0, whose `cloudOnly` keeps the device's Local Models setting out of it): saved per machine in `settings.json` (`code_agent_models`, `code_agent_models.rs`), listed from the agent's own ACP `configOptions` (captured on every handshake into `acp/<agent>/config-options.json`, or from a short probe session when nothing is cached — `probe_config_options`), applied with `session/set_config_option` right after the mode pin on every new session (a model the agent refuses fails the turn and names the picker — never a silent fall-back) and pushed to live sessions without a respawn (`push_config_option`); a pick a live session refuses is not saved. They reuse the user's CLI logins (`~/.codex`, `~/.claude`, read through the adapters' CLI passthroughs) and the app has no sign-in of its own — a signed-out agent's popover line, toast and turn error say where to sign in: Codex in the ChatGPT desktop app, whose login the bundled Codex reads from `~/.codex` exactly as the CLI and the IDE extension do (macOS's official Codex install is that app, which puts no `codex` on the PATH); Claude Code with `claude` in a terminal; the sandbox binds only the chosen agent's own dir read-write, masks the other's, and re-binds the agent's CLI config (hooks, MCP servers, instructions, skills) read-only so a session cannot plant anything for the user's next unsandboxed run (`Backend::frozen`). Accepted consequences, by decision: the agent's shell can read its own subscription token, OS sessions appear in `codex resume` / `claude --resume`, and Claude loads the workspace's own `.claude/settings*.json` allow-rules. Layer 1 is opencode-only. Layer 2 reaches Codex as `developer_instructions` in `CODEX_CONFIG` and Claude as `_meta.systemPrompt.append` on `session/new` and `session/load` (appended to its preset, never replacing it), from ONE authored text with three per-agent substitutions (`substitute_for`, pinned by `each_agent_gets_its_own_wording`). Layer 3 reaches both as a per-spawn view of symlinks under `config_home(session)/agent-skills` sent as `additionalDirectories` (`link_skills`). The Approvals toggle maps onto Codex's own modes — Ask Me → `read-only` (every write and network command escalates into a card), Automatic → `agent-full-access` (no Codex sandbox, no cards; the OS sandbox is the boundary) — pushed with `session/set_mode` on every flip; Claude is pinned to `default` and Automatic answers its cards. Permission answers pick the exact `allow_once` / `reject_once` kinds (`pick_option`): Codex lists `reject_always` before `decline`. A signed-out agent's JSON-RPC `-32000` becomes the `agent sign-in required` error, never a crash retry; `opencode_chat_stream` emits `opencode:auth_required` BEFORE the turn's `ollama:error`, `hooks/use-opencode-auth-required.tsx` shows the sign-in toast and `wasRecentAuthRequired()` keeps the generic chat toast quiet. Only `coding-mode-button.tsx` writes `ibl_coding_mode_model`; its Agent choice (`ibl_coding_mode_agent`, per machine, never synced to DM) stays hidden until `check_code_agent_status` answers, because the WebView runs the deployed web app and may face an older binary.

When `NODE_VERSION`, `CODEX_ACP_VERSION` or `CLAUDE_AGENT_ACP_VERSION` bumps (`src-tauri/src/code_agent_installer.rs`): re-verify codex-acp still merges `CODEX_CONFIG` into the session config (`developer_instructions`) and offers the `cli login status` passthrough, that claude-agent-acp still honours `_meta.systemPrompt.append`, `additionalDirectories` and `--cli auth status --json`, and that both still read `~/.codex` / `~/.claude`; then run `cd src-tauri && cargo test code_agent_pins -- --ignored --nocapture` (downloads the pins, ~700 MB) and the Tauri e2e checkpoint code-29. Every desktop pulls the new pins in the background on its next launch, so bump the three together, once.

When `OPENCODE_VERSION` bumps: re-verify upstream `session/instruction.ts` still loads the global AGENTS.md, then re-prove it empirically by running the always-on tests in `src-tauri/src/opencode_installer.rs` — `the_pinned_opencode_binary_is_reused_when_current_and_downloaded_when_not` (fetches the new pin into the managed bin dir when absent/stale) and `opencode_run_carries_the_agents_md_guidance_on_every_model_call` (drives the real pinned binary through two `opencode run` turns against a local stub and asserts every agent-turn model call carries the AGENTS.md guidance, rewritten between turns to prove the per-call re-read; the title-summarizer call is exempted by name and any unrecognized call type fails loudly): `cd src-tauri && cargo test pinned_binary -- --nocapture`.
