/// <reference types="@wdio/globals/types" />
import { existsSync } from 'node:fs';
import {
  TEST_MODEL,
  invokeCmd,
  pullToCompletion,
  removeTestModel,
  startInFlightDownload,
  waitForOllama,
  type TauriWindow,
} from '../support/ollama';

/**
 * Journey 4: Ollama on every macOS setup
 *
 * Runs only under TAURI_E2E_SCENARIO. The CI matrix
 * (.github/workflows/macos-e2e-tauri.yml) puts a fresh macOS runner into one
 * machine setup (e2e-tauri/ci/macos/<scenario>.sh) and then drives the app's
 * Ollama lifecycle against it: what `check_ollama_status` sees, which install
 * route `install_ollama` takes, and whether pull / cancel / stop survive that
 * setup. Without the env the whole journey is skipped, so a local
 * `pnpm test:tauri` is unchanged.
 */

interface Expectation {
  installed: boolean;
  running: boolean;
  /** The route `install_ollama` must take when nothing is installed yet. */
  route?: 'brew' | 'dmg';
}

const SCENARIOS: Record<string, Expectation> = {
  fresh: { installed: false, running: false, route: 'brew' },
  'fresh-intel': { installed: false, running: false, route: 'brew' },
  'fresh-no-brew': { installed: false, running: false, route: 'dmg' },
  'app-running': { installed: true, running: true },
  'app-stopped': { installed: true, running: false },
  'brew-service': { installed: true, running: true },
  'brew-cli': { installed: true, running: false },
  'cli-usr-local': { installed: true, running: false },
};
const SCENARIO = process.env.TAURI_E2E_SCENARIO;
const EXPECT = SCENARIO ? SCENARIOS[SCENARIO] : undefined;

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  model_installed: boolean;
  installed_models: string[];
}
interface InstallResult {
  done: boolean;
  value?: string;
  error?: string;
}
type E2EWindow = TauriWindow & { __e2eInstall?: InstallResult };

const OLLAMA_APP = '/Applications/Ollama.app';
const BREW_CLIS = ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama'];

/**
 * `install_ollama` can run for many minutes (a fresh Intel Mac builds the
 * Homebrew formula from source), longer than any single WebDriver round trip
 * should live — so fire it in-page and poll its result with short executes.
 */
async function installOllama(timeoutMs: number): Promise<InstallResult> {
  await browser.execute(() => {
    const w = window as unknown as E2EWindow;
    w.__e2eInstall = { done: false };
    w.__TAURI__!.core!.invoke!('install_ollama').then(
      (value) => {
        w.__e2eInstall = { done: true, value: String(value) };
      },
      (err) => {
        w.__e2eInstall = { done: true, error: String(err) };
      },
    );
  });
  return browser.waitUntil(
    async () => {
      const r = (await browser.execute(
        () => (window as unknown as E2EWindow).__e2eInstall,
      )) as InstallResult | undefined;
      return r?.done ? r : false;
    },
    {
      timeout: timeoutMs,
      interval: 5_000,
      timeoutMsg: `install_ollama did not finish within ${timeoutMs / 60_000} min`,
    },
  );
}

describe('Journey 4: Ollama on every macOS setup', () => {
  before(async function () {
    if (!SCENARIO) return this.skip();
    if (!EXPECT) {
      throw new Error(
        `unknown TAURI_E2E_SCENARIO "${SCENARIO}" — add it to SCENARIOS`,
      );
    }
    await browser.setTimeout({ script: 300_000 });
    // Let the shell settle BEFORE injecting any script: the app navigates right
    // after launch, and a script in flight across that loses its result.
    await $('body').waitForExist({
      timeout: 60_000,
      timeoutMsg: 'the app never rendered a <body> in its WebView',
    });
    await browser.pause(5000);
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            typeof (window as unknown as TauriWindow).__TAURI__?.core
              ?.invoke === 'function',
        ),
      {
        timeout: 30_000,
        timeoutMsg:
          'window.__TAURI__ (withGlobalTauri) never appeared on the WebView',
      },
    );
  });

  it("setup-01: check_ollama_status reports the scenario's starting state", async () => {
    const status = await invokeCmd<OllamaStatus>('check_ollama_status');
    expect(status.installed).toBe(EXPECT!.installed);
    expect(status.running).toBe(EXPECT!.running);
  });

  it('setup-02: install_ollama resolves and Ollama answers on :11434', async function () {
    const budget = 60 * 60_000;
    this.timeout(budget + 120_000);
    const result = await installOllama(budget);
    expect(result.error).toBeUndefined();
    expect(result.value).toMatch(/installed/);
    await waitForOllama(60_000);
    const status = await invokeCmd<OllamaStatus>('check_ollama_status');
    expect(status.installed).toBe(true);
    expect(status.running).toBe(true);
  });

  it('setup-03: the install took the documented route', function () {
    // Already installed: nothing was installed, so there is no route to check.
    if (!EXPECT!.route) return this.skip();
    if (EXPECT!.route === 'brew') {
      expect(BREW_CLIS.some((p) => existsSync(p))).toBe(true);
      expect(existsSync(OLLAMA_APP)).toBe(false);
    } else {
      expect(existsSync(OLLAMA_APP)).toBe(true);
    }
  });

  it('setup-04: a pull completes on this setup', async function () {
    this.timeout(600_000);
    removeTestModel();
    const result = await pullToCompletion(TEST_MODEL);
    expect(result.error).toBeNull();
    expect(result.done).toBe(true);
  });

  it('setup-05: the cancel bounce leaves Ollama reachable', async function () {
    this.timeout(300_000);
    removeTestModel();
    await startInFlightDownload(TEST_MODEL);
    await invokeCmd('cancel_model_download');
    await waitForOllama(30_000);
  });

  it('setup-06: stop_ollama leaves it stopped, and it starts again', async function () {
    this.timeout(300_000);
    removeTestModel();
    await invokeCmd('stop_ollama');
    const status = await invokeCmd<OllamaStatus>('check_ollama_status');
    expect(status.running).toBe(false);
    // Bring it back for the journeys that run after this one.
    const result = await installOllama(120_000);
    expect(result.error).toBeUndefined();
    await waitForOllama(60_000);
  });
});
