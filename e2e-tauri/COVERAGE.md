# Tauri Desktop E2E Coverage — Journey Checklist

> Last updated: 2026-09-29 | 52 checkpoints (23 covered, 29 pending) | 3 journeys | 100% of reproducible checkpoints covered | Driver: WebdriverIO + tauri-driver

This is the desktop counterpart to the web `e2e/COVERAGE.md`. It tracks only what
is exercised by driving the **built desktop binary** through `tauri-driver` (see
`e2e-tauri/`) — the native shell + WebView layer that the Playwright suite (`e2e/`)
and the Vitest unit tests don't reach.

## How This Works

Each **checkpoint** maps to a concrete `it(...)` in a WDIO/mocha spec under
`journeys/`, mirroring `e2e/`:

- `covered` — a passing test is in the suite.
- `pending` — planned; tracked here but not yet automated (needs a harness the
  default env can't provide). Excluded from the coverage %, like the web ledger.
- `deprecated` / `not-reproducible` — as in the web ledger.

Coverage % = `covered / (total − pending − deprecated − not-reproducible)`.

`e2e-tauri/scripts/check-journey-coverage.mjs` validates that every journey's
spec file exists, that the `summary` counts match the journeys, and that the
checkpoint count has not regressed (`--no-regress`).

Platform support (same as `e2e-tauri/README.md`): Linux (`WebKitWebDriver`) and
Windows (`msedgedriver`) only — `tauri-driver` has no macOS support.

**iOS note:** the mobile app's embedded on-device LLM runtime
(`src-tauri/src/local_llm.rs` — the Ollama-compatible server that backs
Journey 2's commands on iPhones) cannot be driven by `tauri-driver` (no
iOS support). Its coverage lives in the Rust unit tests (`local_llm.rs`
`mod tests`, including an opt-in real-inference test:
`IBL_LLM_TEST_MODEL=… cargo test --features embedded-llm -- --ignored`) and
the Vitest suites (`coding-mode-button` mobile gating,
`__tests__/web-utils-ios-local-llm-patch.test.ts`). The same applies to the
phone↔desktop Code pairing (`src-tauri/src/remote_code_client.rs`): its Rust
`mod tests` cover turn translation, delta coalescing, and the multi-address
pairing failover (a pairing heals to an alternate advertised address when
the primary dies), and the Vitest suites cover the pairing UI (full `urls` list
persisted for failover) plus the phone composer ergonomics (icon-only tool
pills below 520px, keyboard dismissed on send for coarse pointers —
`chat-input-form.test.tsx`). Streaming-performance guards (unthrottled
per-token re-renders froze/crashed phone webviews): the shared
`TokenCoalescer` batches the local-LLM stream ON MOBILE ONLY — desktop keeps
its original per-token cadence via the passthrough mode — both pinned in the
`remote_code_client` Rust tests; the render side is pinned in
`markdown-memo.test.tsx` (memoized wrapper + referentially stable Streamdown
props) and `tool-call-item-memo.test.tsx` (tool rows skip identity-only
re-renders).

**App self-update note:** the update prompt (`components/app-update-prompt.tsx`,
`src-tauri/src/app_update.rs`) cannot be e2e-driven either — tauri-driver has no
release-build updater endpoint to point at, and the mobile halves open real
store pages. Coverage lives in the Rust `app_update` `mod tests` (version
comparison, iTunes lookup parsing, Play listing parsing) and the
`app-update-prompt` Vitest suite (check on every open, session-only "Later",
desktop install vs mobile store routing, install-failure surfacing). The CI
halves — signing env + `latest-<target>-<arch>.json` publishing — live in the
two vendored release workflows and are exercised by real releases.

---

## Journey 1: App Launch & Desktop Shell (4 checkpoints) — `journeys/01-app-launch-and-shell.spec.ts`

**Source files:** `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`, `hooks/use-tauri.ts`, `types/tauri.ts`

- [x] `shell-01` App binary launches under tauri-driver and a WebDriver session attaches to its WebView
- [x] `shell-02` The WebView renders a `<body>` element
- [x] `shell-03` The WebView loads a document with a non-empty URL (the platform shell or the offline fallback)
- [x] `shell-04` The document exposes a non-empty title

---

## Journey 2: On-device Model Management (7 checkpoints: 3 covered, 4 pending) — `journeys/02-on-device-model-management.spec.ts`

> **Partly covered.** The download mechanics (odm-02/03/05) run against the REAL
> compiled binary through the live Tauri IPC bridge (`window.__TAURI__`), pulling
> a tiny real model (`smollm:135m`, ~92 MB) so a genuine Ollama pull — its
> streamed progress, cancellation, and the resulting install — is exercised end
> to end. The picker-UI checkpoints (odm-01 merge, odm-04 one-at-a-time guard,
> odm-06 nav badge) need an authenticated session and are pending stubs (Mocha
> reports them as **skipped**); they are covered meanwhile by the Vitest unit
> tests (`hooks/__tests__/use-model-download*`,
> `components/modals/__tests__/llm-provider-modal*`,
> `hooks/__tests__/use-tauri.mockipc.test.ts`). Requires Ollama running + network.

**Source files:** `hooks/use-model-download.ts`, `components/modals/llm-provider-modal.tsx`, `components/modals/llm-provider-modal/local-model-row.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`, `src-tauri/src/model_manager.rs`, `src-tauri/src/lib.rs`

- [ ] `odm-01` The LLM picker merges on-device (local) models with the provider's cloud models in one availability-ranked list _(UI pass)_
- [x] `odm-02` A not-installed on-device model pulls via the `download_model` IPC and streams live progress events (real `smollm:135m` pull)
- [x] `odm-03` Cancelling an in-flight pull returns promptly and the app keeps answering IPC (the no-freeze regression fix)
- [ ] `odm-04` Starting a second on-device download while one is in flight shows the "already downloading" guard — one pull at a time _(UI pass)_
- [x] `odm-05` A completed pull installs the on-device model (`check_ollama_status` lists it)
- [ ] `odm-06` The nav-bar on-device badge reflects the selected local model _(UI pass)_
- [ ] `odm-07` Busy default ports at launch degrade to allocated ones: the MCP bridge and the offline server each bind a free port (preferring 8000/3457) and every consumer follows — local chat still streams, the offline cache still serves _(needs a journey that pre-occupies the ports before launching the binary; covered meanwhile by the `pick_port`/`bind_with_fallback`/`chat_base_url` Rust tests in `mcp_bridge_manager.rs`, `offline_server.rs` and `model_manager.rs`)_

---

## Journey 3: Code Mode (opencode) (41 checkpoints: 16 covered, 25 pending) — `journeys/03-code-mode.spec.ts`

> **Partly covered.** The installer and per-chat state (code-01…07) run against
> the REAL compiled binary through the live Tauri IPC bridge (`window.__TAURI__`):
> a genuine opencode release download, and the real `workspaces.json` map being
> written. `code-03` is the regression guard for spawning the bare `opencode` name
> on an augmented `PATH` — without it the installer reports "not installed" right
> after a successful download and re-downloads forever.
>
> The turn-level checkpoints (code-08/09/10) need a **tool-calling** model: the
> cloud path needs an authenticated tenant, and the on-device path is a multi-GB
> pull (Journey 2 deliberately uses a 92 MB model that cannot call tools). They are
> pending stubs (Mocha reports them as **skipped**) and are covered meanwhile by
> the Rust unit tests (`pick_eviction`, `pick_reapable` in `opencode_acp.rs`) and
> the Vitest tests (`components/chat/__tests__/code-permission-card.test.tsx`,
> `components/chat/__tests__/ai-message-bubble.test.tsx`).
>
> The Agent Skills checkpoints (code-12/13/16) exercise the real skill staging:
> `set_opencode_skills` writing SKILL.md packages under the mentor-keyed staging
> dir (with hostile slugs/filenames confined), the rewrite/clear semantics, and a
> live `ensure_vibe_skills` tarball fetch. The UI half (code-14, the pill spinner
>
> - amber note) needs an authenticated session like odm-01/04/06, and an actual
>   skill invocation (code-15) needs a tool-calling model like code-08..10 — both
>   pending, covered meanwhile by the Vitest suites
>   (`hooks/__tests__/use-opencode-skill-sync.test.tsx`,
>   `components/chat-input-form/__tests__/coding-mode-button.test.tsx`) and the
>   Rust `apply_skills_config` tests.
>
> The subscription agents (code-29…38): `check_code_agent_status` and the
> Claude Code sign-in refusal run against the real commands (code-29/31). The
> live install of the managed Node plus both ACP adapters (code-30) is a ~700 MB
> download, too heavy for the harness like code-26, and is covered meanwhile by
> the `#[ignore]`d Rust `code_agent_pins_install_and_load`. The popover's Agent
> choice and status line, Codex's browser sign-in, the signed-out toast and real
> Codex / Claude Code turns (code-32…37) need an authenticated UI session or a
> signed-in ChatGPT / Claude subscription; they are covered meanwhile by the
> coding-mode-button and use-opencode-auth-required Vitest suites and the Rust
> backend tests in `opencode_acp.rs` (`the_model_string_picks_the_backend`,
> `each_backend_carries_guidance_and_skills_its_own_way`,
> `a_scripted_agent_gets_our_session_params_and_a_signed_out_prompt_fails_loudly`).
> The launch-time background install (code-38) is the same download as code-30
> and is covered meanwhile by the coding-mode-button Vitest cases (an installing
> agent spins and refuses the choice, a launch-time install followed to its end,
> a failed launch-time install with Install to retry) and by the Rust
> `an_installing_or_failed_agent_reports_its_phase`. The agents' model lists
> (code-39) run against the real command; the top-left picker (code-40) and a
> turn on the picked model (code-41) need a UI session or a signed-in
> subscription and are covered meanwhile by the nav-bar and
> agent-model-selector Vitest suites and the Rust
> `a_scripted_agent_reports_its_models_and_takes_the_saved_one`.
>
> Requires network access for the opencode + vibe downloads (and, for code-30 by
> hand, the Node + adapter downloads). No Ollama, no credentials.

**Source files:** `src-tauri/src/opencode_acp.rs`, `src-tauri/src/opencode_installer.rs`, `src-tauri/src/opencode_proxy.rs`, `src-tauri/src/code_agent_installer.rs`, `components/chat-input-form/coding-mode-button.tsx`, `components/chat/code-permission-card.tsx`, `hooks/use-opencode-skill-sync.ts`, `hooks/use-opencode-auth-required.tsx`

- [x] `code-01` `check_opencode_status` reports Code readiness (installed / version / config_ready / sandboxed / supported / sandbox_ready)
- [x] `code-02` `install_opencode` downloads and installs the pinned opencode release binary (live)
- [x] `code-03` The freshly installed binary is discoverable on the augmented `PATH` — status reports installed with a version instead of re-downloading forever
- [x] `code-04` A chat with real work keeps its own workspace under the app-managed root; an untouched leftover (just `.git`) is recycled for the next chat instead of stranding one dir per launch
- [x] `code-05` A chat keeps the same workspace across calls, persisted in `workspaces.json`
- [x] `code-06` The folder picker repoints ONE chat at an arbitrary path and leaves other chats untouched
- [x] `code-07` `opencode_close` / `opencode_permission_respond` on an unknown id are graceful no-ops
- [x] `code-11` The app keeps answering IPC while opencode downloads and extracts _(setup-freeze regression)_
- [x] `code-12` `set_opencode_skills` materialises a mentor's Agent Skills as SKILL.md packages (frontmatter + text resources), with hostile slugs/filenames confined to the staging dir
- [x] `code-13` A skills rewrite drops deselected skills, an empty sync clears the tree, and `skills: null` ends a sync without touching it
- [x] `code-16` `ensure_vibe_skills` installs the shared iblai/vibe skill set into the app data dir (live tarball fetch of the latest GitHub release, checked on every look — app startup and each Code enable — always latest, never pinned)
- [ ] `code-08` A permission prompt in one chat does not block another chat's turn _(needs a tool-calling model)_
- [ ] `code-09` The 5-session cap evicts the least-recently-used idle opencode process _(needs a tool-calling model)_
- [ ] `code-10` The permission prompt renders in the chat that raised it _(needs a tool-calling model)_
- [ ] `code-14` The Code pill spins in place of its icon while skills sync; the popover shows the amber note when the sync fails _(needs an authenticated UI session)_
- [ ] `code-15` A Code turn invokes a synced skill through opencode's native skill tool _(needs a tool-calling model)_
- [ ] `code-17` New Chat in the sidebar evicts the previous chat's opencode process while Code is on _(needs an authenticated UI session; covered meanwhile by the app-sidebar Vitest eviction cases)_
- [ ] `code-18` A Code turn's opencode process runs inside the OS sandbox (bwrap / sandbox-exec) — only the workspace and tool caches writable, ~/.ssh empty _(needs a tool-calling model; the bwrap argv, SBPL profile and decoy home are covered by the Rust sandbox tests in `opencode_acp.rs`)_
- [ ] `code-19` A second New Chat in one app run gets its own fresh workspace, and a chat's folder follows it from the ephemeral first-turn key to its real session id _(needs an authenticated UI session; covered meanwhile by the Rust `adopt_prior_mapping` tests and the SDK per-chat key Vitest cases)_
- [ ] `code-20` Killing the opencode process mid-turn: the answer continues in the same bubble with no visible interruption (one silent respawn re-sends the prompt), and a second kill in the same turn surfaces `ollama:error` _(needs a tool-calling model; covered meanwhile by the Rust crash-retry tests in `opencode_acp.rs` — `should_retry`, `reader_gone`, `closing` — and the proxy rebind/read-timeout tests)_
- [x] `code-21` The Code approval mode (manual/auto) round-trips through `settings.json`, survives a restart, and an unknown mode is refused rather than defaulting
- [x] `code-22` A mentor keeps one workspace across chats while another mentor gets its own, and New Workspace mints a fresh folder without deleting the previous one
- [ ] `code-23` The Code popover asks for an approval mode on first use and stores the answer against the signed-in user, so it follows them to another machine _(needs an authenticated UI session; covered meanwhile by the coding-mode-button Vitest cases)_
- [ ] `code-24` The Code popover offers New Workspace and a platform-named Open Folder button (Finder / Explorer / the probed Linux file manager) _(needs an authenticated UI session, and clicking Open Folder would spawn a real file manager; labels and disabled states covered by the coding-mode-button Vitest cases)_
- [ ] `code-25` A between-turn opencode death (crash, idle reap, LRU eviction) is invisible: the next turn `session/load`s the same conversation back, and when a load isn't possible the frontend's transcript is resent so the agent continues; a mid-turn death keeps the input busy — the Stop button stays Stop and no suggested prompts appear while the backend silently respawns _(needs an authenticated chat driving real opencode turns; covered meanwhile by the Rust resume-map + `prompt_with_history` tests in `opencode_acp.rs` and the SDK transcript/restart + mentor-socket-guard Vitest cases)_
- [ ] `code-26` A managed opencode older than the pinned version is re-downloaded at boot, and a user's own PATH copy is never replaced _(the upgrade downloads a ~100MB release, too heavy for the harness; the decision is covered by `only_a_present_and_outdated_managed_copy_wants_an_upgrade` in `opencode_installer.rs`)_
- [ ] `code-27` A new web project walks the 3-step flow: the default-template question, then the local-preview question (dev server + browser open at http://localhost:3000 only on yes), then one deploy question per project (yes = deploy now and auto-redeploy on later changes, no = deploy only on request), and replies never name the hosting provider _(needs a tool-calling model driving real turns, the same harness gap as code-08..10/15; the instruction text is covered meanwhile by `the_iblai_guidance_keeps_its_load_bearing_lines` in `opencode_proxy.rs`)_
- [ ] `code-28` Text the agent emits before a tool call lands in the thinking section, never the reply bubble; the visible reply is what follows the last tool call _(needs a tool-calling model driving real turns, the same harness gap as code-08..10/15; the reclassification is covered meanwhile by `pre_tool_text_is_reclassified_as_narration` in `opencode_acp.rs`)_
- [x] `code-29` `check_code_agent_status` answers for Codex and Claude Code (installed / supported / sign_in_supported / signed_in, null when the probe can't tell) and refuses an unknown backend
- [x] `code-31` `code_agent_sign_in` for Claude Code refuses with the run-`claude`-in-a-terminal guidance instead of opening a browser (the app reuses the CLI login)
- [ ] `code-30` `install_code_agent` installs the pinned Node runtime and each agent's ACP adapter (live), streaming progress on `model:installation-log` with source `code-agent`; status then reports installed with `node_version` and `adapter_version` _(a ~700 MB download, too heavy for the harness like code-26; covered meanwhile by the `#[ignore]`d `code_agent_pins_install_and_load` in `code_agent_installer.rs` and the pinning tests `adapters_are_pinned_exactly`, `node_assets_match_the_published_shasums`, `readiness_distinguishes_missing_stale_and_current`)_
- [ ] `code-32` The Code popover's Agent choice (ibl.ai / Codex / Claude Code) routes turns through the model key (`codex/default`, `claude/default`), keeps the mentor-LLM and on-device writers off it, restores the platform model on switching back, and stays hidden on phones and on desktop builds without the agent commands _(needs an authenticated UI session like code-14/23/24; covered meanwhile by the coding-mode-button Vitest cases `choosing Codex routes Code to codex/default…`, `keeps the mentor LLM…`, `lets an agent run while an on-device model…`, `switching back to ibl.ai…`, `hides the agent choice…`, `never offers the agent choice on a phone…`, and the Rust `the_model_string_picks_the_backend`)_
- [ ] `code-33` The popover shows the selected agent's one quiet status line: Install with live progress, Codex's Sign in with ChatGPT, Claude Code's run-`claude` hint with Check Again, the account once signed in, and the reason where it can't run _(same gap; covered meanwhile by the coding-mode-button Vitest cases `installs a missing agent…`, `signs in to Codex…`, `tells Claude Code users…`, `offers Sign in with Claude…`, `shows why an agent can’t run…`)_
- [ ] `code-34` Sign in with ChatGPT completes Codex's browser login and the status then names the account _(needs a real ChatGPT account and a browser the harness can't drive; covered meanwhile by `signs in to Codex with ChatGPT and then shows the account`, `surfaces a failed ChatGPT sign-in as a toast`, and the Rust `claude_auth_status_maps_to_signed_in` / `adapter_version_output_parses_both_shapes` probe parsing)_
- [ ] `code-35` A turn on a signed-out agent raises one sign-in toast (Codex: Sign in with ChatGPT action; Claude Code: run `claude` in a terminal) and no generic chat error toast _(needs a real agent turn; covered meanwhile by `hooks/__tests__/use-opencode-auth-required.test.tsx` and the Rust `sign_in_errors_become_one_sentence_and_never_retry` and `a_scripted_agent_gets_our_session_params_and_a_signed_out_prompt_fails_loudly`)_
- [ ] `code-36` A Code turn on Codex streams into the same bubble (reply, thinking, tool calls, permission card) with the ibl.ai guidance delivered as `developer_instructions` and Codex's own mode following the Approvals toggle (read-only for Ask Me, full access for Automatic) _(needs a signed-in ChatGPT subscription; covered meanwhile by the Rust `each_backend_carries_guidance_and_skills_its_own_way`, `the_os_approval_mode_drives_codex_s_own_mode`, `permission_answers_pick_the_exact_once_kinds` and `each_agent_gets_its_own_wording` in `opencode_proxy.rs`)_
- [ ] `code-37` A Code turn on Claude Code streams into the same bubble with the ibl.ai guidance appended via `systemPrompt.append` and the session pinned to Claude's default mode _(needs a signed-in Claude subscription; covered meanwhile by the Rust `each_backend_carries_guidance_and_skills_its_own_way`, `a_scripted_agent_gets_our_session_params_and_a_signed_out_prompt_fails_loudly` and `each_backend_sees_only_its_own_login`)_
- [ ] `code-38` On launch the desktop installs the managed Node and both agents' ACP adapters by itself in the background (a pin bump reaches every desktop on its next launch); the Code popover shows an installing agent with a spinner and refuses the choice until it is ready while ibl.ai keeps working, and a failed install shows its reason with Install to retry _(the same ~700 MB download as code-30; covered meanwhile by the coding-mode-button Vitest cases `shows an installing agent with a spinner…`, `follows a launch-time install to its end…`, `shows why a launch-time install failed…` and the Rust `an_installing_or_failed_agent_reports_its_phase` plus the `stale_agents` asserts in `readiness_distinguishes_missing_stale_and_current`)_
- [x] `code-39` `list_code_agent_models` answers each agent's models (id, name, description) with the agent's own default and the saved pick, or refuses naming install / sign-in; an unknown backend is refused
- [ ] `code-40` The top-left model picker opens the SDK's LLM Selection dialog (`LLMProviderModal` in its `cloudOnly` mode, the same dialog the cloud picker opens behind a provider card) while Code runs on Codex / Claude Code (in place of the mentor's LLM selector and the on-device badge), lists Default with the agent's own default and the agent's models as cards, saves the pick per machine, and shows a failed list on the button with a click to retry _(needs an authenticated UI session like code-14/23/24; covered meanwhile by the nav-bar Vitest cases `shows the agent model picker instead of the LLM selector`, `keeps the LLM selector…` and `agent-model-selector.test.tsx`)_
- [ ] `code-41` A Code turn runs on the picked model: the handshake applies it with `session/set_config_option` right after the mode pin, a live session takes a new pick without a respawn, and a model the agent refuses fails the turn naming the picker _(needs a signed-in ChatGPT / Claude subscription; covered meanwhile by the Rust `a_scripted_agent_reports_its_models_and_takes_the_saved_one`, `an_unknown_model_is_refused_before_it_is_saved` and `the_model_choice_lists_the_agents_offer_with_default_and_selection`)_
