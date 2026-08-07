/// <reference types="@wdio/globals/types" />
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Journey 3: Code Mode (opencode over ACP)
 *
 * The desktop-only agentic coding flow, driven against the REAL compiled binary
 * through tauri-driver.
 *
 * These go through the live Tauri IPC bridge (`window.__TAURI__`, exposed via
 * `withGlobalTauri`), so the compiled `opencode_installer.rs` / `opencode_acp.rs`
 * actually run — the Playwright suite never launches the desktop binary and the
 * Vitest tests mock the IPC transport, so this is the only layer where the real
 * installer downloads a real binary and the real workspace map is written.
 *
 * **No Code turn is exercised.** A turn needs a tool-calling model: the cloud path
 * needs an authenticated tenant, and the on-device path is a multi-GB pull (the
 * sibling model journey deliberately uses a 92MB model that CANNOT call tools).
 * The turn-level behaviour — the permission prompt, one chat not blocking another,
 * the 5-session cap — is `pending` in the ledger and covered meanwhile by the Rust
 * unit tests (`pick_eviction`, `pick_reapable`) and the Vitest component tests.
 *
 * Requires locally: network access to download the pinned opencode release.
 * Nothing else — no Ollama, no credentials.
 */

// Tauri global (withGlobalTauri) shape — used only for casts inside the injected
// browser functions; the annotations are erased before serialisation.
type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;
interface TauriWindow {
  __TAURI__?: { core?: { invoke?: Invoke } };
}

interface OpencodeStatus {
  installed: boolean;
  version: string | null;
  config_ready: boolean;
  sandboxed: boolean;
}

/** Session ids used only by this journey, so cleanup can find their leftovers. */
const SESSION_A = 'e2e-code-a';
const SESSION_B = 'e2e-code-b';
const TEST_SESSIONS = [SESSION_A, SESSION_B];

const DATA_DIR = resolve(
  process.env.XDG_DATA_HOME ?? join(homedir(), '.local/share'),
  'iblai',
);
const WORKSPACE_MAP = join(DATA_DIR, 'workspaces.json');

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

/** Same call, but hand back the rejection instead of throwing. */
async function invokeExpectingFailure(
  command: string,
  args?: Record<string, unknown>,
): Promise<string | null> {
  try {
    await invokeCmd(command, args);
    return null;
  } catch (err) {
    return String(err);
  }
}

/**
 * Drop this journey's chats from the workspace map and delete the folders it
 * generated. The map is real app state shared with the user's own chats, so only
 * the two known test keys are touched.
 */
function cleanupWorkspaces(): void {
  if (!existsSync(WORKSPACE_MAP)) return;
  let map: Record<string, string>;
  try {
    map = JSON.parse(readFileSync(WORKSPACE_MAP, 'utf8')) as Record<
      string,
      string
    >;
  } catch {
    return; // unreadable — leave it alone rather than clobber real state
  }
  for (const id of TEST_SESSIONS) {
    const dir = map[id];
    // Only remove a folder we generated. A path the picker was pointed at
    // (code-06 uses a temp dir) is not ours to delete recursively.
    if (dir?.startsWith(join(DATA_DIR, 'workspaces'))) {
      rmSync(dir, { recursive: true, force: true });
    }
    delete map[id];
  }
  writeFileSync(WORKSPACE_MAP, JSON.stringify(map, null, 2));
}

describe('Journey 3: Code Mode (opencode)', () => {
  before(async () => {
    // The opencode download is a real GitHub release fetch awaited in-page; give
    // WebDriver scripts room, as the model journey does for its pulls.
    await browser.setTimeout({ script: 300_000 });

    // Let the shell settle BEFORE injecting any script. WebKitGTK tears the page
    // down across the login navigation, and an `execute` landing mid-teardown
    // takes the whole session with it ("session deleted because of page crash").
    // `waitForExist` is a plain WebDriver query — no injection — so it is safe to
    // poll with while that is still happening.
    await $('body').waitForExist({
      timeout: 60_000,
      timeoutMsg: 'the app never rendered a <body> in its WebView',
    });
    await browser.pause(5000);

    // Every command here rides the Tauri IPC bridge; fail fast and clearly if it
    // never shows up. No login — all of this is backend-only and needs no tenant.
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            typeof (window as unknown as TauriWindow).__TAURI__?.core
              ?.invoke === 'function',
        ),
      {
        timeout: 60_000,
        timeoutMsg:
          'window.__TAURI__ (withGlobalTauri) never appeared on the WebView',
      },
    );
    cleanupWorkspaces();
  });

  after(() => {
    cleanupWorkspaces();
  });

  it('code-01: check_opencode_status reports Code readiness', async () => {
    const status = await invokeCmd<OpencodeStatus>('check_opencode_status');

    expect(typeof status.installed).toBe('boolean');
    expect(typeof status.config_ready).toBe('boolean');
    // The macOS App Sandbox flag: false everywhere tauri-driver can run.
    expect(status.sandboxed).toBe(false);
  });

  /**
   * Regression for the setup freeze (`opencode_installer.rs` `extract`). The
   * install once ran its extractor with inherited stdio (`status()`) — in a
   * GUI-launched build nobody drains that pipe, so a chatty extractor filled it
   * and the install wedged — and extraction ran inline on a tokio worker,
   * stalling the very IPC channel every other command answers on. The app
   * looked frozen, with nothing to say why.
   *
   * Sits BEFORE code-02 on purpose: the managed binary is deleted first, so
   * this install is the journey's one real download+extract and code-02 then
   * exercises the short-circuit path.
   */
  it('code-11: the app keeps answering IPC while opencode installs', async () => {
    // Force a genuine download+extract — with a runnable binary present the
    // installer short-circuits and there is nothing in flight to probe.
    for (const name of ['opencode', 'opencode.exe']) {
      rmSync(join(DATA_DIR, 'bin', name), { force: true });
    }

    // Kick the install and leave it running in-page (the model journey's
    // in-flight idiom) — awaiting it here would serialise the very concurrency
    // this checkpoint exists to prove.
    await browser.execute(() => {
      const invoke = (window as unknown as TauriWindow).__TAURI__?.core?.invoke;
      if (!invoke) throw new Error('window.__TAURI__.core.invoke unavailable');
      (window as unknown as Record<string, unknown>).__e2eOpencodeInstall =
        invoke('install_opencode').then(
          (value) => ({ ok: true, value }),
          (err) => ({ ok: false, error: String(err) }),
        );
    });

    // While the ~100MB download + extract runs, cheap unrelated IPC must keep
    // answering fast. Pre-fix these hung until the Mocha timeout.
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const os = await invokeCmd<string>('get_os_type');
      expect(Date.now() - t0).toBeLessThan(5000);
      expect(['windows', 'macos', 'linux']).toContain(os);
      await browser.pause(1000);
    }

    // Responsive AND correct — the install must still finish, not be dropped.
    const done = (await browser.execute(
      () =>
        (window as unknown as Record<string, unknown>).__e2eOpencodeInstall as
          | Promise<unknown>
          | undefined,
    )) as { ok: boolean; value?: unknown; error?: string };
    expect(done.ok).toBe(true);
    expect(String(done.value).length).toBeGreaterThan(0);
  });

  it('code-02: install_opencode downloads and installs the pinned binary', async () => {
    // code-11 above already paid for the real download; this exercises the
    // short-circuit path on a now-runnable binary (instant, still returns the
    // version).
    const version = await invokeCmd<string>('install_opencode');
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  /**
   * Regression guard for the bare-`opencode`-on-an-augmented-PATH change. The
   * spawn program is now the bare name and the managed `bin` dir is appended to
   * PATH; if the installer's own `--version` probe doesn't use that same PATH it
   * reports "not installed" immediately after a successful download, and
   * install_opencode re-downloads forever.
   */
  it('code-03: the freshly installed binary is discoverable on the augmented PATH', async () => {
    const status = await invokeCmd<OpencodeStatus>('check_opencode_status');
    expect(status.installed).toBe(true);
    expect(status.version).toBeTruthy();
    expect(status.config_ready).toBe(true);
  });

  it('code-04: each chat gets its own generated workspace', async () => {
    const a = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_A,
    });
    const b = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_B,
    });

    expect(a).not.toBe(b);
    // Both land under the app-managed workspaces root with a generated name.
    for (const dir of [a, b]) {
      expect(dir.startsWith(join(DATA_DIR, 'workspaces'))).toBe(true);
      expect(existsSync(dir)).toBe(true);
    }
  });

  it('code-05: a chat keeps the same workspace across calls', async () => {
    const first = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_A,
    });
    const again = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_A,
    });

    expect(again).toBe(first);
    // Durable, not just memoised: it round-trips through workspaces.json, which
    // is what makes it survive a restart or an evicted process.
    const map = JSON.parse(readFileSync(WORKSPACE_MAP, 'utf8')) as Record<
      string,
      string
    >;
    expect(map[SESSION_A]).toBe(first);
  });

  it('code-06: the folder picker repoints one chat and leaves the other alone', async () => {
    const bBefore = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_B,
    });
    const picked = join(tmpdir(), 'iblai-e2e-code-picked');

    const saved = await invokeCmd<string>('set_opencode_workspace', {
      sessionId: SESSION_A,
      path: picked,
    });

    // Used as given — a picked folder is NOT relocated under the managed tree.
    expect(saved).toBe(picked);
    expect(
      await invokeCmd<string>('get_opencode_workspace', {
        sessionId: SESSION_A,
      }),
    ).toBe(picked);
    expect(
      await invokeCmd<string>('get_opencode_workspace', {
        sessionId: SESSION_B,
      }),
    ).toBe(bBefore);

    rmSync(picked, { recursive: true, force: true });
  });

  it('code-07: closing or answering an unknown session is a no-op', async () => {
    // Both are called on teardown paths that can race a session that is already
    // gone; neither may reject, or a chat close would surface a spurious error.
    expect(
      await invokeExpectingFailure('opencode_close', {
        sessionId: 'e2e-code-never-existed',
      }),
    ).toBeNull();
    expect(
      await invokeExpectingFailure('opencode_permission_respond', {
        requestId: 'perm-never-existed',
        optionId: null,
      }),
    ).toBeNull();
  });

  describe('turn-level behaviour (needs a tool-calling model)', () => {
    it.skip('code-08: a permission prompt in one chat does not block another chat', () => {
      /* pending — needs an authenticated tenant or a multi-GB local model */
    });

    it.skip('code-09: the session cap evicts the least-recently-used idle process', () => {
      /* pending — same harness gap; covered by the Rust pick_eviction tests */
    });

    it.skip('code-10: the prompt renders in the chat that raised it', () => {
      /* pending — same harness gap; covered by the Vitest bubble tests */
    });
  });
});
