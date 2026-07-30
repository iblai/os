# Tauri Desktop E2E Coverage — Journey Checklist

> Last updated: 2026-07-25 | 10 checkpoints (7 covered, 3 pending) | 2 journeys | 100% of reproducible checkpoints covered | Driver: WebdriverIO + tauri-driver

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
