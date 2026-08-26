/// <reference types="@wdio/globals/types" />
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
  supported: boolean;
  sandbox_ready: boolean;
}

/** Session ids used only by this journey, so cleanup can find their leftovers. */
const SESSION_A = 'e2e-code-a';
const SESSION_B = 'e2e-code-b';
const SESSION_C = 'e2e-code-c';
const TEST_SESSIONS = [SESSION_A, SESSION_B, SESSION_C];

/** Mentor id used only by the skills checkpoints below. */
const MENTOR = 'e2e-code-mentor';
/** Mentor staging dirs the skills checkpoints created, removed in after(). */
const stagingDirs: string[] = [];

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
    // The vibe dir is a shared cache (like the managed opencode binary) and is
    // left in place; only this journey's mentor staging is ours to delete.
    for (const dir of stagingDirs) {
      if (dir.startsWith(join(DATA_DIR, 'skills', 'mentors'))) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('code-01: check_opencode_status reports Code readiness', async () => {
    const status = await invokeCmd<OpencodeStatus>('check_opencode_status');

    expect(typeof status.installed).toBe('boolean');
    expect(typeof status.config_ready).toBe('boolean');
    // The macOS App Sandbox flag: false everywhere tauri-driver can run.
    expect(status.sandboxed).toBe(false);
    // tauri-driver only runs on Linux/Windows-with-Code-off… in practice Linux,
    // where Code is supported; bwrap availability depends on the host.
    expect(status.supported).toBe(true);
    expect(typeof status.sandbox_ready).toBe('boolean');
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

  it('code-04: a chat with real work keeps its own workspace; untouched leftovers are recycled', async () => {
    const a = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_A,
    });
    expect(a.startsWith(join(DATA_DIR, 'workspaces'))).toBe(true);
    expect(existsSync(a)).toBe(true);

    // Real content in A's folder — the next chat must NOT be handed it.
    writeFileSync(join(a, 'notes.txt'), 'work');
    const b = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_B,
    });
    expect(b).not.toBe(a);
    expect(b.startsWith(join(DATA_DIR, 'workspaces'))).toBe(true);
    expect(existsSync(b)).toBe(true);

    // The other half of the rule: an untouched leftover (just `.git`) is
    // recycled instead of stranding one more folder per app launch. `aaa-`
    // sorts ahead of every generated adjective slug, so the sort-first
    // deterministic pick is ours.
    const leftover = join(DATA_DIR, 'workspaces', 'aaa-e2e-recycle');
    mkdirSync(join(leftover, '.git'), { recursive: true });
    const c = await invokeCmd<string>('get_opencode_workspace', {
      sessionId: SESSION_C,
    });
    expect(c).toBe(leftover);
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

  describe('Agent Skills staging (Code mode skills)', () => {
    it('code-12: set_opencode_skills materialises SKILL.md packages for a mentor', async () => {
      const staging = await invokeCmd<string>('set_opencode_skills', {
        mentorUniqueId: MENTOR,
        skills: [
          {
            slug: 'web-research',
            description: 'Find things on the web',
            instruction: 'Do research.',
            resources: [
              { filename: 'run.py', content: 'print(1)' },
              // A hostile filename must stay a single component inside the dir.
              { filename: '../escape.txt', content: 'confined' },
            ],
          },
          // A hostile slug must sanitise into the staging dir, never out of it.
          { slug: '../Evil Slug!', description: 'hostile', instruction: 'x' },
        ],
      });
      stagingDirs.push(staging);

      expect(staging.startsWith(join(DATA_DIR, 'skills', 'mentors'))).toBe(
        true,
      );
      const manifest = readFileSync(
        join(staging, 'web-research', 'SKILL.md'),
        'utf8',
      );
      expect(manifest).toContain('name: web-research');
      expect(manifest).toContain('description: "Find things on the web"');
      expect(manifest).toContain('Do research.');
      expect(
        readFileSync(join(staging, 'web-research', 'run.py'), 'utf8'),
      ).toBe('print(1)');
      // '../escape.txt' → '.._escape.txt', inside the skill dir.
      expect(
        readFileSync(join(staging, 'web-research', '.._escape.txt'), 'utf8'),
      ).toBe('confined');
      // The hostile slug landed as a sanitised sibling — and nothing else did.
      expect(existsSync(join(staging, 'evil-slug', 'SKILL.md'))).toBe(true);
      expect(readdirSync(staging).sort()).toEqual([
        'evil-slug',
        'web-research',
      ]);
    });

    it('code-13: a rewrite drops deselected skills and an empty sync clears the tree', async () => {
      const staging = await invokeCmd<string>('set_opencode_skills', {
        mentorUniqueId: MENTOR,
        skills: [
          { slug: 'alpha', description: 'a', instruction: 'A.' },
          { slug: 'beta', description: 'b', instruction: 'B.' },
        ],
      });
      stagingDirs.push(staging);
      expect(existsSync(join(staging, 'alpha', 'SKILL.md'))).toBe(true);

      await invokeCmd<string>('set_opencode_skills', {
        mentorUniqueId: MENTOR,
        skills: [{ slug: 'beta', description: 'b', instruction: 'B.' }],
      });
      expect(existsSync(join(staging, 'alpha'))).toBe(false);
      expect(existsSync(join(staging, 'beta', 'SKILL.md'))).toBe(true);

      // An empty sync removes the tree — an absent dir is the "no skills"
      // signal the spawn's config writer reads.
      await invokeCmd<string>('set_opencode_skills', {
        mentorUniqueId: MENTOR,
        skills: [],
      });
      expect(existsSync(staging)).toBe(false);

      // `skills: null` ends a sync WITHOUT touching the tree (the error path).
      await invokeCmd<string>('begin_opencode_skills_sync', {
        mentorUniqueId: MENTOR,
      });
      await invokeCmd<string>('set_opencode_skills', {
        mentorUniqueId: MENTOR,
        skills: null,
      });
      expect(existsSync(staging)).toBe(false);
    });

    it('code-16: ensure_vibe_skills installs the shared vibe skill set', async () => {
      // A real tarball fetch (~28MB) — same network assumption as the opencode
      // binary download above. The dir is a shared cache and is left in place.
      const res = await invokeCmd<{ present: boolean; refreshed: boolean }>(
        'ensure_vibe_skills',
      );

      expect(res.present).toBe(true);
      const vibeDir = join(DATA_DIR, 'skills', 'vibe');
      const packages = readdirSync(vibeDir).filter((entry) =>
        existsSync(join(vibeDir, entry, 'SKILL.md')),
      );
      expect(packages.length).toBeGreaterThan(0);
    });

    it('code-21: the approval mode round-trips through settings.json and rejects anything else', async () => {
      const settings = join(DATA_DIR, 'settings.json');
      const before = existsSync(settings)
        ? readFileSync(settings, 'utf8')
        : null;

      await invokeCmd<null>('set_opencode_permission_mode', { mode: 'auto' });
      expect(await invokeCmd<string>('get_opencode_permission_mode')).toBe(
        'auto',
      );
      // Persisted, not just held in memory — a cold start must not silently
      // drop back to asking (or, worse, to approving).
      expect(JSON.parse(readFileSync(settings, 'utf8')).permission_mode).toBe(
        'auto',
      );

      await invokeCmd<null>('set_opencode_permission_mode', { mode: 'manual' });
      expect(await invokeCmd<string>('get_opencode_permission_mode')).toBe(
        'manual',
      );

      // An unknown mode is refused rather than defaulting: silently picking a
      // security posture on a typo is the failure worth preventing.
      await expect(
        invokeCmd('set_opencode_permission_mode', { mode: 'yolo' }),
      ).rejects.toThrow();
      expect(await invokeCmd<string>('get_opencode_permission_mode')).toBe(
        'manual',
      );

      if (before !== null) writeFileSync(settings, before);
    });

    it('code-22: a mentor keeps one workspace, and New workspace mints a fresh one without deleting the old', async () => {
      const mentorArgs = {
        sessionId: 'e2e-ws-1',
        tenant: 'e2e',
        mentor: MENTOR,
      };

      const first = await invokeCmd<string>(
        'get_opencode_workspace',
        mentorArgs,
      );
      expect(first).toContain('workspaces');
      // Same mentor, another chat: the work has to still be there.
      expect(
        await invokeCmd<string>('get_opencode_workspace', {
          ...mentorArgs,
          sessionId: 'e2e-ws-2',
        }),
      ).toBe(first);
      // A different mentor must not inherit it.
      expect(
        await invokeCmd<string>('get_opencode_workspace', {
          ...mentorArgs,
          mentor: `${MENTOR}-other`,
        }),
      ).not.toBe(first);

      const fresh = await invokeCmd<string>(
        'new_opencode_workspace',
        mentorArgs,
      );
      expect(fresh).not.toBe(first);
      expect(existsSync(fresh)).toBe(true);
      // The previous folder survives: switching is meant to be undoable.
      expect(existsSync(first)).toBe(true);
      expect(
        await invokeCmd<string>('get_opencode_workspace', mentorArgs),
      ).toBe(fresh);
    });

    it.skip('code-23: the Code popover asks for an approval mode on first use and stores the answer against the signed-in user', () => {
      /* pending — needs an authenticated UI session (like code-14) to render
         the popover and reach the user-metadata endpoint; covered meanwhile by
         the coding-mode-button Vitest cases */
    });

    it.skip('code-24: the popover offers New workspace and a platform-named Open folder button', () => {
      /* pending — same authenticated-UI gap; the labels and disabled states are
         covered by the coding-mode-button Vitest cases, and clicking Open
         folder would spawn a real file manager */
    });

    it.skip('code-14: the Code pill spins while skills sync and the popover shows the amber note on failure', () => {
      /* pending — needs an authenticated UI session (like odm-01/04/06);
         covered meanwhile by the coding-mode-button + skill-sync Vitest suites */
    });

    it.skip('code-15: a Code turn invokes a synced skill through opencode’s skill tool', () => {
      /* pending — needs a tool-calling model, the same harness gap as
         code-08..10; the staging → opencode.json wiring is covered by the Rust
         apply_skills_config tests */
    });

    it.skip('code-17: New Chat in the sidebar evicts the previous chat’s opencode process while Code is on', () => {
      /* pending — needs an authenticated UI session (like code-14); covered
         meanwhile by the app-sidebar Vitest eviction cases */
    });
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

    it.skip('code-18: a Code turn runs inside the OS sandbox — only the workspace and tool caches writable, ~/.ssh empty', () => {
      /* pending — needs a tool-calling model to drive a shell command through
         opencode; the bwrap argv, SBPL profile and decoy home are covered by
         the Rust sandbox tests in opencode_acp.rs */
    });

    it.skip('code-19: a second New Chat gets a fresh workspace, and a chat’s folder follows it from the ephemeral first-turn key to its real session id', () => {
      /* pending — needs an authenticated UI session (like code-14/17); covered
         meanwhile by the Rust adopt_prior_mapping tests and the SDK per-chat
         key vitest cases */
    });
  });
});
