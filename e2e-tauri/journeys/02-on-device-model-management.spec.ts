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
import {
  OTHER_MODEL,
  UI_MODEL,
  advancedSwitchChecked,
  badgeText,
  closeDialogs,
  localModelsEnabled,
  localRow,
  openPicker,
  pickerButton,
  rowStatus,
  setLocalModelsEnabled,
} from '../support/local-models';

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
 * The picker-UI checkpoints (odm-01/04/06/08) drive the signed-in app the way a
 * user does: the nav-bar's LLM Model Selector, the SDK's LLM Selection dialog,
 * the Local Models switch in Profile → Advanced. They need TAURI_E2E_USERNAME /
 * _PASSWORD (CI: the staging account) and skip without them. odm-08 pins what
 * the product must do when a model is picked with Local Models off — turn it on
 * and set Ollama up — and stays red until it does.
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

  // The picker-UI checkpoints need a signed-in session, so they run in a nested
  // suite whose `before` logs in (a no-op once the session is saved to the
  // isolated profile — reset with `pnpm test:tauri:auth:delete`). They stay OUT
  // of the IPC suite above because driving a real download on the signed-in
  // page makes the app's own download UI react and fight those tests. The
  // `before` skips the suite without credentials.
  describe('authenticated picker UI', function () {
    // One real catalog pull (Llama 3.2, 2 GB); odm-06 waits for it to finish.
    this.timeout(720_000);
    const live = ['starting', 'downloading', 'installed', 'selected'];
    // Rejects inside waitUntil, so a pull that dies fails fast with its reason.
    const liveOrThrow = async (): Promise<boolean> => {
      const status = await rowStatus(UI_MODEL.name);
      if (status === 'error') {
        const why = await localRow(UI_MODEL.name).getAttribute('title');
        throw new Error(`the ${UI_MODEL.name} pull errored: ${why}`);
      }
      return live.includes(status ?? '');
    };

    before(async function () {
      if (!process.env.TAURI_E2E_USERNAME) return this.skip();
      await loginIfNeeded();
      await pickerButton().waitForExist({
        timeout: 60_000,
        timeoutMsg: 'the chat page never showed its LLM Model Selector',
      });
      removeTestModel(UI_MODEL.id); // the pick below must need a real pull
      await setLocalModelsEnabled(false);
    });

    after(async () => {
      await closeDialogs();
      await setLocalModelsEnabled(false);
      removeTestModel(UI_MODEL.id);
    });

    it('odm-01: the picker lists the on-device models whether Local Models is off or on', async () => {
      await setLocalModelsEnabled(false);
      await openPicker(UI_MODEL.provider);
      await expect(localRow(UI_MODEL.name)).toBeExisting();
      await closeDialogs();

      await setLocalModelsEnabled(true);
      await openPicker(UI_MODEL.provider);
      await expect(localRow(UI_MODEL.name)).toBeExisting();
      await closeDialogs();
      await setLocalModelsEnabled(false);
    });

    it('odm-08: picking an on-device model turns Local Models on and sets Ollama up for its pull', async () => {
      await setLocalModelsEnabled(false);
      await openPicker(UI_MODEL.provider);
      expect(await rowStatus(UI_MODEL.name)).toBe('not-installed');
      await localRow(UI_MODEL.name).click();

      // The flag flips on the pick itself, not once the pull lands: the badge,
      // the Advanced switch and chat routing follow it.
      await browser.waitUntil(
        async () => (await localModelsEnabled()) === 'true',
        {
          timeout: 10_000,
          timeoutMsg:
            'picking an on-device model left Local Models off (ibl_local_llm_enabled is not "true")',
        },
      );
      expect(await badgeText()).toContain(UI_MODEL.name);
      expect(await advancedSwitchChecked()).toBe('true');
      await closeDialogs();

      // The setup the toggle stands for: the manager answers and the pull runs.
      await waitForOllama(120_000);
      await openPicker(UI_MODEL.provider);
      await browser.waitUntil(liveOrThrow, {
        timeout: 60_000,
        timeoutMsg: `the ${UI_MODEL.name} row never started downloading`,
      });
    });

    it('odm-04: picking another on-device model mid-pull shows the "already downloading" notice', async function () {
      await openPicker(UI_MODEL.provider);
      const status = await rowStatus(UI_MODEL.name);
      if (status !== 'starting' && status !== 'downloading') {
        console.log(
          `[e2e] odm-04 skipped: no ${UI_MODEL.name} pull in flight (${status})`,
        );
        return this.skip();
      }

      await openPicker(OTHER_MODEL.provider);
      await localRow(OTHER_MODEL.name).click();
      const notice = $('[role="alertdialog"]');
      await notice.waitForExist({
        timeout: 10_000,
        timeoutMsg: 'no "already downloading" notice came up',
      });
      const text = await notice.getText();
      expect(text).toContain('A model is already downloading');
      expect(text).toContain(UI_MODEL.name);
      await $(
        '//*[@role="alertdialog"]//button[normalize-space(.)="Got It"]',
      ).click();
      await notice.waitForExist({ reverse: true, timeout: 5_000 });
      expect(await rowStatus(OTHER_MODEL.name)).toBe('not-installed');
      await closeDialogs();
    });

    it('odm-06: selecting the installed model marks it in use and the nav-bar badge shows it', async function () {
      await openPicker(UI_MODEL.provider);
      if (!live.includes((await rowStatus(UI_MODEL.name)) ?? '')) {
        console.log(
          `[e2e] odm-06 skipped: ${UI_MODEL.name} never started installing`,
        );
        return this.skip();
      }
      await browser.waitUntil(
        async () =>
          (await liveOrThrow()) &&
          ['installed', 'selected'].includes(
            (await rowStatus(UI_MODEL.name)) ?? '',
          ),
        {
          timeout: 600_000,
          interval: 5_000,
          timeoutMsg: `the ${UI_MODEL.name} pull never finished`,
        },
      );

      if ((await rowStatus(UI_MODEL.name)) !== 'selected') {
        await localRow(UI_MODEL.name).click();
      }
      await browser.waitUntil(
        async () => (await rowStatus(UI_MODEL.name)) === 'selected',
        {
          timeout: 10_000,
          timeoutMsg: 'the installed row never became the selected one',
        },
      );
      expect(await localModelsEnabled()).toBe('true');
      await closeDialogs();
      expect(await badgeText()).toContain(UI_MODEL.name);
    });
  });

  // Pending: needs a harness that occupies 8000/3457 BEFORE launching the
  // binary. Covered meanwhile by the Rust port tests
  // (`pick_port`/`bind_with_fallback`/`chat_base_url`) in
  // `mcp_bridge_manager.rs`, `offline_server.rs` and `model_manager.rs`.
  it(
    'odm-07: busy default ports at launch degrade to allocated ones — the MCP bridge and offline server bind free ports and every consumer follows',
  );
});
