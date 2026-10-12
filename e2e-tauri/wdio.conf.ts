/// <reference types="@wdio/types" />
/// <reference types="@wdio/globals/types" />
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { config as loadEnvFile } from 'dotenv';
import { SevereServiceError } from 'webdriverio';

/**
 * WebdriverIO end-to-end config for the ibl.ai Tauri desktop app.
 *
 * `@wdio/tauri-service` (embedded provider) spawns the DEBUG binary with
 * WDIO_EMBEDDED_SERVER set; the app then serves W3C WebDriver itself on
 * 127.0.0.1:4445 (`tauri-plugin-wdio-webdriver`, registered in debug builds
 * only — see src-tauri/src/main.rs). Same path on macOS, Linux and Windows:
 * no tauri-driver, no platform WebView driver.
 *
 * Run from the repo root:  pnpm test:tauri
 */

// Load e2e-tauri/.env.local so credentials for the authenticated Journey 2 UI
// pass (TAURI_E2E_USERNAME / TAURI_E2E_PASSWORD) reach the specs. WDIO re-imports
// this config in each spec worker, so the vars land on process.env in both the
// launcher and the workers. (Run from the repo root, as the pnpm scripts do.)
loadEnvFile({ path: resolve(process.cwd(), 'e2e-tauri/.env.local') });

// Isolate the test profile from the real app data by pointing XDG_DATA_HOME at a
// disposable directory; the service spawns the app with this env. On Linux that
// moves the whole app data dir (cookies / localStorage / auth included); on macOS
// and Windows only the app's `iblai` dir (opencode, workspaces) follows it — the
// webview store and Tauri's app-data dir stay at their real locations. Delete it
// to force a fresh login (`pnpm test:tauri:auth:delete`); keep it to reuse the
// saved session (`pnpm test:tauri:auth:save`). Override with TAURI_E2E_DATA_HOME.
const AUTH_STATE_DIR =
  process.env.TAURI_E2E_DATA_HOME ??
  resolve(homedir(), '.local/share/iblai-os-test');
mkdirSync(AUTH_STATE_DIR, { recursive: true });
process.env.XDG_DATA_HOME = AUTH_STATE_DIR;

// Only a debug build carries the embedded WebDriver server, so the binary is
// target/debug — `onPrepare` (re)builds it. Override with TAURI_APP_BINARY (a
// prebuilt debug binary, e.g. a CI artifact). Windows binaries carry `.exe`.
const BIN = process.platform === 'win32' ? 'ibl-ai-os.exe' : 'ibl-ai-os';
const APP_BINARY = resolve(
  process.cwd(),
  process.env.TAURI_APP_BINARY || `src-tauri/target/debug/${BIN}`,
);
// Failure screenshots + JSON results (one wdio-<cid>-json-reporter.json per spec file);
// CI gives every row its own dir under e2e-tauri/logs and uploads the lot.
const LOGS = resolve(
  process.cwd(),
  process.env.TAURI_E2E_LOGS ?? 'e2e-tauri/logs',
);
const STATUS_URL = `http://127.0.0.1:${process.env.TAURI_WEBDRIVER_PORT ?? 4445}/status`;

export const config: WebdriverIO.Config = {
  runner: 'local',

  // Journey specs (mirrors e2e/journeys/). Each `it` is a coverage checkpoint;
  // the ledger lives in coverage.json / COVERAGE.md.
  specs: ['./journeys/**/*.spec.ts'],

  // Embedded mode shares ONE app instance across all spec files.
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'tauri',
      // The service spawns this binary and fills in hostname/port for its
      // embedded WebDriver server.
      'tauri:options': {
        application: APP_BINARY,
      },
      'wdio:maxInstances': 1,
      // `tauri:options` is the service's custom capability, not part of WDIO's
      // standard capability types — cast so the strict config type accepts it.
    } as WebdriverIO.Capabilities,
  ],

  // `embedded` is the default, but only a named provider makes the worker pass
  // browser.execute through untouched. Backend logs: the app's stdout, as the
  // inherited stdio gave us before.
  services: [
    [
      '@wdio/tauri-service',
      { driverProvider: 'embedded', captureBackendLogs: true },
    ],
  ],

  logLevel: 'info',
  // Pulls and installs are awaited inside one WebDriver command; the specs allow
  // such scripts 300 s, so the HTTP side must wait as long or it re-sends them.
  connectionRetryTimeout: 300_000,
  framework: 'mocha',
  reporters: ['spec', ['json', { outputDir: LOGS }]],
  mochaOpts: {
    ui: 'bdd',
    // Cold desktop launch + webview navigation is slow; give it room.
    timeout: 120_000,
  },

  /**
   * A leftover app on the WebDriver port would silently be the one under test;
   * refuse. Then (re)build the debug binary — `cargo build` is a no-op when it
   * is current, and it is the same dev build `tauri dev` makes (no bundle, no
   * signing; the online path is identical). Plain errors thrown here are only
   * logged by the runner; SevereServiceError aborts the run.
   */
  onPrepare: async () => {
    if (
      await fetch(STATUS_URL).then(
        () => true,
        () => false,
      )
    ) {
      throw new SevereServiceError(
        `Something already serves ${STATUS_URL} — kill the leftover ibl-ai-os first.`,
      );
    }
    if (process.env.TAURI_APP_BINARY) return;
    const build = spawnSync('cargo', ['build'], {
      cwd: resolve(process.cwd(), 'src-tauri'),
      stdio: 'inherit',
    });
    if (build.status !== 0 || !existsSync(APP_BINARY)) {
      throw new SevereServiceError(`cargo build did not produce ${APP_BINARY}`);
    }
  },

  // An explicit window switch turns off the service's per-command focus probe,
  // which needs the guest plugin we don't ship (a 5 s timeout per lookup otherwise).
  before: async (_caps, _specs, browser) => {
    await browser.switchToWindow(await browser.getWindowHandle());
  },

  // Screenshot on failure — the only eyes a CI run has.
  afterTest: async (test, _context, { passed }) => {
    if (passed) return;
    mkdirSync(LOGS, { recursive: true });
    const name = test.title.replace(/[^\w.-]+/g, '_').slice(0, 80);
    await browser.saveScreenshot(resolve(LOGS, `${name}.png`)).catch(() => {});
  },
};
