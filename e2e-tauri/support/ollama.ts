/// <reference types="@wdio/globals/types" />
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Ollama helpers shared by the on-device journeys: the HTTP probe, the host-side
 * CLI, and the in-page pull drivers that ride the Tauri IPC bridge
 * (`window.__TAURI__`, exposed via `withGlobalTauri`).
 */

export const TEST_MODEL = process.env.TAURI_E2E_MODEL ?? 'smollm:135m';
export const TEST_MODEL_BASE = TEST_MODEL.split(':')[0];
export const OLLAMA_URL = 'http://localhost:11434';

// Tauri global (withGlobalTauri) shapes — used only for casts inside the
// injected browser functions; the annotations are erased before the function is
// serialised to the WebView.
type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;
type Listen = (
  event: string,
  cb: (e: { payload: unknown }) => void,
) => Promise<() => void>;
export interface TauriWindow {
  __TAURI__?: { core?: { invoke?: Invoke }; event?: { listen?: Listen } };
}
export type ProgressEvent = { status?: string; percentage?: number };
export interface PullResult {
  progress: ProgressEvent[];
  done: boolean;
  error: string | null;
}

/** Poll Ollama's HTTP API until it answers — it gets bounced on cancel. */
export async function waitForOllama(timeoutMs = 30_000): Promise<void> {
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

/** The `ollama` CLI as the app finds it: its three candidates, then the .app bundle's. */
export const OLLAMA_CLI =
  [
    '/opt/homebrew/bin/ollama',
    '/usr/local/bin/ollama',
    '/Applications/Ollama.app/Contents/Resources/ollama',
  ].find(existsSync) ?? 'ollama';

/** Remove a model host-side so the next pull is real, not a fake-complete. */
export function removeTestModel(model = TEST_MODEL): void {
  spawnSync(OLLAMA_CLI, ['rm', model], { stdio: 'ignore' });
}

/** Invoke a Tauri command in the WebView and bring back its result. */
export async function invokeCmd<T>(
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
export async function pullToCompletion(model: string): Promise<PullResult> {
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
export async function startInFlightDownload(
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
