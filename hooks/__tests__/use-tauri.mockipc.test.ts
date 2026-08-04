/**
 * `useTauri` — Tauri IPC unit tests using the official Tauri v2 mocking guide:
 * https://v2.tauri.app/develop/tests/mocking/
 *
 * These complement `use-tauri.test.ts` (which `vi.mock`s the `@tauri-apps/api`
 * modules) by driving the REAL Tauri core transport: `mockIPC(cb)` installs a
 * fake `window.__TAURI_INTERNALS__.invoke`, and `useTauri`'s synchronous path
 * reads that global directly — so a mocked command flows straight through
 * `useTauri().invoke`, exactly as it would against a real backend. `clearMocks()`
 * (in `afterEach`, per the guide) tears the transport down between tests, and
 * `vi.spyOn` asserts the forwarded command + args (the guide's spy pattern).
 *
 * Scope notes:
 *  - `useTauri().listen` falls back to a dynamic `import('@tauri-apps/api/event')`
 *    that `vitest.config.ts` aliases to a no-op stub, so `mockIPC`'s event
 *    mocking can't reach it. The listen case injects a fake `event.listen` onto
 *    the Tauri global (the same seam the sync path reads) to exercise the
 *    wrapper's payload-unwrapping.
 *  - `clearMocks()` empties `__TAURI_INTERNALS__` but leaves the object behind
 *    (which would leak `isTauriApp() === true` into the "no Tauri" case), so we
 *    drop the globals outright in `beforeEach` and let `mockIPC` recreate them.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest';
import { renderHook } from '@testing-library/react';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

import { useTauri } from '../use-tauri';
import { TAURI_COMMANDS as C } from '@/types/tauri';

interface TauriInternals {
  invoke: (cmd: string, args?: unknown, options?: unknown) => Promise<unknown>;
  event?: { listen: unknown };
}

/** The Tauri global `mockIPC` installs; only present after `mockIPC(...)`. */
const internals = (): TauriInternals =>
  (window as unknown as { __TAURI_INTERNALS__: TauriInternals })
    .__TAURI_INTERNALS__;

const dropTauriGlobals = (): void => {
  const w = window as unknown as Record<string, unknown>;
  delete w.__TAURI_INTERNALS__;
  delete w.__TAURI__;
};

// Per the guide: `mockIPC` registers IPC callbacks via `crypto.getRandomValues`.
// jsdom 26 ships WebCrypto so this is a no-op there; it only fills the gap on
// older environments (and keeps this suite robust if a Channel/event-plugin test
// is added later).
beforeAll(() => {
  if (!globalThis.crypto?.getRandomValues) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (buf: Uint32Array) => {
          for (let i = 0; i < buf.length; i++) {
            buf[i] = Math.floor(Math.random() * 0xffffffff);
          }
          return buf;
        },
      },
    });
  }
});

// Drop the Tauri globals and silence `useTauri`'s `[useTauri]` debug logs so the
// test output stays clean (matching the console handling in use-tauri.test.ts).
beforeEach(() => {
  dropTauriGlobals();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  clearMocks();
  vi.restoreAllMocks();
});

describe('useTauri — Tauri IPC mocking (mockIPC)', () => {
  it('is available and resolves invoke through the mocked IPC transport', async () => {
    const ollamaStatus = {
      installed: true,
      running: true,
      model_installed: false,
      installed_models: ['llama3.2:latest'],
    };
    mockIPC((cmd) => (cmd === C.CHECK_OLLAMA_STATUS ? ollamaStatus : null));

    const { result } = renderHook(() => useTauri());

    expect(result.current.isAvailable).toBe(true);
    await expect(result.current.invoke(C.CHECK_OLLAMA_STATUS)).resolves.toEqual(
      ollamaStatus,
    );
  });

  it('forwards the exact command + args to the internal invoke (spy)', async () => {
    mockIPC(() => undefined);
    // Spy BEFORE render: the hook captures `__TAURI_INTERNALS__.invoke` in its
    // synchronous initializer, so the spy must already be the installed ref.
    const spy = vi.spyOn(internals(), 'invoke');

    const { result } = renderHook(() => useTauri());
    await result.current.invoke(C.DOWNLOAD_MODEL, { model: 'granite4.1:8b' });

    expect(spy).toHaveBeenCalledWith(C.DOWNLOAD_MODEL, {
      model: 'granite4.1:8b',
    });
  });

  it('forwards a command with no args', async () => {
    mockIPC(() => 'linux');
    const spy = vi.spyOn(internals(), 'invoke');

    const { result } = renderHook(() => useTauri());
    await expect(result.current.invoke(C.GET_OS_TYPE)).resolves.toBe('linux');

    expect(spy).toHaveBeenCalledWith(C.GET_OS_TYPE, undefined);
  });

  it('supports async mock handlers that return a Promise', async () => {
    const memory = { ram_total: 16, vram_total: 8 };
    mockIPC(async (cmd) =>
      cmd === C.GET_SYSTEM_MEMORY ? Promise.resolve(memory) : null,
    );

    const { result } = renderHook(() => useTauri());
    await expect(result.current.invoke(C.GET_SYSTEM_MEMORY)).resolves.toEqual(
      memory,
    );
  });

  it('rejects when the mocked command throws', async () => {
    mockIPC((cmd) => {
      if (cmd === C.INSTALL_OLLAMA) throw new Error('install failed');
      return null;
    });

    const { result } = renderHook(() => useTauri());
    await expect(result.current.invoke(C.INSTALL_OLLAMA)).rejects.toThrow(
      'install failed',
    );
  });

  it('reports unavailable and rejects invoke with no Tauri transport', async () => {
    // No `mockIPC` this test → no `__TAURI_INTERNALS__` (dropped in beforeEach).
    const { result } = renderHook(() => useTauri());

    expect(result.current.isAvailable).toBe(false);
    await expect(result.current.invoke(C.CANCEL_DOWNLOAD)).rejects.toThrow(
      'Tauri is not available',
    );
  });

  it('unwraps event payloads through listen', async () => {
    const unlisten = vi.fn();
    const rawListen = vi.fn(
      async (_event: string, _handler: (e: { payload: unknown }) => void) =>
        unlisten,
    );
    mockIPC(() => null); // installs __TAURI_INTERNALS__.invoke → isAvailable
    internals().event = { listen: rawListen };

    const { result } = renderHook(() => useTauri());
    const handler = vi.fn();
    const off = await result.current.listen('model:download-progress', handler);

    // Registered against the underlying listen with a wrapper function...
    expect(rawListen).toHaveBeenCalledWith(
      'model:download-progress',
      expect.any(Function),
    );
    // ...and the wrapper unwraps `.payload` before calling our handler.
    const wrapper = rawListen.mock.calls[0][1] as (e: {
      payload: unknown;
    }) => void;
    wrapper({ payload: { percentage: 42 } });
    expect(handler).toHaveBeenCalledWith({ percentage: 42 });
    expect(off).toBe(unlisten);
  });
});
