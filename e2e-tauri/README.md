# Tauri desktop e2e (WebdriverIO)

End-to-end tests that drive the **built desktop binary** through
[`@wdio/tauri-service`](https://webdriver.io/docs/desktop-testing/tauri) — a layer
the Playwright suite (`e2e/`) and the Vitest unit tests don't cover. The service
spawns the debug binary with `WDIO_EMBEDDED_SERVER` set and the app serves W3C
WebDriver itself on 127.0.0.1:4445 (`tauri-plugin-wdio-webdriver`, registered in
`src-tauri/src/main.rs` / `lib.rs` for debug builds only — release builds never
open the port). Same path on macOS, Linux and Windows: no `tauri-driver`, no
platform WebView driver.

```
e2e-tauri/
├── wdio.conf.ts        # WDIO config: (re)builds the debug app; the service launches it
├── journeys/           # journey specs (mirrors e2e/journeys/); each it() = a checkpoint
│   ├── 01-app-launch-and-shell.spec.ts
│   ├── 02-on-device-model-management.spec.ts   # IPC pull/cancel/install (live); UI checkpoints pending
│   └── 03-code-mode.spec.ts                    # Code mode: opencode install, sessions, the agents
├── coverage.json       # the checkpoint ledger (mirrors e2e/coverage.json)
├── COVERAGE.md         # human-readable coverage (mirrors e2e/COVERAGE.md)
├── scripts/check-journey-coverage.mjs   # validates the ledger + no-regress
├── tsconfig.json       # wdio/mocha types for the config + specs
└── README.md
```

## Coverage ledger

This mirrors the web `e2e/` journey-coverage system: each **checkpoint** in
`coverage.json` maps to an `it(...)` in `journeys/`, and `COVERAGE.md` is the
readable view. Validate it with:

```bash
pnpm test:tauri:coverage                          # spec files exist + summary is consistent
node e2e-tauri/scripts/check-journey-coverage.mjs --no-regress   # + no checkpoint regression vs origin/main
```

Statuses: `covered` (a passing test), `pending` (planned; excluded from the %),
`deprecated` / `not-reproducible`. Coverage % =
`covered / (total − pending − deprecated − not-reproducible)`. The on-device
model journey's download mechanics (pull / cancel / install) run against real
Ollama through the IPC bridge; its picker-UI checkpoints are `pending` the
authenticated harness and are covered meanwhile by the Vitest unit tests.

## Prerequisites

Platform support: **macOS, Linux and Windows** — a display is needed (Linux can
use xvfb, see below).

1. **Node dev deps** (already in `package.json` `devDependencies`)
   ```bash
   pnpm install
   ```
2. **A Rust toolchain.** `wdio.conf.ts` runs `cargo build` in `src-tauri` before
   every run (a no-op when the binary is current) and drives
   `src-tauri/target/debug/ibl-ai-os`. Only a debug build carries the WebDriver
   server, so a release binary cannot be driven.

## Run

```bash
pnpm test:tauri            # any OS with a display
pnpm test:tauri:linux      # Linux headless (CI) — wraps the run in a virtual X server (xvfb)
pnpm test:tauri:macos      # same as test:tauri
pnpm test:tauri:windows    # same as test:tauri
```

They all run the same `wdio.conf.ts`: the service launches the binary once for the
whole run and every spec file attaches a session to it.

`test:tauri:linux` is for headless machines (CI, no display); it is equivalent to:

```bash
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 \
  xvfb-run -a pnpm test:tauri
```

One spec file or one checkpoint:

```bash
pnpm test:tauri --spec e2e-tauri/journeys/02-on-device-model-management.spec.ts
pnpm test:tauri --mochaOpts.grep 'odm-02'
```

## Configuration knobs

- `TAURI_APP_BINARY` — path to a prebuilt **debug** binary (skips the `cargo build`).
- `TAURI_WEBDRIVER_PORT` — the embedded WebDriver port (default 4445).
- `TAURI_E2E_DATA_HOME` — the isolated data dir (default `~/.local/share/iblai-os-test`;
  `pnpm test:tauri:auth:delete` removes it).
- `TAURI_E2E_MODEL` — the model Journey 2 pulls (default `smollm:135m`).
- `TAURI_E2E_USERNAME` / `TAURI_E2E_PASSWORD` in `e2e-tauri/.env.local` — the
  authenticated checkpoints' login.

## Notes

- The shell spec is intentionally resilient (asserts the app boots + renders a
  `<body>`) because the shell can be the online app or the offline fallback
  depending on network/auth. Tighten it once you decide which shell CI targets.
- Journey 2's download checkpoints (odm-02/03/05) need **Ollama running** and
  network access: they drive a real pull of a tiny model (`smollm:135m`, ~92 MB)
  through the app's IPC bridge, cancel it, and assert the install. Cancelling
  bounces the Ollama service, so the suite waits for it to recover between
  checkpoints.
- The run refuses to start while something already answers on the WebDriver
  port (it would silently be the app under test): `pkill -f ibl-ai-os` first.
- macOS: the test app and `tauri dev` share the WKWebView store (same process
  name), so `pnpm test:tauri:auth:delete` does not log you out there — only the
  app's `iblai` dir (opencode, workspaces) moves with `TAURI_E2E_DATA_HOME`.
- macOS: the embedded driver takes over the webview's UI delegate for the run, so
  file pickers and the mic/camera auto-grant are inert during a test.
- A failing checkpoint leaves a screenshot in `e2e-tauri/logs/` (gitignored).
- `e2e-tauri` is excluded from the root `tsconfig.json` (like `e2e`) so the
  WebdriverIO globals don't leak into `pnpm typecheck`; it has its own
  `tsconfig.json`.

## CI matrix (macOS)

`.github/workflows/macos-e2e-tauri.yml` runs the suite on GitHub's macOS runners,
one fresh VM per **machine setup** — the Ollama installs a user's Mac can have
(nothing, Ollama.app running or stopped, the Homebrew formula as a service or
CLI only, a bare CLI in `/usr/local/bin`, no Homebrew at all, Intel) plus a
fresh Mac for the Code journeys. Each row runs `e2e-tauri/ci/macos/<scenario>.sh`,
then Journey 4 and Journey 2 against that setup (`code-fresh`: Journeys 1 and 3).
Same opt-in as the web e2e — the `run-tests` label on a same-repo PR — or by hand:

```bash
gh workflow run macos-e2e-tauri.yml --ref <branch> -f scenarios=app-running,fresh
```

The rows live in `e2e-tauri/ci/macos/matrix.mjs`; a new setup is one script and
one row. Failed checkpoints leave screenshots and the JSON results in the run's
`macos-e2e-<scenario>--<runner>` artifact. The scripts mutate the machine and refuse to run outside a
GitHub-hosted VM; to reproduce a row in a disposable local VM:

```bash
TAURI_E2E_SCENARIO_FORCE=1 bash e2e-tauri/ci/macos/app-running.sh
TAURI_E2E_SCENARIO=app-running pnpm test:tauri --spec e2e-tauri/journeys/04-ollama-setups.spec.ts
```

## PR process (macOS)

The same shape as the web e2e's:

1. **Start.** The `run-tests` label on a same-repo PR runs the full matrix against the
   PR's merge with main. `/retest-macos [scenario…]` (a PR comment) dispatches it for the
   branch **head** instead, for the named rows only, and replaces a run in progress.
2. **Status `macOS E2E`.** Pending while the matrix runs; success when every failure is
   listed in `e2e-tauri/ci/macos/known-failures.json`, failure otherwise. Informative only —
   `pr-gate.yml` / `PR Validation` do not read it.
3. **Comment.** One per run: `### macOS E2E - OK|FAILED|NOT RUN`, the report link
   (`tests.iblai.app/runs/pr-os-<pr>-<run>/macos/index.html`: per-row counts, errors with
   their known reasons, screenshots), the run, the commit, the scenarios, what was tested
   (`os.ibl.ai` production, the app version, the runner labels), failed and new failures.
   A run that produced no report edits one sticky notice instead.
4. **Commands** (write access, same-repo PR; scenario names are checked against main's
   `matrix.mjs`):

   | Command                     | Does                                                        |
   | --------------------------- | ----------------------------------------------------------- |
   | `/retest-macos [scenario…]` | dispatch the matrix (or the named rows) for the branch head |
   | `/status-macos`             | the last runs of the matrix for this PR                     |
   | `/report-macos`             | the latest report comment's link                            |
   | `/cancel-macos`             | cancel queued/running matrix runs and settle the status     |

5. **Known failures.** `known-failures.json`: `"<scenario>"` (or `"*"`) → checkpoint id →
   `{ "reason", "since" }`. The id is the `it()` prefix (`setup-06`), a spec file name for a
   spec that produced no results, or a failed hook's title. Remove an entry once fixed so a
   re-failure turns the status red again.
6. **Retention.** The report lasts 7 days; the `macos-e2e-<scenario>--<runner>` artifacts
   outlive it, and a report rebuilds locally:

   ```bash
   gh run download <run-id> -p 'macos-e2e-*' -D /tmp/report
   MATRIX="$(node e2e-tauri/ci/macos/matrix.mjs | sed -n 's/^matrix=//p')" \
     node e2e-tauri/ci/macos/build-report.mjs /tmp/report   # → summary.json, index.html
   node --test e2e-tauri/ci/macos/build-report.test.mjs     # the builder's self-check
   ```

7. **Gap.** A superseded or cancelled run, or a removed label, leaves the status pending
   until the next run (`/cancel-macos` marks it `error`).
