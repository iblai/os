# Tauri desktop e2e (WebdriverIO)

End-to-end tests that drive the **built desktop binary** through
[`tauri-driver`](https://webdriver.io/docs/desktop-testing/tauri) — a layer the
Playwright suite (`e2e/`) and the Vitest unit tests don't cover. WDIO talks to
`tauri-driver` (127.0.0.1:4444), which proxies WebDriver to the platform WebView
driver.

```
e2e-tauri/
├── wdio.conf.ts        # WDIO config: builds/launches the app, spawns/kills tauri-driver
├── journeys/           # journey specs (mirrors e2e/journeys/); each it() = a checkpoint
│   ├── 01-app-launch-and-shell.spec.ts
│   └── 02-on-device-model-management.spec.ts   # IPC pull/cancel/install (live); UI checkpoints pending
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

Platform support: **Linux and Windows only** — `tauri-driver` cannot drive
macOS/WKWebView.

1. **`tauri-driver`**
   ```bash
   cargo install tauri-driver --locked
   ```
2. **Platform WebView driver on `PATH`**
   - Linux: `WebKitWebDriver` (Debian/Ubuntu: `apt install webkit2gtk-driver`) —
     already present at `/bin/WebKitWebDriver` on this machine.
   - Windows: `msedgedriver` matching the installed WebView2 runtime.
3. **Node dev deps** (already in `package.json` `devDependencies`)
   ```bash
   pnpm install
   ```
4. **A built app binary** — _optional_. `pnpm test:tauri` builds a debug binary
   automatically (`pnpm tauri:build:debug`) on first run if none exists (this can
   take several minutes). To pre-build, or to use a release binary:
   ```bash
   pnpm tauri:build:debug      # debug   → src-tauri/target/debug/ibl-ai-os
   pnpm tauri build            # release → src-tauri/target/release/ibl-ai-os
   ```

## Run

```bash
pnpm test:tauri            # Linux or Windows (with a display) — picks the platform WebView driver
pnpm test:tauri:windows    # Windows (needs msedgedriver on PATH); same runner as above
pnpm test:tauri:linux      # Linux headless (CI) — wraps the run in a virtual X server (xvfb)
pnpm test:tauri:macos      # errors out — tauri-driver has no macOS support
```

They all run the same `wdio.conf.ts`; the config resolves the platform binary
(`ibl-ai-os` / `ibl-ai-os.exe`) and tauri-driver selects the native driver
(`WebKitWebDriver` on Linux, `msedgedriver` on Windows). macOS is guarded because
WKWebView exposes no WebDriver — run those tests on Linux or Windows CI instead.

`test:tauri:linux` is for headless machines (CI, no display); it is equivalent to:

```bash
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 \
  xvfb-run -a pnpm test:tauri
```

## Configuration knobs

- `TAURI_APP_BINARY` — absolute/relative path to the app binary to launch
  (defaults to `src-tauri/target/release/ibl-ai-os`).
- Specs: `e2e-tauri/specs/**/*.e2e.ts`. Add app-specific journeys there; the
  smoke test documents the selector pattern.

## Notes

- The spec is intentionally resilient (asserts the app boots + renders a
  `<body>`) because the shell can be the online app or the offline fallback
  depending on network/auth. Tighten it once you decide which shell CI targets.
- Journey 2's download checkpoints (odm-02/03/05) need **Ollama running** and
  network access: they drive a real pull of a tiny model (`smollm:135m`, ~92 MB)
  through the app's IPC bridge, cancel it, and assert the install. Override the
  model with `TAURI_E2E_MODEL`. Cancelling bounces the Ollama service, so the
  suite waits for it to recover between checkpoints.
- `e2e-tauri` is excluded from the root `tsconfig.json` (like `e2e`) so the
  WebdriverIO globals don't leak into `pnpm typecheck`; it has its own
  `tsconfig.json`.
