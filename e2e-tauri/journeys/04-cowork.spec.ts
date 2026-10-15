/// <reference types="@wdio/globals/types" />

/**
 * Journey 4: Cowork (Cua Driver)
 *
 * The desktop assistant that reads the screen and acts on it, driven against the
 * REAL compiled binary through tauri-driver.
 *
 * Only the host side is exercised here: whether this session can run Cowork and
 * the two commands the macOS setup dialog relies on. The dialog itself needs
 * macOS — the Accessibility and Screen Recording grants exist nowhere else and
 * tauri-driver has no macOS support — so those checkpoints are `pending` in the
 * ledger and covered meanwhile by the `inside-buttons` Vitest cases and the Rust
 * `cua_driver_mcp` tests.
 *
 * Requires locally: nothing — no driver download, no credentials.
 */

// Tauri global (withGlobalTauri) shape — used only for casts inside the injected
// browser functions; the annotations are erased before serialisation.
type Invoke = (cmd: string, args?: unknown) => Promise<unknown>;
interface TauriWindow {
  __TAURI__?: { core?: { invoke?: Invoke } };
}

/** `cua_driver_support`: whether this desktop session can run Cowork. */
interface DriverSupport {
  supported: boolean;
  reason?: string | null;
}

/** The host's machine-readable refusals; the composer maps each to a sentence. */
const KNOWN_REASONS = [
  'unsupported_os',
  'kde_unproven',
  'gnome_helper_missing',
  'unknown_session',
  'sandboxed',
];

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

describe('Journey 4: Cowork (Cua Driver)', () => {
  before(async () => {
    // Let the shell settle BEFORE injecting any script — see Journey 3 for why
    // an `execute` landing mid-teardown takes the whole session with it.
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
        timeout: 60_000,
        timeoutMsg:
          'window.__TAURI__ (withGlobalTauri) never appeared on the WebView',
      },
    );
  });

  it('cowork-01: cua_driver_support says whether this session can run Cowork, and why not', async () => {
    const support = await invokeCmd<DriverSupport>('cua_driver_support');

    expect(typeof support.supported).toBe('boolean');
    if (support.supported) {
      expect(support.reason ?? null).toBe(null);
    } else {
      // Never a free-text reason: the composer renders a translated sentence
      // per code, and an unknown code would fall through to the generic one.
      expect(KNOWN_REASONS).toContain(support.reason);
    }
    // The App Store sandbox is a macOS-only state; tauri-driver never runs there.
    expect(support.reason).not.toBe('sandboxed');
  });

  it('cowork-02: open_privacy_settings takes only the two panes the setup dialog links to', async () => {
    // Off macOS the known panes are accepted and nothing opens — the command
    // must still resolve so the dialog's buttons never surface a host error.
    await invokeCmd('open_privacy_settings', { pane: 'accessibility' });
    await invokeCmd('open_privacy_settings', { pane: 'screen_recording' });

    const error = await invokeExpectingFailure('open_privacy_settings', {
      pane: 'camera',
    });
    expect(error).not.toBe(null);
    expect(error).toContain('camera');
  });
});
