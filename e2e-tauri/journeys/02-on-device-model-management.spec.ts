/// <reference types="@wdio/globals/types" />
import {
  TEST_MODEL,
  TEST_MODEL_BASE,
  invokeCmd,
  pullToCompletion,
  removeTestModel,
  startInFlightDownload,
  waitForOllama,
  type TauriWindow,
} from '../support/ollama';
import { loginIfNeeded } from '../support/login';

/**
 * Journey 2: On-device Model Management
 *
 * The desktop-only local-model flow, driven against the REAL compiled binary
 * through @wdio/tauri-service.
 *
 * The download mechanics (odm-02/03/05) go through the live Tauri IPC bridge
 * (`window.__TAURI__`, exposed via `withGlobalTauri`) using a tiny real model
 * (`smollm:135m`, ~92 MB) so a genuine Ollama pull — its streamed progress
 * events, cancellation, and the resulting install — is exercised end to end
 * without a multi-GB download. This is the layer nothing else reaches: the
 * Playwright suite never launches the desktop binary, and the Vitest tests mock
 * the IPC transport, so only here does the compiled `model_manager.rs` pull path
 * actually run.
 *
 * The picker-UI checkpoints (odm-01 merge, odm-04 one-at-a-time guard, odm-06
 * nav badge) need an authenticated session; they are pending stubs here (Mocha
 * reports them as skipped) and are covered meanwhile by the Vitest hook/component
 * tests. They get real bodies in the UI pass once credentials are wired.
 *
 * Requires locally: Ollama installed + running, and network access to pull
 * `smollm:135m`. Override the model with TAURI_E2E_MODEL.
 */

describe('Journey 2: On-device Model Management', function () {
  // A real pull can take a couple of minutes on a slow network.
  this.timeout(300_000);
  before(async () => {
    // Pulls awaited in-page can run for many seconds; give WebDriver scripts room.
    await browser.setTimeout({ script: 300_000 });
    // Let the shell settle BEFORE injecting any script: the app navigates right
    // after launch, and a script in flight across that loses its result.
    await $('body').waitForExist({
      timeout: 60_000,
      timeoutMsg: 'the app never rendered a <body> in its WebView',
    });
    await browser.pause(5000);
    // Every on-device action rides the Tauri IPC bridge; fail fast and clearly
    // if it never shows up on the WebView.
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

  after(async () => {
    // Leave no artefact behind: remove the model the pull installed. Cancelling
    // bounces Ollama, so wait (best effort) for it to answer before the rm.
    try {
      await waitForOllama(10_000);
    } catch {
      /* Ollama down — can't rm; nothing else to do */
    }
    removeTestModel();
  });

  it('odm-02: a not-installed on-device model starts a real pull with live progress', async () => {
    await waitForOllama();
    removeTestModel(); // force a genuine pull, not an instant fake-complete
    const res = await pullToCompletion(TEST_MODEL);
    if (res.error) throw new Error(`download errored: ${res.error}`);
    // Live progress = Ollama streams many 'downloading' events as bytes arrive.
    const downloading = res.progress.filter((p) => p.status === 'downloading');
    expect(downloading.length).toBeGreaterThan(0);
    expect(res.done).toBe(true);
  });

  it('odm-03: cancelling an in-flight pull leaves the app responsive (no freeze)', async () => {
    await waitForOllama();
    removeTestModel();
    await startInFlightDownload(TEST_MODEL);

    // The freeze regression was the cancel command BLOCKING on a synchronous
    // Ollama restart mid-pull. The fix sets a flag + restarts in a detached
    // thread, so cancel must return promptly...
    const t0 = Date.now();
    await invokeCmd('cancel_model_download');
    expect(Date.now() - t0).toBeLessThan(5000);

    // ...and the app must keep answering IPC (a frozen WebView would hang this
    // until the Mocha timeout). get_os_type never touches Ollama, so it stays
    // valid while the cancel bounces Ollama in the background.
    const os = await invokeCmd<string>('get_os_type');
    expect(['windows', 'macos', 'linux']).toContain(os);
  });

  it('odm-05: a completed pull installs the on-device model (check_ollama_status)', async () => {
    await waitForOllama();

    const isInstalled = async (): Promise<boolean> => {
      const st = await invokeCmd<{ installed_models?: string[] }>(
        'check_ollama_status',
      );
      return (st.installed_models ?? []).some(
        (t) => t.split(':')[0] === TEST_MODEL_BASE,
      );
    };

    if (!(await isInstalled())) {
      const res = await pullToCompletion(TEST_MODEL);
      if (res.error) throw new Error(`download errored: ${res.error}`);
    }

    expect(await isInstalled()).toBe(true);
  });

  // The picker-UI checkpoints need an authenticated session, so they run in a
  // nested suite whose `before` logs in (auth setup on start; a no-op once the
  // session is saved to the isolated profile — reset with
  // `pnpm test:tauri:auth:delete`). They stay OUT of the IPC suite above because
  // driving a real download on the authenticated page makes the app's own
  // download UI react and fight these tests. Pending stubs until the UI pass —
  // the login `before` skips itself without credentials.
  describe('authenticated picker UI', () => {
    before(async function () {
      // The authenticated checkpoints are pending; without credentials there is
      // nothing to log in for.
      if (!process.env.TAURI_E2E_USERNAME) return this.skip();
      await loginIfNeeded();
    });

    it(
      'odm-01: the LLM picker merges on-device models with the provider cloud models in one list',
    );
    it(
      'odm-04: starting a second on-device download while one is in flight shows the "already downloading" guard',
    );
    it('odm-06: the nav-bar on-device badge reflects the selected local model');
  });

  // Pending: needs a harness that occupies 8000/3457 BEFORE launching the
  // binary. Covered meanwhile by the Rust port tests
  // (`pick_port`/`bind_with_fallback`/`chat_base_url`) in
  // `mcp_bridge_manager.rs`, `offline_server.rs` and `model_manager.rs`.
  it(
    'odm-07: busy default ports at launch degrade to allocated ones — the MCP bridge and offline server bind free ports and every consumer follows',
  );
});
