/// <reference types="@wdio/types" />
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { config as loadEnvFile } from 'dotenv';

/**
 * WebdriverIO end-to-end config for the ibl.ai Tauri desktop app, following the
 * official guide: https://webdriver.io/docs/desktop-testing/tauri
 *
 * WDIO drives `tauri-driver` (listens on 127.0.0.1:4444), which proxies WebDriver
 * requests to the platform WebView driver:
 *   - Linux   → `WebKitWebDriver`   (package: webkit2gtk-driver)
 *   - Windows → `msedgedriver`      (matching the installed WebView2 runtime)
 *   - macOS   → NOT supported by tauri-driver (WKWebView has no WebDriver).
 *
 * Prereqs (see e2e-tauri/README.md):
 *   1. `cargo install tauri-driver --locked`
 *   2. the platform WebView driver on PATH (WebKitWebDriver / msedgedriver)
 *   3. a built app binary — see APP_BINARY below.
 *
 * Run from the repo root:  pnpm test:tauri
 */

// Load e2e-tauri/.env.local so credentials for the authenticated Journey 2 UI
// pass (TAURI_E2E_USERNAME / TAURI_E2E_PASSWORD) reach the specs. WDIO re-imports
// this config in each spec worker, so the vars land on process.env in both the
// launcher and the workers. (Run from the repo root, as the pnpm scripts do.)
loadEnvFile({ path: resolve(process.cwd(), 'e2e-tauri/.env.local') });

// Isolate the test webview profile (cookies / localStorage / auth) from the real
// app data dir by pointing XDG_DATA_HOME at a disposable directory — the app's
// data then lives under <AUTH_STATE_DIR>/ai.ibl.mentorai instead of
// ~/.local/share/ai.ibl.mentorai, so tests never touch your real session. Delete
// it to force a fresh login (`pnpm test:tauri:auth:delete`); keep it to reuse the
// saved session (`pnpm test:tauri:auth:save`). Every child (tauri-driver → WebView
// driver → app) inherits this env. Override the location with TAURI_E2E_DATA_HOME.
const AUTH_STATE_DIR =
  process.env.TAURI_E2E_DATA_HOME ??
  resolve(homedir(), '.local/share/iblai-os-test');
mkdirSync(AUTH_STATE_DIR, { recursive: true });
process.env.XDG_DATA_HOME = AUTH_STATE_DIR;

// The app binary bundles the built frontend (tauri.conf.json `frontendDist`).
// Prefer an existing build (release, then debug); if nothing is built yet, use
// the debug path — `onPrepare` builds it on demand. Override with
// TAURI_APP_BINARY.
// Windows binaries carry the `.exe` extension.
const BIN = process.platform === 'win32' ? 'ibl-ai-os.exe' : 'ibl-ai-os';
const BINARY_CANDIDATES = [
  `src-tauri/target/release/${BIN}`,
  `src-tauri/target/debug/${BIN}`,
].map((p) => resolve(process.cwd(), p));

const APP_BINARY = process.env.TAURI_APP_BINARY
  ? resolve(process.cwd(), process.env.TAURI_APP_BINARY)
  : (BINARY_CANDIDATES.find(existsSync) ?? BINARY_CANDIDATES[1]);

// WebKitWebDriver launches the app with a sanitised environment, so exporting
// XDG_DATA_HOME to tauri-driver never reaches the app — it keeps writing to the
// real ~/.local/share/ai.ibl.mentorai. Force the isolated profile with a tiny
// launcher shim that sets the env and exec's the real binary (exec keeps the same
// pid, so the process-group kill in afterSession still reaps it). Linux only;
// Windows uses %APPDATA% and is launched directly.
const APP_LAUNCH_TARGET = (() => {
  if (process.platform === 'win32') return APP_BINARY;
  const shim = resolve(tmpdir(), 'iblai-os-e2e-app-launch.sh');
  writeFileSync(
    shim,
    `#!/bin/sh\nexport XDG_DATA_HOME=${JSON.stringify(AUTH_STATE_DIR)}\nexec ${JSON.stringify(APP_BINARY)} "$@"\n`,
  );
  chmodSync(shim, 0o755);
  return shim;
})();

// The `tauri-driver` child process, spawned per session and killed after it.
let tauriDriver: ChildProcess;

export const config: WebdriverIO.Config = {
  runner: 'local',

  // tauri-driver's default listen address.
  hostname: '127.0.0.1',
  port: 4444,
  path: '/',

  // Journey specs (mirrors e2e/journeys/). Each `it` is a coverage checkpoint;
  // the ledger lives in coverage.json / COVERAGE.md.
  specs: ['./journeys/**/*.spec.ts'],

  // One desktop window / WebDriver session at a time.
  maxInstances: 1,
  capabilities: [
    {
      // tauri-driver reads this and launches the app under the native WebDriver.
      // Points at the XDG_DATA_HOME shim so the app uses the isolated profile.
      'tauri:options': {
        application: APP_LAUNCH_TARGET,
      },
      'wdio:maxInstances': 1,
      // `tauri:options` is tauri-driver's custom capability, not part of WDIO's
      // standard capability types — cast so the strict config type accepts it.
    } as WebdriverIO.Capabilities,
  ],

  logLevel: 'info',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    // Cold desktop launch + webview navigation is slow; give it room.
    timeout: 120_000,
  },

  /**
   * Build the app on demand if no binary exists yet (the guide auto-builds too).
   * This app's binary embeds a separately-built frontend, so a bare `cargo build`
   * is insufficient — use the repo's debug build (`pnpm build && cargo tauri build
   * --debug`), which produces `target/debug/ibl-ai-os`. Skipped entirely when a
   * binary already exists, so normal runs don't pay the build cost.
   *
   * The build's exit code is ignored (a failing *bundle* step still leaves a
   * usable binary); success is decided by whether the binary now exists.
   */
  onPrepare: () => {
    if (existsSync(APP_BINARY)) return;
    console.log(
      `[e2e] no app binary at ${APP_BINARY}\n` +
        `[e2e] building it (pnpm tauri:build:debug) — this can take several minutes…`,
    );
    spawnSync('pnpm', ['tauri:build:debug'], { stdio: 'inherit' });
    if (!existsSync(APP_BINARY)) {
      throw new Error(
        `Build did not produce ${APP_BINARY}.\n` +
          `Build it manually and retry:\n` +
          `  pnpm tauri:build:debug     # debug (target/debug/ibl-ai-os)\n` +
          `  pnpm tauri build           # release (target/release/ibl-ai-os)\n`,
      );
    }
  },

  /**
   * Start `tauri-driver` before the session so it can proxy WebDriver requests,
   * and stop it after (per the guide). A missing binary surfaces a clear hint
   * instead of an opaque connection failure.
   */
  beforeSession: () => {
    // `detached` puts tauri-driver in its own process group so we can reap the
    // whole tree (tauri-driver → native WebView driver → the app + its sidecars)
    // in afterSession — otherwise those children linger and keep the runner from
    // exiting after the tests finish.
    tauriDriver = spawn('tauri-driver', [], {
      stdio: ['ignore', 'inherit', 'inherit'],
      detached: true,
      // Redirect the app's data dir (auth state) into the isolated profile.
      env: { ...process.env, XDG_DATA_HOME: AUTH_STATE_DIR },
    });
    tauriDriver.on('error', (err) => {
      console.error(
        '\n[tauri-driver] failed to start — is it installed and on PATH?\n' +
          '  cargo install tauri-driver --locked\n',
        err,
      );
    });
  },
  afterSession: () => {
    if (!tauriDriver?.pid) return;
    try {
      // Negative pid → kill the whole process group.
      process.kill(-tauriDriver.pid, 'SIGKILL');
    } catch {
      tauriDriver.kill('SIGKILL');
    }
  },
};
