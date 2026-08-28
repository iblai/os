# Tauri Desktop E2E Coverage — Journey Checklist

> Last updated: 2026-08-28 | 36 checkpoints (20 covered, 16 pending) | 3 journeys | 100% of reproducible checkpoints covered | Driver: WebdriverIO + tauri-driver

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

---

## Journey 1: App Launch & Desktop Shell (4 checkpoints) — `journeys/01-app-launch-and-shell.spec.ts`

**Source files:** `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`, `hooks/use-tauri.ts`, `types/tauri.ts`

- [x] `shell-01` App binary launches under tauri-driver and a WebDriver session attaches to its WebView
- [x] `shell-02` The WebView renders a `<body>` element
- [x] `shell-03` The WebView loads a document with a non-empty URL (the platform shell or the offline fallback)
- [x] `shell-04` The document exposes a non-empty title

---

## Journey 2: On-device Model Management (6 checkpoints: 3 covered, 3 pending) — `journeys/02-on-device-model-management.spec.ts`

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

---

## Journey 3: Code Mode (opencode) (26 checkpoints: 13 covered, 13 pending) — `journeys/03-code-mode.spec.ts`

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
> Requires network access for the opencode + vibe downloads. No Ollama, no
> credentials.

**Source files:** `src-tauri/src/opencode_acp.rs`, `src-tauri/src/opencode_installer.rs`, `src-tauri/src/opencode_proxy.rs`, `components/chat-input-form/coding-mode-button.tsx`, `components/chat/code-permission-card.tsx`, `hooks/use-opencode-skill-sync.ts`

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
