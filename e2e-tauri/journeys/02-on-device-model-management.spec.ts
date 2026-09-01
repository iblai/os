/// <reference types="@wdio/globals/types" />
import { spawnSync } from 'node:child_process';
import { loginIfNeeded } from '../support/login';

/**
 * Journey 2: On-device Model Management
 *
 * The desktop-only local-model flow, driven against the REAL compiled binary
 * through tauri-driver.
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

const TEST_MODEL = process.env.TAURI_E2E_MODEL ?? 'smollm:135m';
const TEST_MODEL_BASE = TEST_MODEL.split(':')[0];
const OLLAMA_URL = 'http://localhost:11434';

// Tauri global (withGlobalTauri) shapes — used only for casts inside the
// injected browser functions; the annotations are erased before the function is
// serialised to the WebView.
type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;
type Listen = (
  event: string,
  cb: (e: { payload: unknown }) => void,
) => Promise<() => void>;
interface TauriWindow {
  __TAURI__?: { core?: { invoke?: Invoke }; event?: { listen?: Listen } };
}
type ProgressEvent = { status?: string; percentage?: number };
interface PullResult {
  progress: ProgressEvent[];
  done: boolean;
  error: string | null;
}

/** Poll Ollama's HTTP API until it answers — it gets bounced on cancel. */
async function waitForOllama(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/version`, {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error('Ollama did not become reachable on :11434 within timeout');
}

/** Remove the test model host-side so the next pull is real, not a fake-complete. */
function removeTestModel(): void {
  spawnSync('ollama', ['rm', TEST_MODEL], { stdio: 'ignore' });
}

/** Invoke a Tauri command in the WebView and bring back its result. */
async function invokeCmd<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const res = (await browser.execute(
    async (cmd: string, a: Record<string, unknown> | null) => {
      const invoke = (window as unknown as TauriWindow).__TAURI__?.core?.invoke;
      if (!invoke) {
        return { ok: false, error: 'window.__TAURI__.core.invoke unavailable' };
      }
      try {
        return { ok: true, value: await invoke(cmd, a ?? undefined) };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    command,
    args ?? null,
  )) as { ok: boolean; value?: T; error?: string };
  if (!res.ok) throw new Error(`invoke('${command}'): ${res.error}`);
  return res.value as T;
}

/**
 * Pull a model to completion in ONE execute, collecting every
 * `model:download-progress` payload, then return them. Awaiting the whole pull
 * (rather than fire-and-forget + poll) keeps the WebView script alive so no
 * progress event is missed — the pull's Rust command resolves only when it
 * truly finishes.
 */
async function pullToCompletion(model: string): Promise<PullResult> {
  return (await browser.execute(async (m: string) => {
    const t = (window as unknown as TauriWindow).__TAURI__;
    const invoke = t?.core?.invoke;
    const listen = t?.event?.listen;
    if (!invoke || !listen) {
      return {
        progress: [],
        done: false,
        error: 'window.__TAURI__ unavailable',
      };
    }
    const progress: ProgressEvent[] = [];
    const un = await listen('model:download-progress', (e) => {
      progress.push(e.payload as ProgressEvent);
    });
    let done = false;
    let error: string | null = null;
    try {
      await invoke('download_model', { model: m });
      done = true;
    } catch (err) {
      error = String(err);
    }
    un();
    return { progress, done, error };
  }, model)) as PullResult;
}

/**
 * Start a pull and wait — INSIDE the page — until the first progress event lands
 * (up to `settleMs`), so the pull is genuinely in flight when we return, then
 * leave it running in the background for the caller to cancel. Returns true if a
 * live pull was confirmed.
 */
async function startInFlightDownload(
  model: string,
  settleMs = 10_000,
): Promise<boolean> {
  return (await browser.execute(
    async (m: string, budget: number) => {
      const t = (window as unknown as TauriWindow).__TAURI__;
      const invoke = t?.core?.invoke;
      const listen = t?.event?.listen;
      if (!invoke || !listen) return false;
      const seen = { count: 0, done: false, error: false };
      await listen('model:download-progress', () => {
        seen.count += 1;
      });
      invoke('download_model', { model: m })
        .then(() => {
          seen.done = true;
        })
        .catch(() => {
          seen.error = true;
        });
      const start = performance.now();
      while (performance.now() - start < budget) {
        if (seen.count > 0 || seen.done || seen.error) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      return seen.count > 0;
    },
    model,
    settleMs,
  )) as boolean;
}

describe('Journey 2: On-device Model Management', () => {
  before(async () => {
    // Pulls awaited in-page can run for many seconds; give WebDriver scripts room.
    await browser.setTimeout({ script: 300_000 });
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
  // Mocha skips the login `before` while every test here is pending.
  describe('authenticated picker UI', () => {
    before(async () => {
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
