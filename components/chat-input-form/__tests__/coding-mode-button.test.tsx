import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CodingModeButton } from '../coding-mode-button';
import {
  resetApprovalModeForTests,
  useApprovalsOffered,
} from '../code-approvals-button';
import {
  addPermissionRequest,
  resetCodePermissionsForTests as resetCodePermissionCards,
} from '@iblai/iblai-js/web-containers/next';
import type { OpencodeSkillSync } from '@/hooks/use-opencode-skill-sync';

/**
 * Code's on/off control.
 *
 * What matters here is what the toggle refuses to do: it must not enable Code with an
 * on-device model that can't call tools (opencode would look broken), it must clear a
 * stale enabled flag when that happens, and it must stay hidden in the Mac App Store
 * build, where the app can't spawn a child process at all.
 */

const {
  invoke,
  eventHandlers,
  openDialog,
  openPath,
  scannerState,
  mentorSettings,
  offlineMode,
  platformMetadata,
  metadataQuery,
  saveMetadata,
  tauriPlatform,
  toastError,
  toolPill,
  userOS,
} = vi.hoisted(() => ({
  invoke: vi.fn(),
  /**
   * What the pill tells the SDK composer's tool row (`registered`), and the
   * row's answer when a test sets one; unset, the real hook answers, which
   * outside the row always shows the name.
   */
  toolPill: {
    registered: vi.fn(),
    showName: undefined as boolean | undefined,
  },
  /** Tauri event listeners the component registered, by event name. */
  eventHandlers: {} as Record<
    string,
    ((e: { payload: unknown }) => void) | undefined
  >,
  openDialog: vi.fn(),
  openPath: vi.fn(),
  toastError: vi.fn(),
  mentorSettings: { current: { llmProvider: 'openai', llmName: 'gpt-4o' } },
  offlineMode: { current: false },
  // The DM-backed copy of the approval mode; `undefined` data = still loading.
  platformMetadata: { current: undefined as unknown },
  metadataQuery: vi.fn(),
  saveMetadata: vi.fn(),
  userOS: { current: 'Linux' },
  tauriPlatform: { current: 'linux' },
  scannerState: {
    permission: 'granted' as string,
    /** What `requestPermissions` answers when `permission` is not granted. */
    requested: 'granted' as string,
    cancelled: false,
    rejectScan: undefined as undefined | ((e: unknown) => void),
    resolveScan: undefined as
      | undefined
      | ((r: { content: string } | undefined) => void),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: async (event: string, cb: (e: { payload: unknown }) => void) => {
    eventHandlers[event] = cb;
    return () => {
      delete eventHandlers[event];
    };
  },
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: unknown[]) => openDialog(...args),
}));
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => tauriPlatform.current,
}));
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: (...args: unknown[]) => openPath(...args),
}));
vi.mock('@tauri-apps/plugin-barcode-scanner', () => ({
  checkPermissions: () => scannerState.permission,
  requestPermissions: () => scannerState.requested,
  cancel: () => {
    scannerState.cancelled = true;
    scannerState.rejectScan?.(new Error('cancelled'));
    return Promise.resolve();
  },
  scan: () =>
    new Promise((resolve, reject) => {
      scannerState.resolveScan = resolve;
      scannerState.rejectScan = reject;
    }),
  Format: { QRCode: 'QR_CODE' },
}));
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
  Toaster: () => null,
}));
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserPlatformMetadataQuery: (...args: unknown[]) => {
    metadataQuery(...args);
    return { data: platformMetadata.current };
  },
  useUpdateUserPlatformMetadataMutation: () => [saveMetadata],
}));
vi.mock('@iblai/iblai-js/web-containers', () => ({
  // Catalog names for the ids used here; anything else gets each word capitalized.
  localModelDisplayName: (ref?: string | null) => {
    const names: Record<string, string> = { qwen3: 'Qwen 3' };
    const id = (ref ?? '').replace(/:latest$/i, '');
    return (
      names[id] ??
      id.replace(
        /(^|\s)(\S)/g,
        (_: string, gap: string, c: string) => gap + c.toUpperCase(),
      )
    );
  },
}));
vi.mock('@iblai/iblai-js/web-containers/next', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@iblai/iblai-js/web-containers/next')
    >();
  return {
    ...actual,
    useComposerToolPill: (on: boolean) => {
      toolPill.registered(on);
      const real = actual.useComposerToolPill(on);
      return toolPill.showName === undefined
        ? real
        : { showName: toolPill.showName };
    },
  };
});
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return { ...actual, getUserOS: () => userOS.current };
});
vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => ({ data: mentorSettings.current }),
}));
vi.mock('@/hooks/use-tauri-offline', () => ({
  isTauriOfflineMode: () => offlineMode.current,
}));
// Partial mock: `config` is a big object other modules pull from at import time,
// so replacing the whole module breaks unrelated top-level initialisers.
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    config: { ...actual.config, dmUrl: () => 'https://dm.test' },
  };
});

function backend(
  overrides: {
    sandboxed?: boolean;
    supported?: boolean;
    sandbox_ready?: boolean;
    local?: unknown;
    /** Linux: probed name of the inode/directory handler; null = unknown. */
    fileManager?: string | null;
    /** The saved approval mode; null = an older desktop's never chosen. */
    permissionMode?: string | null;
    /** Phone↔desktop pairing state (Tauri mobile). */
    remoteHost?: unknown;
    /** iOS Local Network verdict (Tauri mobile); granted unless a test says. */
    localNetwork?: 'granted' | 'denied' | 'undetermined';
    /**
     * `check_code_agent_status` per agent. Absent = a desktop build without the
     * agent commands (the invoke answers nothing), so the choice stays hidden.
     */
    agents?: Partial<Record<'codex' | 'claude', unknown>>;
  } = {},
) {
  invoke.mockImplementation(async (cmd: string, args?: unknown) => {
    switch (cmd) {
      case 'check_code_agent_status':
        return overrides.agents?.[
          (args as { backend: 'codex' | 'claude' }).backend
        ];
      case 'check_opencode_status':
        return {
          sandboxed: overrides.sandboxed ?? false,
          supported: overrides.supported ?? true,
          sandbox_ready: overrides.sandbox_ready ?? true,
          file_manager: overrides.fileManager ?? null,
        };
      case 'get_opencode_workspace':
        return '/home/tester/code/demo';
      case 'set_opencode_workspace':
        return '/home/tester/other';
      case 'new_opencode_workspace':
        return '/home/tester/code/fresh';
      case 'get_opencode_permission_mode':
        // What the desktop reports when no mode is saved.
        return 'permissionMode' in overrides
          ? overrides.permissionMode
          : 'auto';
      case 'check_code_local_model':
        return overrides.local;
      case 'remote_code_get_host':
        return overrides.remoteHost ?? { configured: false, connected: false };
      case 'remote_code_set_host':
        return { ok: true };
      case 'remote_code_clear_host':
        return undefined;
      case 'local_network_status':
        return overrides.localNetwork ?? 'granted';
      case 'open_app_settings':
        return undefined;
      default:
        return undefined;
    }
  });
}

/**
 * Layer per-test command handlers over the current `backend()`; a handler that
 * throws rejects the invoke, like a failing Rust command.
 */
function extend(handlers: Record<string, (args?: unknown) => unknown>) {
  const base = invoke.getMockImplementation() as (
    cmd: string,
    args?: unknown,
  ) => Promise<unknown>;
  invoke.mockImplementation(async (cmd: string, args?: unknown) =>
    cmd in handlers ? handlers[cmd](args) : base(cmd, args),
  );
}

const SESSION_ID = 'chat-abc123';

/** Both subscription agents installed and signed in. */
const READY = {
  codex: {
    installed: true,
    supported: true,
    signed_in: true,
    account: 'Logged in using ChatGPT',
  },
  claude: {
    installed: true,
    supported: true,
    signed_in: true,
    account: 'me@example.com',
  },
};

const renderButton = (
  sessionId: string | undefined = SESSION_ID,
  skillSync?: OpencodeSkillSync,
) =>
  render(
    <TooltipProvider>
      <CodingModeButton
        sessionId={sessionId}
        skillSync={skillSync}
        approvalsSlot={null}
      />
    </TooltipProvider>,
  );

/** Let every backend answer already on its way land; the mocks answer at once. */
async function settle() {
  for (let i = 0; i < 3; i++) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
}

/**
 * Wait until the pill knows where it runs (desktop status, or a phone's
 * pairing): before that a tap only opens the popover, after it a tap while
 * Code is off also turns Code on.
 */
async function platformKnown() {
  await waitFor(() =>
    expect(
      invoke.mock.calls.some(
        ([cmd]) =>
          cmd === 'check_opencode_status' || cmd === 'remote_code_get_host',
      ),
    ).toBe(true),
  );
  await settle();
}

const pill = () => screen.findByRole('button', { name: 'Code' });

/**
 * Open the popover so its contents are in the DOM, by tapping the pill the
 * way a person would, once the pill knows where it runs: with Code off and
 * able to run, the tap turns it on too.
 */
async function openPopover() {
  await platformKnown();
  await userEvent.click(await pill());
}

describe('CodingModeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations: a picker one test made throw would
    // throw again for every later tap that turns Code on.
    openDialog.mockReset();
    localStorage.clear();
    resetApprovalModeForTests();
    mentorSettings.current = { llmProvider: 'openai', llmName: 'gpt-4o' };
    offlineMode.current = false;
    platformMetadata.current = undefined;
    saveMetadata.mockReturnValue({ unwrap: async () => ({}) });
    userOS.current = 'Linux';
    tauriPlatform.current = 'linux';
    resetCodePermissionCards();
    scannerState.permission = 'granted';
    scannerState.requested = 'granted';
    scannerState.cancelled = false;
    scannerState.resolveScan = undefined;
    scannerState.rejectScan = undefined;
    backend();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ id: 'openai/gpt-4o' }] }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides itself in the sandboxed Mac App Store build', async () => {
    backend({ sandboxed: true });
    const { container } = renderButton();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('hides itself on an unsupported platform (Windows)', async () => {
    backend({ supported: false });
    const { container } = renderButton();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  // Tauri mobile: Code shows, but it runs on a PAIRED desktop (the phone's
  // Rust side proxies the opencode commands to `opencode serve` over there).
  // Un-paired, the control renders a connect form and the switch stays off.
  describe('Tauri mobile (paired-desktop Code)', () => {
    beforeEach(() => {
      tauriPlatform.current = 'ios';
      // The shared `isTauriMobile` probe is Tauri-gated: a phone build injects
      // the Tauri globals, so the OS answer alone must not count as mobile.
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    });
    afterEach(() => {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    });

    it('shows a pairing form instead of workspace pickers when un-paired', async () => {
      renderButton();
      await openPopover();
      expect(screen.getByTestId('code-remote-host')).toBeInTheDocument();
      expect(screen.getByTestId('code-remote-url')).toBeInTheDocument();
      expect(screen.getByTestId('code-remote-password')).toBeInTheDocument();
      expect(screen.getByTestId('code-remote-scan')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeDisabled();
      // The SDK's send-time flag must read un-paired.
      await waitFor(() =>
        expect(localStorage.getItem('ibl_remote_code_ready')).toBe('false'),
      );
    });

    it('pairing stores every candidate address for network failover', async () => {
      // The Rust side keeps the full `urls` list so the pairing can heal
      // itself when the current address stops answering and another of the
      // desktop's advertised addresses still does.
      renderButton();
      await openPopover();
      await userEvent.type(
        screen.getByTestId('code-remote-url'),
        '192.168.0.10:4096',
      );
      await userEvent.type(screen.getByTestId('code-remote-password'), 'pw1');
      await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith(
          'remote_code_set_host',
          expect.objectContaining({
            url: '192.168.0.10:4096',
            password: 'pw1',
            urls: ['192.168.0.10:4096'],
          }),
        ),
      );
    });

    it('QR scanner shows a close button that cancels the scan', async () => {
      // The camera view had NO way out: scan() ran fullscreen with nothing
      // tappable. Now scanning renders an overlay whose close button cancels
      // the plugin scan, drops the overlay, and surfaces no error.
      scannerState.cancelled = false;
      renderButton();
      await openPopover();
      await userEvent.click(screen.getByTestId('code-remote-scan'));

      const overlay = await screen.findByTestId('qr-scan-overlay');
      expect(overlay).toBeInTheDocument();
      // The transparency class is on while the camera is behind the webview.
      expect(
        document.documentElement.classList.contains('qr-scan-active'),
      ).toBe(true);

      await userEvent.click(screen.getByTestId('qr-scan-close'));
      await waitFor(() =>
        expect(screen.queryByTestId('qr-scan-overlay')).toBeNull(),
      );
      expect(scannerState.cancelled).toBe(true);
      expect(
        document.documentElement.classList.contains('qr-scan-active'),
      ).toBe(false);
      // A user-cancelled scan is not an error.
      expect(screen.queryByText('cancelled')).toBeNull();
    });

    it('keeps Code enable-able on mobile while an on-device model is selected', async () => {
      // `check_code_local_model` is a desktop-only command; invoking it on
      // mobile rejected, `local` stayed null and the switch was blocked
      // forever. Mobile turns are cloud-only, so the local verdict must not
      // gate the switch there at all.
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3');
      backend({
        remoteHost: {
          configured: true,
          connected: true,
          url: 'http://192.168.0.10:4096',
          directory: '/Users/me/.local/share/iblai/workspaces/phone',
        },
      });
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(screen.getByRole('switch')).not.toBeDisabled(),
      );
      expect(invoke).not.toHaveBeenCalledWith(
        'check_code_local_model',
        expect.anything(),
      );
    });

    it('mirrors a live pairing into the SDK flag and enables the switch', async () => {
      backend({
        remoteHost: {
          configured: true,
          connected: true,
          url: 'http://192.168.0.10:4096',
          directory: '/Users/me/.local/share/iblai/workspaces/phone',
        },
      });
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(localStorage.getItem('ibl_remote_code_ready')).toBe('true'),
      );
      expect(screen.getByRole('switch')).not.toBeDisabled();
      expect(screen.getByText('http://192.168.0.10:4096')).toBeInTheDocument();
    });

    it('forces Code off when the paired desktop is unreachable', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({
        remoteHost: {
          configured: true,
          connected: false,
          url: 'http://192.168.0.10:4096',
        },
      });
      renderButton();
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
      );
    });

    it('enables, from the pill and from the switch, without the desktop folder-choice flow (no picker on a phone)', async () => {
      backend({
        remoteHost: { configured: true, connected: true, url: 'http://x:1' },
      });
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      const sw = screen.getByRole('switch');
      expect(sw).toBeChecked();

      await userEvent.click(sw);
      await userEvent.click(sw);
      await waitFor(() => expect(sw).toBeChecked());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      // The pre-fix bug: first enable ran pickFolder(), which can only fail
      // on iOS ("Couldn't choose a folder") — the workspace lives on the Mac.
      expect(openDialog).not.toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalledWith('install_opencode', undefined);
    });

    it('does NOT default Code on for signed-in users (mobile is opt-in)', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      backend({
        remoteHost: { configured: true, connected: true, url: 'http://x:1' },
      });
      renderButton();
      await platformKnown();
      await waitFor(() =>
        expect(localStorage.getItem('ibl_remote_code_ready')).toBe('true'),
      );
      // Paired and unblocked — yet no silent default-on.
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull();
    });

    it('only opens the popover on a tap while no desktop is paired, and turns Code on from the next tap once one is', async () => {
      renderButton();
      await openPopover();

      expect(await screen.findByTestId('code-remote-url')).toBeInTheDocument();
      expect(screen.getByRole('switch')).not.toBeChecked();
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull();

      // Paired meanwhile; closing the popover reads the pairing again.
      backend({
        remoteHost: { configured: true, connected: true, url: 'http://x:1' },
      });
      // Nothing is on, so its x only puts the popover away.
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() =>
        expect(localStorage.getItem('ibl_remote_code_ready')).toBe('true'),
      );
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull();

      await userEvent.click(await pill());

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(screen.getByRole('switch')).toBeChecked();
      expect(openDialog).not.toHaveBeenCalled();
    });

    it('never offers the agent choice on a phone (Code runs on the paired desktop)', async () => {
      backend({
        agents: READY,
        remoteHost: { configured: true, connected: true, url: 'http://x:1' },
      });
      renderButton();
      await openPopover();
      await screen.findByTestId('code-remote-host');
      expect(screen.queryByRole('radiogroup', { name: 'Agent' })).toBeNull();
      expect(invoke).not.toHaveBeenCalledWith(
        'check_code_agent_status',
        expect.anything(),
      );
    });

    it('shows the last refusal when no advertised address answers', async () => {
      extend({
        remote_code_set_host: () => {
          throw new Error('desktop refused the password');
        },
      });
      renderButton();
      await openPopover();
      await userEvent.type(screen.getByTestId('code-remote-url'), '10.0.0.2');
      await userEvent.type(screen.getByTestId('code-remote-password'), 'pw');
      await userEvent.click(screen.getByRole('button', { name: /Connect/i }));
      expect(
        await screen.findByText('desktop refused the password'),
      ).toBeInTheDocument();
      // Still un-paired: the form stays, the switch stays off.
      expect(screen.getByTestId('code-remote-url')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    describe('Local Network permission (iOS)', () => {
      it('asks the host for Local Network access when the pairing panel opens', async () => {
        renderButton();
        await openPopover();
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith(
            'local_network_status',
            undefined,
          ),
        );
        // Granted: the pairing UI is the normal one.
        expect(screen.getByTestId('code-remote-scan')).toBeEnabled();
        expect(screen.queryByTestId('code-local-network-denied')).toBeNull();
      });

      it('replaces scan and fields with the way to Settings when access is denied', async () => {
        backend({ localNetwork: 'denied' });
        renderButton();
        await openPopover();
        expect(
          await screen.findByTestId('code-local-network-denied'),
        ).toHaveTextContent(/Local Network access is off/);
        expect(screen.queryByTestId('code-remote-scan')).toBeNull();
        expect(screen.queryByTestId('code-remote-url')).toBeNull();
        expect(screen.queryByTestId('code-remote-password')).toBeNull();
        await userEvent.click(screen.getByTestId('code-open-app-settings'));
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith('open_app_settings', undefined),
        );
      });

      it('asks again when the app comes back from Settings and restores the pairing UI', async () => {
        backend({ localNetwork: 'denied' });
        renderButton();
        await openPopover();
        await screen.findByTestId('code-local-network-denied');
        // The user flipped the switch in Settings and came back.
        extend({ local_network_status: () => 'granted' });
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          configurable: true,
        });
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(await screen.findByTestId('code-remote-scan')).toBeEnabled();
        expect(screen.queryByTestId('code-local-network-denied')).toBeNull();
      });

      it('holds the scan while the host is still asking', async () => {
        let settle: (v: string) => void = () => {};
        extend({
          local_network_status: () =>
            new Promise<string>((resolve) => {
              settle = resolve;
            }),
        });
        renderButton();
        await openPopover();
        expect(
          await screen.findByTestId('code-local-network-checking'),
        ).toHaveTextContent(/Checking local network access/);
        expect(screen.getByTestId('code-remote-scan')).toBeDisabled();
        await act(async () => settle('undetermined'));
        // No verdict is not a denial: pairing itself raises the prompt.
        await waitFor(() =>
          expect(screen.getByTestId('code-remote-scan')).toBeEnabled(),
        );
        expect(screen.queryByTestId('code-local-network-checking')).toBeNull();
      });

      it('asks again on every open — the switch can be turned off in Settings', async () => {
        renderButton();
        await openPopover();
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith(
            'local_network_status',
            undefined,
          ),
        );
        expect(screen.getByTestId('code-remote-scan')).toBeInTheDocument();
        // Off in Settings, panel reopened: the pairing UI gives way.
        extend({ local_network_status: () => 'denied' });
        await userEvent.keyboard('{Escape}');
        await openPopover();
        expect(
          await screen.findByTestId('code-local-network-denied'),
        ).toBeInTheDocument();
        expect(screen.queryByTestId('code-remote-scan')).toBeNull();
        expect(
          invoke.mock.calls.filter(([c]) => c === 'local_network_status'),
        ).toHaveLength(2);
      });

      it('re-probes the desktop when the app comes back, so a paired desktop reads unreachable once access is off', async () => {
        backend({
          remoteHost: {
            configured: true,
            connected: true,
            url: 'http://192.168.0.10:4096',
            directory: '/Users/me/phone',
          },
        });
        renderButton();
        await openPopover();
        // Paired and reachable: the connected view.
        expect(await screen.findByText(/Connected To/i)).toBeInTheDocument();
        // Access switched off in Settings, back to the app.
        extend({
          local_network_status: () => 'denied',
          remote_code_get_host: () => ({ configured: true, connected: false }),
        });
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          configurable: true,
        });
        await act(async () => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(
          await screen.findByTestId('code-local-network-denied'),
        ).toBeInTheDocument();
        // One explanation, not two: the unreachable note stays out.
        expect(screen.queryByTestId('code-remote-unreachable')).toBeNull();
        expect(screen.queryByTestId('code-remote-scan')).toBeNull();
      });
    });

    describe('QR pairing', () => {
      /** Start a scan and hand back the resolver the fake camera will use. */
      async function startScan() {
        renderButton();
        await openPopover();
        await userEvent.click(screen.getByTestId('code-remote-scan'));
        await screen.findByTestId('qr-scan-overlay');
        await waitFor(() => expect(scannerState.resolveScan).toBeDefined());
      }

      it('explains a denied camera permission instead of opening the scanner', async () => {
        scannerState.permission = 'denied';
        scannerState.requested = 'denied';
        renderButton();
        await openPopover();
        await userEvent.click(screen.getByTestId('code-remote-scan'));
        expect(
          await screen.findByText(/Camera access was denied/),
        ).toBeInTheDocument();
        expect(screen.queryByTestId('qr-scan-overlay')).toBeNull();
        expect(
          document.documentElement.classList.contains('qr-scan-active'),
        ).toBe(false);
      });

      it('asks for the camera once and scans when the user grants it', async () => {
        scannerState.permission = 'prompt';
        scannerState.requested = 'granted';
        await startScan();
        expect(screen.getByTestId('qr-scan-overlay')).toBeInTheDocument();
      });

      it('rejects a QR that is not a pairing code', async () => {
        await startScan();
        scannerState.resolveScan!({ content: 'https://example.com/menu' });
        expect(
          await screen.findByText(/isn't a Code pairing code/),
        ).toBeInTheDocument();
        expect(screen.queryByTestId('qr-scan-overlay')).toBeNull();
        expect(invoke).not.toHaveBeenCalledWith(
          'remote_code_set_host',
          expect.anything(),
        );
      });

      it('rejects a pairing code with no address or password', async () => {
        await startScan();
        scannerState.resolveScan!({
          content: 'iblcode1:{"urls":["", null],"password":""}',
        });
        expect(
          await screen.findByText(/isn't a Code pairing code/),
        ).toBeInTheDocument();
        expect(invoke).not.toHaveBeenCalledWith(
          'remote_code_set_host',
          expect.anything(),
        );
      });

      it('treats an empty scan result as not a pairing code', async () => {
        await startScan();
        scannerState.resolveScan!(undefined);
        expect(
          await screen.findByText(/isn't a Code pairing code/),
        ).toBeInTheDocument();
      });

      it('pairs from the scanned code with every address the desktop advertises', async () => {
        await startScan();
        scannerState.resolveScan!({
          content:
            'iblcode1:' +
            JSON.stringify({
              urls: ['http://192.168.0.10:4096', 'http://10.8.0.3:4096'],
              password: 'scanned-pw',
              mgmt: ['http://192.168.0.10:4097', 'http://10.8.0.3:4097'],
            }),
        });
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith('remote_code_set_host', {
            url: 'http://192.168.0.10:4096',
            password: 'scanned-pw',
            mgmt: ['http://192.168.0.10:4097', 'http://10.8.0.3:4097'],
            urls: ['http://192.168.0.10:4096', 'http://10.8.0.3:4096'],
          }),
        );
        // The first address answered, so the second was never tried.
        expect(
          invoke.mock.calls.filter(([c]) => c === 'remote_code_set_host'),
        ).toHaveLength(1);
        expect(screen.queryByTestId('qr-scan-overlay')).toBeNull();
      });

      it('pairs in ONE host call and shows its failure — the host races the addresses', async () => {
        // The host probes every address at once and keeps probing while
        // iOS's local-network prompt is up; looping here per address would
        // only multiply that wait. So: one call, and its error is the error.
        let attempts = 0;
        let settle: () => void = () => {};
        extend({
          remote_code_set_host: () =>
            new Promise((_, reject) => {
              attempts += 1;
              settle = () => reject(new Error('connection failed: no route'));
            }),
        });
        await startScan();
        scannerState.resolveScan!({
          content:
            'iblcode1:' +
            JSON.stringify({
              urls: ['http://192.168.0.10:4096', 'http://10.8.0.3:4096'],
              password: 'pw',
            }),
        });
        await waitFor(() => expect(attempts).toBe(1));
        // While the host probes, the user is told what the phone may ask.
        expect(
          await screen.findByTestId('code-remote-connecting-hint'),
        ).toHaveTextContent(/tap Allow/);
        await act(async () => settle());
        expect(
          await screen.findByText('connection failed: no route'),
        ).toBeInTheDocument();
        expect(attempts).toBe(1);
        expect(screen.queryByTestId('code-remote-connecting-hint')).toBeNull();
      });

      it('shows a scanner failure that was not the user closing it', async () => {
        await startScan();
        scannerState.rejectScan!(new Error('camera is busy'));
        expect(await screen.findByText('camera is busy')).toBeInTheDocument();
        expect(screen.queryByTestId('qr-scan-overlay')).toBeNull();
        expect(
          document.documentElement.classList.contains('qr-scan-active'),
        ).toBe(false);
      });
    });

    describe('paired workspace actions', () => {
      const HOST = {
        configured: true,
        connected: true,
        url: 'http://192.168.0.10:4096',
        directory: '/Users/me/.local/share/iblai/workspaces/phone',
      };

      beforeEach(() => {
        backend({ remoteHost: HOST });
      });

      it('lists the desktop folders and switches this chat to one, keyed by tenant and mentor', async () => {
        localStorage.setItem('tenant', 'acme');
        localStorage.setItem('ibl_coding_mode_mentor', 'mentor-uuid-1');
        extend({
          remote_code_list_workspaces: () => ({
            workspaces: [
              { name: 'demo', path: '/Users/me/code/demo' },
              { name: 'site', path: '/Users/me/code/site' },
            ],
          }),
        });
        renderButton();
        await openPopover();
        await userEvent.click(
          await screen.findByTestId('code-remote-select-folder'),
        );
        const list = await screen.findByTestId('code-remote-folder-list');
        expect(list).toHaveTextContent('demo');
        expect(list).toHaveTextContent('site');

        await userEvent.click(screen.getByRole('button', { name: 'site' }));
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith('set_opencode_workspace', {
            sessionId: SESSION_ID,
            path: '/Users/me/code/site',
            tenant: 'acme',
            mentor: 'mentor-uuid-1',
          }),
        );
        expect(screen.getByTestId('code-remote-workspace')).toHaveTextContent(
          '/Users/me/code/site',
        );
        // Picking closes the list.
        expect(screen.queryByTestId('code-remote-folder-list')).toBeNull();
      });

      it('shows an empty list as a dash and closes it on a second tap', async () => {
        extend({ remote_code_list_workspaces: () => ({ workspaces: [] }) });
        renderButton();
        await openPopover();
        const btn = await screen.findByTestId('code-remote-select-folder');
        await userEvent.click(btn);
        expect(
          await screen.findByTestId('code-remote-folder-list'),
        ).toHaveTextContent('—');
        await userEvent.click(btn);
        expect(screen.queryByTestId('code-remote-folder-list')).toBeNull();
      });

      it('tolerates a backend that returns no workspace list at all', async () => {
        extend({ remote_code_list_workspaces: () => undefined });
        renderButton();
        await openPopover();
        await userEvent.click(
          await screen.findByTestId('code-remote-select-folder'),
        );
        expect(
          await screen.findByTestId('code-remote-folder-list'),
        ).toHaveTextContent('—');
      });

      it('surfaces a failed folder listing as a toast', async () => {
        extend({
          remote_code_list_workspaces: () => {
            throw new Error('desktop went away');
          },
        });
        renderButton();
        await openPopover();
        await userEvent.click(
          await screen.findByTestId('code-remote-select-folder'),
        );
        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith('desktop went away'),
        );
        expect(screen.queryByTestId('code-remote-folder-list')).toBeNull();
      });

      it('surfaces a failed folder switch and keeps the current workspace', async () => {
        extend({
          remote_code_list_workspaces: () => ({
            workspaces: [{ name: 'demo', path: '/Users/me/code/demo' }],
          }),
          set_opencode_workspace: () => {
            throw new Error('not a directory');
          },
        });
        renderButton();
        await openPopover();
        await userEvent.click(
          await screen.findByTestId('code-remote-select-folder'),
        );
        await userEvent.click(
          await screen.findByRole('button', { name: 'demo' }),
        );
        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith('not a directory'),
        );
        expect(
          screen.getByTestId('code-remote-workspace'),
        ).not.toHaveTextContent('/Users/me/code/demo');
      });

      it('mints a fresh desktop workspace for this chat', async () => {
        extend({ new_opencode_workspace: () => '/Users/me/code/fresh-2' });
        renderButton();
        await openPopover();
        await userEvent.click(
          await screen.findByTestId('code-remote-new-folder'),
        );
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith('new_opencode_workspace', {
            sessionId: SESSION_ID,
            tenant: undefined,
            mentor: undefined,
          }),
        );
        expect(screen.getByTestId('code-remote-workspace')).toHaveTextContent(
          '/Users/me/code/fresh-2',
        );
      });

      it('leaves the workspace alone when the mint returns nothing', async () => {
        extend({ new_opencode_workspace: () => '' });
        renderButton();
        await openPopover();
        const before = screen.getByTestId('code-remote-workspace').textContent;
        await userEvent.click(
          await screen.findByTestId('code-remote-new-folder'),
        );
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith(
            'new_opencode_workspace',
            expect.anything(),
          ),
        );
        expect(screen.getByTestId('code-remote-workspace')).toHaveTextContent(
          before ?? '',
        );
      });

      it('surfaces a failed workspace mint as a toast', async () => {
        extend({
          new_opencode_workspace: () => {
            throw new Error('disk full');
          },
        });
        renderButton();
        await openPopover();
        await userEvent.click(
          await screen.findByTestId('code-remote-new-folder'),
        );
        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith('disk full'),
        );
      });

      it('disconnects and falls back to the pairing form', async () => {
        let paired = true;
        extend({
          remote_code_get_host: () =>
            paired ? HOST : { configured: false, connected: false },
          remote_code_clear_host: () => {
            paired = false;
            return undefined;
          },
        });
        renderButton();
        await openPopover();
        await userEvent.click(
          await screen.findByRole('button', { name: /Disconnect/ }),
        );
        expect(
          await screen.findByTestId('code-remote-url'),
        ).toBeInTheDocument();
        expect(invoke).toHaveBeenCalledWith(
          'remote_code_clear_host',
          undefined,
        );
        await waitFor(() =>
          expect(localStorage.getItem('ibl_remote_code_ready')).toBe('false'),
        );
      });

      it('re-reads the pairing even when clearing it fails', async () => {
        extend({
          remote_code_clear_host: () => {
            throw new Error('store locked');
          },
        });
        renderButton();
        await openPopover();
        const reads = () =>
          invoke.mock.calls.filter(([c]) => c === 'remote_code_get_host')
            .length;
        const before = reads();
        await userEvent.click(
          await screen.findByRole('button', { name: /Disconnect/ }),
        );
        await waitFor(() => expect(reads()).toBeGreaterThan(before));
        // Best-effort clear: no toast, and the still-paired state stands.
        expect(toastError).not.toHaveBeenCalled();
        expect(screen.getByTestId('code-remote-workspace')).toBeInTheDocument();
      });
    });
  });

  /**
   * Desktop side of pairing: this machine hosts `opencode serve` for phones.
   * The section only appears once the backend answers `remote_code_status`.
   */
  describe('phone access (desktop host)', () => {
    const RUNNING = {
      running: true,
      urls: ['http://192.168.0.5:4096', 'http://10.8.0.2:4096'],
      password: 'host-secret',
    };

    it('restores phone access that was on before the app restarted', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      extend({
        remote_code_status: () => ({ running: false, auto_enable: true }),
      });
      renderButton();
      // No popover: the restore runs on mount so paired phones do not stay
      // bricked until someone opens Code settings on the desktop.
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('remote_code_enable', {
          tenant: 'acme',
          token: 'jwt-test-token',
        }),
      );
    });

    it('waits for the sign-in to land instead of failing the restore once', async () => {
      // The bug this pins: the restore read tenant/token from storage on
      // mount, Rust rejected the empty pair, the bare catch swallowed it
      // and nothing ever retried — phone access stayed down all session.
      extend({
        remote_code_status: () => ({ running: false, auto_enable: true }),
      });
      renderButton();
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('check_opencode_status', undefined),
      );
      expect(invoke).not.toHaveBeenCalledWith(
        'remote_code_enable',
        expect.anything(),
      );
      // Auth lands: the storage write is announced the way the app does it.
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-late-token');
      act(() => {
        window.dispatchEvent(
          new StorageEvent('local-storage', { key: 'dm_token' }),
        );
      });
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('remote_code_enable', {
          tenant: 'acme',
          token: 'jwt-late-token',
        }),
      );
    });

    it('leaves a deliberately disabled host alone on launch', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      extend({
        remote_code_status: () => ({ running: false, auto_enable: false }),
      });
      renderButton();
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('remote_code_status', undefined),
      );
      expect(invoke).not.toHaveBeenCalledWith(
        'remote_code_enable',
        expect.anything(),
      );
    });

    it('shows the address, password and pairing QR while running, and refreshes the token', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      extend({
        remote_code_status: () => RUNNING,
        remote_code_pairing_qr: () =>
          '<svg xmlns="http://www.w3.org/2000/svg"/>',
      });
      renderButton();
      await openPopover();
      const section = await screen.findByTestId('code-phone-access');
      expect(section).toHaveTextContent('http://192.168.0.5:4096');
      expect(section).toHaveTextContent('host-secret');
      expect(await screen.findByTestId('code-pairing-qr')).toHaveAttribute(
        'src',
        expect.stringContaining('data:image/svg+xml'),
      );
      // Opening the popover on a running host re-enables idempotently so the
      // held sign-in token never goes stale under the phones.
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('remote_code_enable', {
          tenant: 'acme',
          token: 'jwt-test-token',
        }),
      );
    });

    it('keeps the address visible when the QR cannot be rendered', async () => {
      extend({
        remote_code_status: () => RUNNING,
        remote_code_pairing_qr: () => {
          throw new Error('qr failed');
        },
      });
      renderButton();
      await openPopover();
      const section = await screen.findByTestId('code-phone-access');
      expect(section).toHaveTextContent('http://192.168.0.5:4096');
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith(
          'remote_code_pairing_qr',
          undefined,
        ),
      );
      expect(screen.queryByTestId('code-pairing-qr')).toBeNull();
    });

    it('turns phone access off from the popover', async () => {
      extend({
        remote_code_status: () => RUNNING,
        remote_code_pairing_qr: () => '<svg/>',
      });
      renderButton();
      await openPopover();
      await screen.findByTestId('code-pairing-qr');
      await userEvent.click(screen.getByRole('button', { name: /Disable/ }));
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('remote_code_disable', undefined),
      );
      expect(
        await screen.findByRole('button', { name: /Enable/ }),
      ).toBeInTheDocument();
      // The QR follows the server state down.
      await waitFor(() =>
        expect(screen.queryByTestId('code-pairing-qr')).toBeNull(),
      );
    });

    it('turns phone access on and shows what the host handed back', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      extend({
        remote_code_status: () => ({ running: false, urls: [] }),
        remote_code_enable: () => ({
          running: true,
          urls: ['http://192.168.0.9:4096'],
          password: 'fresh-secret',
        }),
        remote_code_pairing_qr: () => '<svg/>',
      });
      renderButton();
      await openPopover();
      await userEvent.click(
        await screen.findByRole('button', { name: /Enable/ }),
      );
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('remote_code_enable', {
          tenant: 'acme',
          token: 'jwt-test-token',
        }),
      );
      const section = screen.getByTestId('code-phone-access');
      await waitFor(() =>
        expect(section).toHaveTextContent('http://192.168.0.9:4096'),
      );
      expect(section).toHaveTextContent('fresh-secret');
    });

    it('surfaces a failed enable as a toast and stays off', async () => {
      extend({
        remote_code_status: () => ({ running: false, urls: [] }),
        remote_code_enable: () => {
          throw new Error('opencode is not installed');
        },
      });
      renderButton();
      await openPopover();
      await userEvent.click(
        await screen.findByRole('button', { name: /Enable/ }),
      );
      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith('opencode is not installed'),
      );
      expect(screen.getByRole('button', { name: /Enable/ })).toBeEnabled();
    });

    it('hides the section on a backend without the pairing commands', async () => {
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('remote_code_status', undefined),
      );
      expect(screen.queryByTestId('code-phone-access')).toBeNull();
    });
  });

  it('disables the switch and explains when bubblewrap is missing', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'true');
    backend({ sandbox_ready: false });
    renderButton();

    // A stale enabled flag is force-cleared so sends route back to normal chat.
    await waitFor(() =>
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
    );

    await openPopover();
    expect(screen.getByTestId('code-sandbox-missing')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  describe('default on', () => {
    it('turns Code on once for a signed-in desktop user', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      renderButton();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
        'openai/gpt-4o',
      );
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_opencode', undefined),
      );
      // The platform key is minted the moment Code is on — a child's env is
      // fixed at spawn, so first-turn minting was routinely too late.
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('ensure_opencode_platform_key', {
          tenant: 'acme',
          token: 'jwt-test-token',
        }),
      );
    });

    it('respects an explicit previous choice of off', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton();

      await waitFor(() => expect(invoke).toHaveBeenCalled());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false');
    });

    it('leaves Code off for a signed-out user', async () => {
      renderButton();
      await waitFor(() => expect(invoke).toHaveBeenCalled());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull();
    });
  });

  describe('model', () => {
    it('persists the mentor LLM as the Code model without advertising it', async () => {
      // Signed in, so the model validates against the tenant's /v1/models and the
      // "will fail" warning (which DOES name it) stays away.
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
          'openai/gpt-4o',
        ),
      );
      // A healthy model is the top-left LLM picker's business, not this popover's.
      expect(screen.queryByText('openai/gpt-4o')).not.toBeInTheDocument();
    });

    it('warns loudly when that model is not provisioned for Code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
      );
      renderButton();
      await openPopover();

      expect(
        await screen.findByText(/isn’t available for Code/),
      ).toBeInTheDocument();
    });

    it('blocks an on-device model that cannot call tools', async () => {
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'gemma3');
      backend({
        local: {
          runtime: 'ollama',
          spec: 'ollama/gemma3',
          model: 'gemma3',
          running: true,
          tools_supported: false,
          reason: "gemma3 doesn't support tool calling.",
        },
      });
      renderButton();
      await openPopover();

      expect(
        await screen.findByText(/Gemma3 can't change files or run commands/),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('accepts a tool-capable on-device model and persists its prefixed spec', async () => {
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3');
      backend({
        local: {
          runtime: 'ollama',
          spec: 'ollama/qwen3',
          model: 'qwen3',
          running: true,
          tools_supported: true,
          reason: '',
        },
      });
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
          'ollama/qwen3',
        ),
      );
      // The warm-up hint stands in for the model line that used to be here.
      expect(await screen.findByText(/First run can take/)).toBeInTheDocument();
    });

    it('warns without blocking when tool support is unknown (Foundry)', async () => {
      offlineMode.current = true;
      localStorage.setItem('ibl_local_llm_model', 'phi-4');
      backend({
        local: {
          runtime: 'foundry',
          spec: 'foundry/phi-4',
          model: 'phi-4',
          running: true,
          tools_supported: null,
          reason: "Foundry Local doesn't report tool-calling support.",
        },
      });
      renderButton();
      await openPopover();

      expect(
        await screen.findByText(/We couldn't confirm Phi-4 can change files/),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeEnabled();
    });
  });

  describe('workspace', () => {
    it('shows the folder the agent is confined to', async () => {
      renderButton();
      await openPopover();
      expect(
        await screen.findByText('/home/tester/code/demo'),
      ).toBeInTheDocument();
    });

    it('reads the workspace for THIS chat', async () => {
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('get_opencode_workspace', {
          sessionId: SESSION_ID,
        }),
      );
    });

    it('asks for nothing until the chat has a session id', async () => {
      // A brand-new chat has no session yet, so there is no per-chat workspace to read.
      // Rendered directly: passing `undefined` through renderButton would hit its
      // default parameter and silently supply a session id.
      render(
        <TooltipProvider>
          <CodingModeButton approvalsSlot={null} />
        </TooltipProvider>,
      );
      await openPopover();

      await waitFor(() => expect(invoke).toHaveBeenCalled());
      expect(invoke).not.toHaveBeenCalledWith(
        'get_opencode_workspace',
        expect.anything(),
      );
    });

    it('persists a newly picked folder against this chat only', async () => {
      openDialog.mockResolvedValue('/home/tester/other');
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Select Workspace/ }),
      );

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_workspace', {
          sessionId: SESSION_ID,
          path: '/home/tester/other',
        }),
      );
      expect(localStorage.getItem('ibl_coding_mode_folder_chosen')).toBe(
        'true',
      );
    });

    it('ignores a cancelled folder picker', async () => {
      openDialog.mockResolvedValue(null);
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Select Workspace/ }),
      );

      expect(invoke).not.toHaveBeenCalledWith(
        'set_opencode_workspace',
        expect.anything(),
      );
    });
  });

  describe('layout', () => {
    it('keeps the Code switch in view and scrolls only what is below it', async () => {
      renderButton();
      await openPopover();

      const header = await screen.findByTestId('code-popover-header');
      const body = screen.getByTestId('code-popover-body');
      const codeSwitch = within(header).getByRole('switch');
      expect(body).toHaveClass('overflow-y-auto');
      expect(body).not.toContainElement(codeSwitch);
      expect(header).not.toHaveClass('overflow-y-auto');
      // Short windows: capped to the room Radix reports on its side.
      expect(header.closest('[role="dialog"]')).toHaveClass(
        'max-h-[var(--radix-popover-content-available-height)]',
      );
    });
  });

  describe('toggling', () => {
    it('forces a deliberate folder choice the first time Code is switched on', async () => {
      // On by default for a signed-in desktop user, which never asks for a
      // folder: switching it off and on again in the popover asks.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      openDialog.mockResolvedValue('/home/tester/other');
      renderButton();
      await openPopover();
      const sw = await screen.findByRole('switch');
      await userEvent.click(sw);
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
      );
      expect(openDialog).not.toHaveBeenCalled();

      await userEvent.click(sw);

      await waitFor(() => expect(openDialog).toHaveBeenCalled());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_opencode', undefined),
      );
      // Switching Code on also mints the platform key right away.
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('ensure_opencode_platform_key', {
          tenant: 'acme',
          token: 'jwt-test-token',
        }),
      );
    });

    it('forces the same folder choice the first time a tap on the pill turns Code on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      openDialog.mockResolvedValue('/home/tester/other');
      renderButton();
      await openPopover();

      await waitFor(() => expect(openDialog).toHaveBeenCalled());
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      expect(await screen.findByRole('switch')).toBeChecked();
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_folder_chosen')).toBe(
          'true',
        ),
      );
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_opencode', undefined),
      );
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('ensure_opencode_platform_key', {
          tenant: 'acme',
          token: 'jwt-test-token',
        }),
      );
    });

    it('does not re-prompt for a folder once one is chosen', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(openDialog).not.toHaveBeenCalled();
    });

    it('stays interactive while opencode is still installing', async () => {
      // Regression for the setup freeze: `install_opencode` used to wedge the
      // app (extraction deadlocked on undrained stdio, and ran pinned to the
      // IPC thread). The UI must never gate on the install promise — here it
      // never settles at all, and the popover has to keep working anyway.
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      openDialog.mockResolvedValue('/home/tester/other');
      invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'install_opencode') return new Promise(() => {});
        if (cmd === 'check_opencode_status') return { sandboxed: false };
        if (cmd === 'get_opencode_workspace') return '/home/tester/code/demo';
        return undefined;
      });
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(invoke).toHaveBeenCalledWith('install_opencode', undefined);

      // The install is still pending; the folder picker must still respond.
      await userEvent.click(
        await screen.findByRole('button', { name: /Select Workspace/ }),
      );
      await waitFor(() => expect(openDialog).toHaveBeenCalled());
    });

    it('switching off skips the install and folder work entirely', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
      );
      expect(openDialog).not.toHaveBeenCalled();
    });
  });

  // People tapped Code and found it still off: the tap turns it on, through
  // the switch's own path, and the x on the pill turns it off.
  describe('tapping the pill', () => {
    const enabledFlag = () => localStorage.getItem('ibl_coding_mode_enabled');
    const turnOffX = () =>
      screen.queryByRole('button', { name: 'Turn off Code' });

    beforeEach(() => {
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
    });

    it('turns Code on while it is off, the way the switch does, and opens the popover', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton();
      await openPopover();

      expect(await screen.findByRole('switch')).toBeChecked();
      expect(enabledFlag()).toBe('true');
      expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
        'openai/gpt-4o',
      );
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_opencode', undefined),
      );
      expect(toolPill.registered).toHaveBeenLastCalledWith(true);
    });

    it.each([
      [
        'bubblewrap is missing',
        () => backend({ sandbox_ready: false }),
        'code-sandbox-missing',
      ],
      [
        'the on-device model cannot call tools',
        () => {
          localStorage.setItem('ibl_local_llm_enabled', 'true');
          localStorage.setItem('ibl_local_llm_model', 'gemma3');
          backend({
            local: {
              runtime: 'ollama',
              spec: 'ollama/gemma3',
              model: 'gemma3',
              running: true,
              tools_supported: false,
              reason: '',
            },
          });
        },
        'code-local-model-warning',
      ],
    ])(
      'only opens the popover while %s, as the switch refuses too',
      async (_, setUp, why) => {
        setUp();
        renderButton();
        await openPopover();

        expect(await screen.findByTestId(why)).toBeInTheDocument();
        const sw = screen.getByRole('switch');
        expect(sw).toBeDisabled();
        expect(sw).not.toBeChecked();
        expect(enabledFlag()).not.toBe('true');
        expect(invoke).not.toHaveBeenCalledWith('install_opencode', undefined);
        // Nothing is on, so the x only offers to put the popover away.
        expect(turnOffX()).toBeNull();
        expect(
          screen.getByRole('button', { name: 'Close' }),
        ).toBeInTheDocument();
      },
    );

    it('only opens the popover before it knows where it runs', async () => {
      extend({ check_opencode_status: () => new Promise(() => {}) });
      renderButton();
      await userEvent.click(await pill());

      expect(await screen.findByRole('switch')).not.toBeChecked();
      expect(enabledFlag()).toBeNull();
      expect(invoke).not.toHaveBeenCalledWith('install_opencode', undefined);
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('only opens and closes the popover while Code is on, which stays on with its x', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton();
      await openPopover();
      expect(await screen.findByRole('switch')).toBeChecked();
      expect(turnOffX()).toBeInTheDocument();

      await userEvent.click(await pill());

      await waitFor(() =>
        expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
      );
      expect(enabledFlag()).toBe('true');
      expect(turnOffX()).toBeInTheDocument();
      expect(invoke).not.toHaveBeenCalledWith('install_opencode', undefined);
    });

    it('puts the popover away without turning Code back on after it was switched off there, and turns it on from the next tap', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton();
      await openPopover();
      const sw = await screen.findByRole('switch');
      expect(sw).toBeChecked();
      await userEvent.click(sw);
      await waitFor(() => expect(enabledFlag()).toBe('false'));

      await userEvent.click(await pill());
      await waitFor(() =>
        expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
      );
      expect(enabledFlag()).toBe('false');

      await userEvent.click(await pill());
      expect(await screen.findByRole('switch')).toBeChecked();
      expect(enabledFlag()).toBe('true');
    });

    describe('its x', () => {
      it('is gone while Code is off and the popover closed, and there while Code is on, popover closed or open', async () => {
        localStorage.setItem('ibl_coding_mode_enabled', 'false');
        const { container } = renderButton();
        await platformKnown();
        expect(container.querySelector('svg.lucide-x')).toBeNull();

        await userEvent.click(await pill());
        await screen.findByRole('switch');
        expect(turnOffX()).toBeInTheDocument();

        await userEvent.click(await pill());
        await waitFor(() =>
          expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
        );
        expect(turnOffX()).toBeInTheDocument();
      });

      it('turns Code off from a closed popover, which stays closed', async () => {
        localStorage.setItem('ibl_coding_mode_enabled', 'true');
        const fanOut = vi.fn();
        window.addEventListener('local-storage', fanOut);
        try {
          const { container } = renderButton();
          await platformKnown();
          fanOut.mockClear();

          await userEvent.click(turnOffX()!);

          await waitFor(() => expect(enabledFlag()).toBe('false'));
          expect(fanOut).toHaveBeenCalled();
          expect(toolPill.registered).toHaveBeenLastCalledWith(false);
          expect(screen.queryByRole('switch')).not.toBeInTheDocument();
          expect(container.querySelector('svg.lucide-x')).toBeNull();
        } finally {
          window.removeEventListener('local-storage', fanOut);
        }
      });

      it('turns Code off from an open popover and closes it', async () => {
        localStorage.setItem('ibl_coding_mode_enabled', 'true');
        const { container } = renderButton();
        await openPopover();
        expect(await screen.findByRole('switch')).toBeChecked();

        await userEvent.click(turnOffX()!);

        await waitFor(() =>
          expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
        );
        expect(enabledFlag()).toBe('false');
        expect(container.querySelector('svg.lucide-x')).toBeNull();
      });

      // Focus opens the pill's tooltip, and on a touch screen nothing closes it.
      it('turns Code off from a tap without focusing anything, so no tooltip opens', async () => {
        localStorage.setItem('ibl_coding_mode_enabled', 'true');
        renderButton();
        await platformKnown();
        const x = turnOffX()!;

        expect(fireEvent.mouseDown(x)).toBe(false);
        fireEvent.click(x);

        await waitFor(() => expect(enabledFlag()).toBe('false'));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(document.body);
      });

      it('works from the keyboard: reached by Tab, named, and Enter or Space turns Code off', async () => {
        localStorage.setItem('ibl_coding_mode_enabled', 'true');
        renderButton();
        await platformKnown();
        const trigger = await pill();
        const x = turnOffX()!;
        expect(x).toHaveAttribute('tabindex', '0');

        act(() => trigger.focus());
        await userEvent.tab();
        expect(x).toHaveFocus();
        await userEvent.keyboard('{Enter}');

        await waitFor(() => expect(enabledFlag()).toBe('false'));
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();

        await userEvent.click(trigger);
        expect(await screen.findByRole('switch')).toBeChecked();
        act(() => turnOffX()!.focus());
        await userEvent.keyboard(' ');

        await waitFor(() => expect(enabledFlag()).toBe('false'));
        await waitFor(() =>
          expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
        );
      });
    });
  });

  describe('when things go wrong', () => {
    it('treats an unreachable model list as "not matched" rather than crashing', async () => {
      // Signed in, so the resolver actually issues the request (signed-out it
      // short-circuits before fetch and this would test nothing).
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      const fetchMock = vi.fn(async () => ({
        ok: false,
        json: async () => ({}),
      }));
      vi.stubGlobal('fetch', fetchMock);
      renderButton();
      await openPopover();
      expect(
        await screen.findByText(/isn’t available for Code/),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/orgs/acme/v1/models'),
        expect.objectContaining({
          headers: { Authorization: 'Token jwt-test-token' },
        }),
      );
    });

    it('survives a rejected model list request', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
      vi.stubGlobal('fetch', fetchMock);
      renderButton();
      await openPopover();
      expect(
        await screen.findByText(/isn’t available for Code/),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalled();
    });

    it('logs a refused platform-key mint without blocking the enable', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      extend({
        ensure_opencode_platform_key: () => {
          throw new Error('403');
        },
      });
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(err).toHaveBeenCalledWith(
          '[coding-mode] platform key prewarm failed',
          expect.any(Error),
        ),
      );
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      err.mockRestore();
    });

    it('keeps the switch blocked while the on-device verdict is still unknown', async () => {
      // A backend that answers nothing for the local probe: neither usable
      // nor refused, so the switch must not open up on a guess.
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3');
      backend({ local: undefined });
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('check_code_local_model', {
          model: 'qwen3',
        }),
      );
      expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('logs and moves on when the folder picker throws', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      openDialog.mockRejectedValue(new Error('no dialog'));
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Select Workspace/ }),
      );

      await waitFor(() => expect(err).toHaveBeenCalled());
      err.mockRestore();
    });

    it('logs and moves on when preparing the coding agent fails', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'check_opencode_status') return { sandboxed: false };
        if (cmd === 'install_opencode') throw new Error('download failed');
        if (cmd === 'get_opencode_permission_mode') return 'auto';
        return '/home/tester/code/demo';
      });
      renderButton();
      await openPopover();

      await waitFor(() => expect(err).toHaveBeenCalled());
      // Code is still ON — the flag is the user's choice, not the install's verdict.
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      err.mockRestore();
    });
  });

  /**
   * The approval mode decides whether the agent asks before touching files.
   * One mode for every chat, saved by the desktop. A machine with none saved
   * runs Automatic, or the Ask Me saved to the user's profile.
   */
  describe('approval mode', () => {
    const approvalsButton = () => screen.findByTestId('code-approvals-button');
    /** Render with the composer's approvals spot for the button to portal into. */
    const renderWithApprovalsSlot = (sessionId = SESSION_ID) => {
      const slot = document.createElement('div');
      document.body.appendChild(slot);
      const ui = (id: string) => (
        <TooltipProvider>
          <CodingModeButton sessionId={id} approvalsSlot={slot} />
        </TooltipProvider>
      );
      const view = render(ui(sessionId));
      return { ...view, rerenderFor: (id: string) => view.rerender(ui(id)) };
    };
    /** Whether any pill offers its host the approvals button, as the host reads it. */
    const Offered = () => (
      <span data-testid="approvals-offered">
        {String(useApprovalsOffered())}
      </span>
    );
    const offered = () => screen.getByTestId('approvals-offered');
    const pickFromApprovalsMenu = async (mode: 'manual' | 'auto') => {
      await userEvent.click(await approvalsButton());
      await userEvent.click(
        await screen.findByTestId(`code-approvals-option-${mode}`),
      );
    };

    it('shows Automatic when nothing was chosen and never pushes a mode on its own', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      renderWithApprovalsSlot();

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith(
          'get_opencode_permission_mode',
          undefined,
        ),
      );
      // Ask Me until the read lands, then the saved default: claiming
      // Automatic before we know would promise a user who chose Ask Me that
      // Code may act unasked.
      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Automatic',
        ),
      );
      expect(invoke).not.toHaveBeenCalledWith(
        'set_opencode_permission_mode',
        expect.anything(),
      );
    });

    it('opens its menu without putting a focus ring on either mode', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      renderWithApprovalsSlot();
      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Automatic',
        ),
      );

      await userEvent.click(await approvalsButton());

      const menu = (await screen.findByRole('radiogroup')).closest(
        '[role="dialog"]',
      );
      expect(menu).toHaveFocus();
      expect(
        screen.getByTestId('code-approvals-option-manual'),
      ).not.toHaveFocus();
      expect(
        screen.getByTestId('code-approvals-option-auto'),
      ).not.toHaveFocus();
    });

    it('keeps the brand blue on the button and on the mode in force', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      renderWithApprovalsSlot();
      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Automatic',
        ),
      );

      expect(await approvalsButton()).toHaveClass('text-[#38A1E5]');
      await userEvent.click(await approvalsButton());
      expect(
        await screen.findByTestId('code-approvals-option-auto'),
      ).toHaveClass('bg-[#F5F8FF]');
    });

    it('says Ask Me, not Automatic, before the desktop has answered', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      extend({
        get_opencode_permission_mode: () => new Promise<string>(() => {}),
      });
      renderWithApprovalsSlot();

      expect(await approvalsButton()).toHaveAccessibleName('Approvals: Ask Me');
    });

    it('shows the Ask Me the desktop has saved', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({ permissionMode: 'manual' });
      renderWithApprovalsSlot();

      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Ask Me',
        ),
      );
    });

    it('shows Ask Me when an older desktop says nothing was chosen', async () => {
      // An older desktop answers null in that state — and asks at every step.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({ permissionMode: null });
      renderWithApprovalsSlot();

      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Ask Me',
        ),
      );
    });

    it('shows Ask Me when the desktop cannot report its mode', async () => {
      // Builds before the command existed still ask at every step.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      extend({
        get_opencode_permission_mode: () => {
          throw new Error('command get_opencode_permission_mode not found');
        },
      });
      renderWithApprovalsSlot();

      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Ask Me',
        ),
      );
    });

    it('shows the mode in the composer’s action group and switches it from its menu', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      renderWithApprovalsSlot();

      const button = await approvalsButton();
      await waitFor(() =>
        expect(button).toHaveAccessibleName('Approvals: Automatic'),
      );

      await userEvent.click(button);
      expect(
        await screen.findByTestId('code-approvals-option-auto'),
      ).toHaveAttribute('aria-checked', 'true');
      expect(
        screen.getByTestId('code-approvals-option-auto'),
      ).toHaveTextContent(/without asking/);
      expect(
        screen.getByTestId('code-approvals-option-manual'),
      ).toHaveTextContent(/checks with you before/);

      await userEvent.click(screen.getByTestId('code-approvals-option-manual'));

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
          mode: 'manual',
        }),
      );
      expect(await approvalsButton()).toHaveAccessibleName('Approvals: Ask Me');
      await waitFor(() =>
        expect(
          screen.queryByTestId('code-approvals-option-manual'),
        ).not.toBeInTheDocument(),
      );
    });

    it('explains what each mode means under the Approvals switch', async () => {
      backend();
      renderButton();
      await openPopover();

      expect(
        await screen.findByTestId('code-auto-mode-hint'),
      ).toHaveTextContent(/without asking/);
      await userEvent.click(screen.getByRole('radio', { name: /Ask Me/ }));
      expect(
        await screen.findByTestId('code-manual-mode-hint'),
      ).toHaveTextContent(/checks with you before/);
    });

    it('keeps Ask Me in the next chat until it is switched back', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      const { rerenderFor } = renderWithApprovalsSlot('chat-a');
      await pickFromApprovalsMenu('manual');
      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Ask Me',
        ),
      );
      invoke.mockClear();

      rerenderFor('chat-b');

      expect(await approvalsButton()).toHaveAccessibleName('Approvals: Ask Me');
      expect(invoke).not.toHaveBeenCalledWith(
        'set_opencode_permission_mode',
        expect.anything(),
      );
    });

    it('keeps Ask Me when the composer remounts', async () => {
      // The first send swaps the welcome composer for the chat's own, and a
      // canvas swaps it again; neither may reset the mode.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({ permissionMode: 'auto' });
      const first = renderWithApprovalsSlot('chat-a');
      await pickFromApprovalsMenu('manual');
      first.unmount();
      // The desktop now holds what was just saved.
      backend({ permissionMode: 'manual' });
      invoke.mockClear();

      renderWithApprovalsSlot('chat-a');

      expect(await approvalsButton()).toHaveAccessibleName('Approvals: Ask Me');
      expect(invoke).not.toHaveBeenCalledWith(
        'set_opencode_permission_mode',
        expect.anything(),
      );
    });

    it('lets a pick win over a read that was still on its way', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      let answer: (mode: string) => void = () => {};
      backend();
      extend({
        get_opencode_permission_mode: () =>
          new Promise<string>((resolve) => {
            answer = resolve;
          }),
      });
      renderWithApprovalsSlot();

      await pickFromApprovalsMenu('manual');
      await act(async () => answer('auto'));

      expect(await approvalsButton()).toHaveAccessibleName('Approvals: Ask Me');
    });

    it('shows the same mode in every composer on screen', async () => {
      // A canvas keeps two composers mounted; both must show what is enforced.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      const slots = [0, 1].map(() => {
        const slot = document.createElement('div');
        document.body.appendChild(slot);
        return slot;
      });
      render(
        <TooltipProvider>
          <CodingModeButton sessionId="chat-a" approvalsSlot={slots[0]} />
          <CodingModeButton sessionId="chat-a" approvalsSlot={slots[1]} />
        </TooltipProvider>,
      );
      const inSlot = (i: number) =>
        within(slots[i]).findByTestId('code-approvals-button');

      await userEvent.click(await inSlot(0));
      await userEvent.click(
        await screen.findByTestId('code-approvals-option-manual'),
      );

      expect(await inSlot(1)).toHaveAccessibleName('Approvals: Ask Me');
      expect(await inSlot(0)).toHaveAccessibleName('Approvals: Ask Me');
    });

    it('never renders the approvals button beside the Code pill, even for a host that leaves the slot out', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({ permissionMode: 'manual' });
      // Cast: the slot is required, and this pins what a host gets if it
      // leaves it out anyway.
      const props = { sessionId: SESSION_ID } as ComponentProps<
        typeof CodingModeButton
      >;
      render(
        <TooltipProvider>
          <CodingModeButton {...props} />
        </TooltipProvider>,
      );
      await openPopover();
      await waitFor(() =>
        expect(screen.getByRole('radio', { name: /Ask Me/ })).toBeChecked(),
      );

      expect(
        screen.queryByTestId('code-approvals-button'),
      ).not.toBeInTheDocument();
    });

    it('offers the approvals button to its host only while Code is on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      backend();
      const view = render(
        <TooltipProvider>
          <CodingModeButton sessionId={SESSION_ID} approvalsSlot={null} />
          <Offered />
        </TooltipProvider>,
      );
      await waitFor(() => expect(offered()).toHaveTextContent('true'));

      await openPopover();
      await userEvent.click(screen.getByRole('switch'));
      await waitFor(() => expect(offered()).toHaveTextContent('false'));

      await userEvent.click(screen.getByRole('switch'));
      await waitFor(() => expect(offered()).toHaveTextContent('true'));
      view.rerender(
        <TooltipProvider>
          <Offered />
        </TooltipProvider>,
      );
      expect(offered()).toHaveTextContent('false');
    });

    it('keeps the approvals button on offer while another pill still offers it', async () => {
      // The canvas split mounts a composer, and so a pill, on each side.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      const first = renderButton();
      render(
        <TooltipProvider>
          <CodingModeButton sessionId={SESSION_ID} approvalsSlot={null} />
          <Offered />
        </TooltipProvider>,
      );
      await waitFor(() => expect(offered()).toHaveTextContent('true'));

      first.unmount();

      expect(offered()).toHaveTextContent('true');
    });

    it('withdraws the approvals button from every pill once Code is switched off in one', async () => {
      // The canvas split mounts a pill per composer; the one out of sight
      // must follow the switch flipped in the other.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      const slots = [0, 1].map(() => {
        const slot = document.createElement('div');
        document.body.appendChild(slot);
        return slot;
      });
      render(
        <TooltipProvider>
          <CodingModeButton sessionId={SESSION_ID} approvalsSlot={slots[0]} />
          <CodingModeButton sessionId={SESSION_ID} approvalsSlot={slots[1]} />
          <Offered />
        </TooltipProvider>,
      );
      await waitFor(() => expect(offered()).toHaveTextContent('true'));
      expect(
        await within(slots[1]).findByTestId('code-approvals-button'),
      ).toBeInTheDocument();

      const [firstPill] = await screen.findAllByRole('button', {
        name: 'Code',
      });
      await userEvent.click(firstPill);
      await userEvent.click(screen.getByRole('switch'));

      await waitFor(() => expect(offered()).toHaveTextContent('false'));
      expect(
        screen.queryByTestId('code-approvals-button'),
      ).not.toBeInTheDocument();
    });

    it('offers no approvals button where Code cannot run (the Mac App Store build)', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({ sandboxed: true });
      render(
        <TooltipProvider>
          <CodingModeButton sessionId={SESSION_ID} approvalsSlot={null} />
          <Offered />
        </TooltipProvider>,
      );

      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Code' }),
        ).not.toBeInTheDocument(),
      );
      expect(offered()).toHaveTextContent('false');
    });

    it('offers no approvals button while Code is blocked, even with Code left on', async () => {
      // An on-device model whose tool support has not been confirmed blocks
      // Code without switching it off.
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3');
      backend({ local: undefined });
      const slot = document.createElement('div');
      document.body.appendChild(slot);
      render(
        <TooltipProvider>
          <CodingModeButton sessionId={SESSION_ID} approvalsSlot={slot} />
          <Offered />
        </TooltipProvider>,
      );

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('check_code_local_model', {
          model: 'qwen3',
        }),
      );
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      expect(offered()).toHaveTextContent('false');
      expect(
        within(slot).queryByTestId('code-approvals-button'),
      ).not.toBeInTheDocument();
    });

    it('renders no Switch to Automatic of its own while Code cards wait, leaving Automatic to the approvals button', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({ permissionMode: 'manual' });
      const card = {
        generation_id: 'gen-1',
        title: 'Run the tests',
        kind: 'execute',
        command: 'npm test',
        allow_option_id: 'allow-once',
        reject_option_id: 'reject-once',
      };
      act(() => {
        addPermissionRequest({
          ...card,
          request_id: 'perm-1',
          session_id: SESSION_ID,
        });
        addPermissionRequest({
          ...card,
          request_id: 'perm-2',
          session_id: 'chat-someone-else',
        });
      });
      renderWithApprovalsSlot();
      await waitFor(() =>
        expect(approvalsButton()).resolves.toHaveAccessibleName(
          'Approvals: Ask Me',
        ),
      );

      expect(
        screen.queryByRole('button', { name: /automatic/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('code-switch-to-automatic'),
      ).not.toBeInTheDocument();

      await pickFromApprovalsMenu('auto');
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
          mode: 'auto',
        }),
      );
    });

    it('hides the approvals button while Code is off', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      backend();
      renderWithApprovalsSlot();
      await platformKnown();
      expect(
        screen.queryByTestId('code-approvals-button'),
      ).not.toBeInTheDocument();

      // Turned on by the tap, then off again in the open popover.
      await openPopover();
      expect(await approvalsButton()).toBeInTheDocument();
      await userEvent.click(screen.getByRole('switch'));

      await waitFor(() =>
        expect(
          screen.queryByTestId('code-approvals-button'),
        ).not.toBeInTheDocument(),
      );
    });

    it('puts the mode back and says so when the desktop cannot save the choice', async () => {
      // Shown as chosen but never saved, Code would keep approving on its own
      // behind an "Ask Me" label.
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('tenant', 'acme');
      backend();
      extend({
        set_opencode_permission_mode: (args: unknown) => {
          if ((args as { mode?: string })?.mode === 'manual') {
            throw new Error('config locked');
          }
          return undefined;
        },
      });
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('radio', { name: /Ask Me/ }),
      );

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          'The approval setting could not be saved. Code still uses the previous setting.',
        ),
      );
      expect(screen.getByRole('radio', { name: /Automatic/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /Ask Me/ })).not.toBeChecked();
      expect(err).toHaveBeenCalledWith(
        '[coding-mode] could not apply permission mode',
        expect.any(Error),
      );
      expect(saveMetadata).not.toHaveBeenCalled();
      err.mockRestore();
    });

    it('shows the mode the desktop holds after a failed save, even when the pick came before the first read answered', async () => {
      // Put back as it was, the mode would be the Ask Me placeholder shown
      // until the desktop answers, while the desktop runs Automatic.
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      let reads = 0;
      backend();
      extend({
        get_opencode_permission_mode: () =>
          ++reads === 1 ? new Promise<string>(() => {}) : 'auto',
        set_opencode_permission_mode: () => {
          throw new Error('config locked');
        },
      });
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('radio', { name: /Ask Me/ }),
      );

      await waitFor(() => expect(toastError).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByRole('radio', { name: /Automatic/ })).toBeChecked(),
      );
      err.mockRestore();
    });

    /**
     * A pick in the Code controls is also saved to the profile, so a machine
     * with nothing saved starts on it instead of the Automatic default. The
     * desktop saves only an Ask Me, only into an empty slot, and answers the
     * mode in force.
     */
    describe('carried over from the profile', () => {
      const profile = (codeMode: unknown) => {
        platformMetadata.current = {
          metadata: { language: 'en', code_mode: codeMode },
        };
      };
      const seedCalls = () =>
        invoke.mock.calls.filter(
          ([cmd]) => cmd === 'seed_opencode_permission_mode',
        );
      /**
       * A machine with nothing saved ends up on the profile's mode either way:
       * an Ask Me is saved, and Automatic is already the default.
       */
      const seedsEmptyMachine = () =>
        extend({
          seed_opencode_permission_mode: (args) =>
            (args as { mode: string }).mode,
        });
      const settle = () =>
        act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });

      beforeEach(() => {
        localStorage.setItem('ibl_coding_mode_enabled', 'true');
        localStorage.setItem('tenant', 'acme');
      });

      it('shows the Ask Me saved to the profile on a machine with none saved', async () => {
        backend();
        seedsEmptyMachine();
        profile({ permission_mode: 'manual' });
        renderWithApprovalsSlot();

        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith('seed_opencode_permission_mode', {
            mode: 'manual',
          }),
        );
        await settle();

        expect(await approvalsButton()).toHaveAccessibleName(
          'Approvals: Ask Me',
        );
        await openPopover();
        expect(screen.getByRole('radio', { name: /Ask Me/ })).toBeChecked();
        expect(invoke).not.toHaveBeenCalledWith(
          'set_opencode_permission_mode',
          expect.anything(),
        );
        expect(saveMetadata).not.toHaveBeenCalled();
      });

      it('shows the mode this machine already saved, not the profile’s', async () => {
        backend({ permissionMode: 'auto' });
        extend({ seed_opencode_permission_mode: () => 'auto' });
        profile({ permission_mode: 'manual' });
        renderWithApprovalsSlot();

        await waitFor(() => expect(seedCalls()).toHaveLength(1));
        await settle();

        expect(await approvalsButton()).toHaveAccessibleName(
          'Approvals: Automatic',
        );
      });

      it('keeps a pick made while the seed was on its way', async () => {
        backend({ permissionMode: 'manual' });
        let answer: (mode: string) => void = () => {};
        extend({
          seed_opencode_permission_mode: () =>
            new Promise<string>((resolve) => {
              answer = resolve;
            }),
        });
        profile({ permission_mode: 'manual' });
        renderWithApprovalsSlot();
        await waitFor(() => expect(seedCalls()).toHaveLength(1));

        await pickFromApprovalsMenu('auto');
        await act(async () => answer('manual'));

        expect(await approvalsButton()).toHaveAccessibleName(
          'Approvals: Automatic',
        );
      });

      it('keeps a pick made before the profile arrived, even when the desktop answers the seed ahead of the pick’s save', async () => {
        backend();
        let finishSave: () => void = () => {};
        extend({
          set_opencode_permission_mode: () =>
            new Promise<void>((resolve) => {
              finishSave = resolve;
            }),
          seed_opencode_permission_mode: () => 'auto',
        });
        const { rerenderFor } = renderWithApprovalsSlot();
        await waitFor(() =>
          expect(approvalsButton()).resolves.toHaveAccessibleName(
            'Approvals: Automatic',
          ),
        );

        await pickFromApprovalsMenu('manual');
        profile({ permission_mode: 'auto' });
        rerenderFor(SESSION_ID);
        await settle();
        await act(async () => finishSave());
        await settle();

        expect(await approvalsButton()).toHaveAccessibleName(
          'Approvals: Ask Me',
        );
        expect(seedCalls()).toHaveLength(0);
      });

      it('never lets a read still on its way undo the seed’s answer', async () => {
        let answerRead: (mode: string) => void = () => {};
        backend();
        extend({
          get_opencode_permission_mode: () =>
            new Promise<string>((resolve) => {
              answerRead = resolve;
            }),
          seed_opencode_permission_mode: () => 'manual',
        });
        profile({ permission_mode: 'manual' });
        renderWithApprovalsSlot();
        await waitFor(() => expect(seedCalls()).toHaveLength(1));
        await settle();

        await act(async () => answerRead('auto'));

        expect(await approvalsButton()).toHaveAccessibleName(
          'Approvals: Ask Me',
        );
      });

      it.each([
        [
          'cannot run the seed (an older desktop)',
          (settleSeed: { reject: (e: Error) => void }) =>
            settleSeed.reject(
              new Error('command seed_opencode_permission_mode not found'),
            ),
        ],
        [
          'answers nothing',
          (settleSeed: { resolve: (v: unknown) => void }) =>
            settleSeed.resolve(undefined),
        ],
      ])('changes nothing when the desktop %s', async (_, finish) => {
        const seed = {
          resolve: (() => {}) as (v: unknown) => void,
          reject: (() => {}) as (e: Error) => void,
        };
        backend();
        extend({
          seed_opencode_permission_mode: () =>
            new Promise((resolve, reject) => {
              seed.resolve = resolve;
              seed.reject = reject;
            }),
        });
        profile({ permission_mode: 'manual' });
        renderWithApprovalsSlot();
        await waitFor(() =>
          expect(approvalsButton()).resolves.toHaveAccessibleName(
            'Approvals: Automatic',
          ),
        );
        await waitFor(() => expect(seedCalls()).toHaveLength(1));

        await act(async () => finish(seed));
        await settle();

        expect(await approvalsButton()).toHaveAccessibleName(
          'Approvals: Automatic',
        );
        expect(toastError).not.toHaveBeenCalled();
        expect(invoke).not.toHaveBeenCalledWith(
          'set_opencode_permission_mode',
          expect.anything(),
        );
      });

      it.each([
        ['while the profile is still loading', undefined],
        ['from a profile with no metadata', { metadata: null }],
        [
          'from a profile with no Code settings',
          { metadata: { language: 'en' } },
        ],
        [
          'an unknown mode',
          { metadata: { code_mode: { permission_mode: 'sometimes' } } },
        ],
        ['a malformed entry', { metadata: { code_mode: 'manual' } }],
      ])('never seeds %s', async (_, data) => {
        backend();
        seedsEmptyMachine();
        platformMetadata.current = data;
        renderWithApprovalsSlot();

        await waitFor(() =>
          expect(approvalsButton()).resolves.toHaveAccessibleName(
            'Approvals: Automatic',
          ),
        );
        await settle();

        expect(seedCalls()).toHaveLength(0);
      });

      it('seeds once per composer, even when the profile is fetched again', async () => {
        backend();
        seedsEmptyMachine();
        const { rerenderFor } = renderWithApprovalsSlot();
        await settle();
        expect(seedCalls()).toHaveLength(0);

        profile({ permission_mode: 'manual' });
        rerenderFor(SESSION_ID);
        await waitFor(() => expect(seedCalls()).toHaveLength(1));

        profile({ permission_mode: 'auto' });
        rerenderFor(SESSION_ID);
        await settle();

        expect(seedCalls()).toEqual([
          ['seed_opencode_permission_mode', { mode: 'manual' }],
        ]);
      });

      it('saves a pick to the profile after this machine, keeping the rest of its Code settings', async () => {
        backend();
        profile({ permission_mode: 'auto', other_setting: 'kept' });
        renderWithApprovalsSlot();
        expect(metadataQuery).toHaveBeenCalledWith(
          { tenantKey: 'acme' },
          { skip: false },
        );

        await pickFromApprovalsMenu('manual');

        await waitFor(() =>
          expect(saveMetadata).toHaveBeenCalledWith({
            tenantKey: 'acme',
            metadata: {
              code_mode: { permission_mode: 'manual', other_setting: 'kept' },
            },
          }),
        );
        expect(saveMetadata).toHaveBeenCalledTimes(1);
        const localSave = invoke.mock.calls.findIndex(
          ([cmd]) => cmd === 'set_opencode_permission_mode',
        );
        expect(invoke.mock.invocationCallOrder[localSave]).toBeLessThan(
          saveMetadata.mock.invocationCallOrder[0],
        );
      });

      it('keeps the pick and only logs it when the profile cannot be saved', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        saveMetadata.mockReturnValue({
          unwrap: async () => {
            throw new Error('offline');
          },
        });
        backend();
        renderWithApprovalsSlot();

        await pickFromApprovalsMenu('manual');

        await waitFor(() =>
          expect(err).toHaveBeenCalledWith(
            '[coding-mode] could not save permission mode to the profile',
            expect.any(Error),
          ),
        );
        expect(toastError).not.toHaveBeenCalled();
        expect(await approvalsButton()).toHaveAccessibleName(
          'Approvals: Ask Me',
        );
        err.mockRestore();
      });

      it('saves a pick on this machine only when no one is signed in to a tenant', async () => {
        localStorage.removeItem('tenant');
        backend();
        renderWithApprovalsSlot();
        expect(metadataQuery).toHaveBeenCalledWith(
          { tenantKey: '' },
          { skip: true },
        );

        await pickFromApprovalsMenu('manual');
        await waitFor(() =>
          expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
            mode: 'manual',
          }),
        );
        await settle();

        expect(saveMetadata).not.toHaveBeenCalled();
      });
    });
  });

  describe('on-device model warning', () => {
    it('uses the cloud model while Local Models is on but no on-device model is picked', async () => {
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      backend();
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(screen.getByRole('switch')).not.toBeDisabled(),
      );
      expect(
        screen.queryByTestId('code-local-model-warning'),
      ).not.toBeInTheDocument();
      expect(invoke).not.toHaveBeenCalledWith(
        'check_code_local_model',
        expect.anything(),
      );
    });

    it('asks for an on-device model when the app is offline and none is picked', async () => {
      offlineMode.current = true;
      backend();
      renderButton();
      await openPopover();

      expect(
        await screen.findByTestId('code-local-model-warning'),
      ).toHaveTextContent(/Pick an on-device model first/);
    });

    // Else the pill stays blue with no x and its switch off.
    it('turns Code off while the app is offline and no on-device model is picked', async () => {
      offlineMode.current = true;
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend();
      renderButton();
      await platformKnown();

      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
      );
      expect(
        screen.queryByRole('button', { name: 'Turn off Code' }),
      ).not.toBeInTheDocument();
    });

    it('names the model the way the model list does when it cannot run Code', async () => {
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3:latest');
      backend({
        local: {
          runtime: 'ollama',
          spec: 'ollama/qwen3:latest',
          model: 'qwen3:latest',
          running: true,
          tools_supported: false,
          reason: "qwen3:latest doesn't support tool calling",
        },
      });
      renderButton();
      await openPopover();

      const warning = await screen.findByTestId('code-local-model-warning');
      await waitFor(() => expect(warning).toHaveTextContent('Qwen 3'));
      expect(warning).not.toHaveTextContent('qwen3:latest');
    });
  });

  describe('toggling with an on-device model', () => {
    it('seeds the prefixed local spec as the Code model when switched on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3');
      backend({
        local: {
          runtime: 'ollama',
          spec: 'ollama/qwen3',
          model: 'qwen3',
          running: true,
          tools_supported: true,
          reason: '',
        },
      });
      renderButton();
      await platformKnown();
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
          'ollama/qwen3',
        ),
      );
      // The verdict effect already wrote the spec; clear it to prove the
      // toggle seeds it again (the send path must never substitute a model).
      localStorage.removeItem('ibl_coding_mode_model');
      await userEvent.click(await pill());
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
        'ollama/qwen3',
      );
      expect(openDialog).not.toHaveBeenCalled();
    });
  });

  describe('workspace actions', () => {
    it('switches this mentor to a fresh workspace', async () => {
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('ibl_coding_mode_mentor', 'mentor-1');
      renderButton();
      await openPopover();
      expect(await screen.findByText('/home/tester/code/demo')).toBeVisible();

      await userEvent.click(
        await screen.findByRole('button', { name: /New Workspace/ }),
      );

      expect(invoke).toHaveBeenCalledWith('new_opencode_workspace', {
        sessionId: SESSION_ID,
        tenant: 'acme',
        mentor: 'mentor-1',
      });
      expect(await screen.findByText('/home/tester/code/fresh')).toBeVisible();
      // A deliberate choice, so first-enable must not re-prompt for a folder.
      expect(localStorage.getItem('ibl_coding_mode_folder_chosen')).toBe(
        'true',
      );
    });

    it('opens the workspace in the platform file manager', async () => {
      userOS.current = 'macOS';
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Open in Finder/ }),
      );

      expect(openPath).toHaveBeenCalledWith('/home/tester/code/demo');
    });

    // The button shipped broken once because the opener capability carried no
    // path scope: every openPath call rejected ("Not allowed to open path …")
    // and the catch swallowed it — a click that silently did nothing. The
    // denial must now be visible.
    it('surfaces an open-folder denial instead of failing silently', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      userOS.current = 'macOS';
      openPath.mockRejectedValue(
        new Error('Not allowed to open path /home/tester/code/demo'),
      );
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Open in Finder/ }),
      );

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith('Couldn’t open the folder'),
      );
      err.mockRestore();
    });

    it('surfaces a failed folder pick', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      openDialog.mockRejectedValue(new Error('dialog exploded'));
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /Select Workspace/ }),
      );

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith('Couldn’t choose a folder'),
      );
      err.mockRestore();
    });

    it('surfaces a failed new-workspace mint', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      backend();
      const base = invoke.getMockImplementation()!;
      invoke.mockImplementation(async (cmd: string, args?: unknown) => {
        if (cmd === 'new_opencode_workspace') throw new Error('mint failed');
        return base(cmd, args);
      });
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('button', { name: /New Workspace/ }),
      );

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          'Couldn’t create a new workspace',
        ),
      );
      err.mockRestore();
    });

    it('names the file manager after the platform', async () => {
      userOS.current = 'Windows';
      renderButton();
      await openPopover();
      expect(
        await screen.findByRole('button', { name: /Open in Explorer/ }),
      ).toBeInTheDocument();
    });

    it('names the probed Linux file manager — that is what will actually open', async () => {
      userOS.current = 'Linux';
      backend({ fileManager: 'Dolphin' });
      renderButton();
      await openPopover();
      expect(
        await screen.findByRole('button', { name: /Open in Dolphin/ }),
      ).toBeInTheDocument();
    });

    it('falls back to the generic label when no Linux handler is known', async () => {
      userOS.current = 'Linux';
      backend({ fileManager: null });
      renderButton();
      await openPopover();
      expect(
        await screen.findByRole('button', { name: /Open Folder/ }),
      ).toBeInTheDocument();
    });

    it('cannot open or replace a workspace before the chat has one', async () => {
      // Rendered directly: passing `undefined` through renderButton would hit
      // its default parameter and silently supply a session id.
      render(
        <TooltipProvider>
          <CodingModeButton approvalsSlot={null} />
        </TooltipProvider>,
      );
      await openPopover();

      expect(
        await screen.findByRole('button', { name: /Open Folder/ }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: /New Workspace/ }),
      ).toBeDisabled();
    });
  });

  it('closes the popover from the inline X without re-triggering it, leaving Code off while it is off', async () => {
    localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
    const { container } = renderButton();
    await openPopover();
    // On from the tap; off again in the popover, which stays open.
    await userEvent.click(await screen.findByRole('switch'));
    await waitFor(() =>
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() =>
      expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false');
    expect(container.querySelector('svg.lucide-x')).toBeNull();
  });

  it('survives a backend that cannot answer at all', async () => {
    invoke.mockRejectedValue(new Error('ipc down'));
    renderButton();
    // Status stays unknown, so Code neither hides nor enables itself.
    expect(
      await screen.findByRole('button', { name: 'Code' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull(),
    );
  });

  describe('skills sync surface', () => {
    // The pill's spinner covers SKILLS loading only (mentor sync + vibe
    // fetch, via the composer's useOpencodeSkillSync) — never the opencode
    // binary install, which stays invisible.
    it('spins in place of the Code icon while skills are syncing', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton(SESSION_ID, { state: 'syncing' });

      expect(await screen.findByTestId('code-skills-loading')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Code' })).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });

    it('shows the Code icon again once the sync settles', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton(SESSION_ID, { state: 'synced', count: 3 });

      await screen.findByRole('button', { name: 'Code' });
      expect(screen.queryByTestId('code-skills-loading')).toBeNull();
      expect(screen.getByRole('button', { name: 'Code' })).toHaveAttribute(
        'aria-busy',
        'false',
      );
    });

    it('never spins while Code is off, whatever the sync is doing', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton(SESSION_ID, { state: 'syncing' });

      await screen.findByRole('button', { name: 'Code' });
      expect(screen.queryByTestId('code-skills-loading')).toBeNull();
    });

    it('surfaces a failed sync as an amber note in the popover', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton(SESSION_ID, { state: 'error' });
      await openPopover();

      expect(await screen.findByTestId('code-skills-sync')).toHaveTextContent(
        /Skills couldn/,
      );
    });

    it('adds no popover UI on the happy path (error-only surface)', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton(SESSION_ID, { state: 'synced', count: 3 });
      await openPopover();

      await screen.findByRole('switch');
      expect(screen.queryByTestId('code-skills-sync')).toBeNull();
    });

    it('fans the toggle out on the local-storage event so the sync hook reacts', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      const fanOut = vi.fn();
      window.addEventListener('local-storage', fanOut);
      try {
        renderButton();
        await platformKnown();
        fanOut.mockClear();
        await openPopover();

        await waitFor(() =>
          expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
        );
        expect(fanOut).toHaveBeenCalled();

        fanOut.mockClear();
        await userEvent.click(await screen.findByRole('switch'));
        await waitFor(() =>
          expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
        );
        expect(fanOut).toHaveBeenCalled();
      } finally {
        window.removeEventListener('local-storage', fanOut);
      }
    });
  });

  // Codex / Claude Code: the Agent choice, its one status line, and the flows
  // behind it. The choice routes turns through the model key alone; the row
  // exists only once the backend has answered for an agent.
  describe('agent (Codex / Claude Code)', () => {
    const agentGroup = () =>
      screen.queryByRole('radiogroup', { name: 'Agent' });

    it('hides the agent choice on a desktop build without the agent commands', async () => {
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('check_code_agent_status', {
          backend: 'codex',
        }),
      );
      expect(agentGroup()).toBeNull();
    });

    it('offers ibl.ai, Codex and Claude Code, with ibl.ai chosen by default', async () => {
      backend({ agents: READY });
      renderButton();
      await openPopover();
      const group = await screen.findByRole('radiogroup', { name: 'Agent' });
      const radios = within(group).getAllByRole('radio');
      expect(radios.map((r) => r.textContent)).toEqual([
        'ibl.ai',
        'Codex',
        'Claude Code',
      ]);
      expect(radios[0]).toHaveAttribute('aria-checked', 'true');
      expect(screen.queryByTestId('code-agent-status')).toBeNull();
    });

    it('choosing Codex routes Code to codex/default and remembers it on this machine only', async () => {
      backend({ agents: READY });
      const fired = vi.fn();
      window.addEventListener('local-storage', fired);
      renderButton();
      await openPopover();
      await userEvent.click(
        await screen.findByRole('radio', { name: 'Codex' }),
      );
      expect(localStorage.getItem('ibl_coding_mode_agent')).toBe('codex');
      expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
        'codex/default',
      );
      expect(fired).toHaveBeenCalled();
      expect(saveMetadata).not.toHaveBeenCalled();
      // Signed in → the quiet ready line names the account.
      expect(
        await screen.findByText('Logged in using ChatGPT'),
      ).toBeInTheDocument();
      window.removeEventListener('local-storage', fired);
    });

    it('keeps the mentor LLM (and its unavailable warning) off an agent’s model', async () => {
      localStorage.setItem('ibl_coding_mode_agent', 'claude');
      localStorage.setItem('ibl_coding_mode_model', 'claude/default');
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
      );
      backend({ agents: READY });
      renderButton();
      await openPopover();
      await screen.findByRole('radiogroup', { name: 'Agent' });
      expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
        'claude/default',
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(screen.queryByText(/isn’t available for Code/)).toBeNull();
    });

    it('lets an agent run while an on-device model without tool calling is selected', async () => {
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'tiny');
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      backend({
        agents: READY,
        local: {
          runtime: 'ollama',
          spec: 'ollama/tiny',
          model: 'tiny',
          running: true,
          tools_supported: false,
          reason: 'tiny cannot call tools',
        },
      });
      renderButton();
      await openPopover();
      await screen.findByRole('radiogroup', { name: 'Agent' });
      expect(screen.getByRole('switch')).not.toBeDisabled();
      expect(invoke).not.toHaveBeenCalledWith(
        'check_code_local_model',
        expect.anything(),
      );
      expect(screen.queryByText(/cannot call tools/)).toBeNull();
    });

    it('seeds the agent’s model when Code is switched on', async () => {
      localStorage.setItem('ibl_coding_mode_agent', 'claude');
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      backend({ agents: READY });
      renderButton();
      await openPopover();
      await userEvent.click(screen.getByRole('switch'));
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
          'claude/default',
        ),
      );
    });

    it('switching back to ibl.ai restores the mentor LLM as the model', async () => {
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      localStorage.setItem('ibl_coding_mode_model', 'codex/default');
      backend({ agents: READY });
      renderButton();
      await openPopover();
      await userEvent.click(
        await screen.findByRole('radio', { name: 'ibl.ai' }),
      );
      expect(localStorage.getItem('ibl_coding_mode_model')).toBe(
        'openai/gpt-4o',
      );
      expect(localStorage.getItem('ibl_coding_mode_agent')).toBe('opencode');
      await waitFor(() =>
        expect(screen.queryByTestId('code-agent-status')).toBeNull(),
      );
    });

    it('switching back never leaves turns on the agent while the mentor LLM is unknown', async () => {
      mentorSettings.current = { llmProvider: '', llmName: '' };
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      localStorage.setItem('ibl_coding_mode_model', 'codex/default');
      backend({ agents: READY });
      renderButton();
      await openPopover();
      await userEvent.click(
        await screen.findByRole('radio', { name: 'ibl.ai' }),
      );
      expect(localStorage.getItem('ibl_coding_mode_model')).toBeNull();
    });

    it('installs a missing agent, showing only its own installer progress, then its status', async () => {
      const state = { installed: false };
      let finishInstall: () => void = () => {};
      extend({
        check_code_agent_status: (args) =>
          (args as { backend: string }).backend === 'codex'
            ? {
                installed: state.installed,
                supported: true,
                signed_in: state.installed ? true : null,
                account: state.installed ? 'Logged in using ChatGPT' : null,
              }
            : READY.claude,
        install_code_agent: () =>
          new Promise<void>((resolve) => {
            finishInstall = () => {
              state.installed = true;
              resolve();
            };
          }),
      });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(await screen.findByText('Not installed')).toBeInTheDocument();
      const install = screen.getByRole('button', { name: 'Install' });
      await userEvent.click(install);
      await waitFor(() => expect(install).toBeDisabled());
      expect(invoke).toHaveBeenCalledWith('install_code_agent', {
        backend: 'codex',
      });
      // Our installer's progress shows; another source's lines do not.
      await waitFor(() =>
        expect(eventHandlers['model:installation-log']).toBeDefined(),
      );
      act(() => {
        eventHandlers['model:installation-log']?.({
          payload: {
            message: 'downloading Node v24…',
            source: 'code-agent',
            backend: 'codex',
          },
        });
      });
      expect(
        await screen.findByText('downloading Node v24…'),
      ).toBeInTheDocument();
      act(() => {
        eventHandlers['model:installation-log']?.({
          payload: {
            message: 'opencode already installed',
            source: 'opencode',
          },
        });
      });
      expect(screen.queryByText('opencode already installed')).toBeNull();
      act(() => finishInstall());
      expect(
        await screen.findByText('Logged in using ChatGPT'),
      ).toBeInTheDocument();
      // The popover owns the listener: up while open, gone once it closes.
      expect(eventHandlers['model:installation-log']).toBeDefined();
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(eventHandlers['model:installation-log']).toBeUndefined(),
      );
    });

    it('leaves out an agent this computer can’t run, and the row once none is left', async () => {
      backend({
        agents: {
          codex: { installed: false, supported: false },
          claude: READY.claude,
        },
      });
      const { unmount } = renderButton();
      await openPopover();
      expect(
        await screen.findByRole('radio', { name: 'Claude Code' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'ibl.ai' })).toBeInTheDocument();
      expect(
        screen.queryByRole('radio', { name: 'Codex' }),
      ).not.toBeInTheDocument();
      unmount();

      invoke.mockClear();
      backend({
        agents: {
          codex: { installed: false, supported: false },
          claude: { installed: false, supported: false },
        },
      });
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('check_code_agent_status', {
          backend: 'claude',
        }),
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(
        screen.queryByRole('radiogroup', { name: 'Agent' }),
      ).not.toBeInTheDocument();
    });

    it('surfaces a failed agent install as a toast and re-enables Install', async () => {
      backend({
        agents: {
          codex: { installed: false, supported: true },
        },
      });
      extend({
        install_code_agent: () => {
          throw new Error('npm install failed: registry unreachable');
        },
      });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Install' }),
      );
      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          'npm install failed: registry unreachable',
        ),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Install' }),
        ).not.toBeDisabled(),
      );
    });

    it('tells Codex users to sign in in the ChatGPT app and checks again on request', async () => {
      const state = { signedIn: false };
      extend({
        check_code_agent_status: (args) =>
          (args as { backend: string }).backend === 'codex'
            ? {
                installed: true,
                supported: true,
                signed_in: state.signedIn,
                account: state.signedIn ? 'Logged in using ChatGPT' : null,
              }
            : READY.claude,
      });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(
        await screen.findByText(/sign in to Codex in the ChatGPT app/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sign in/ })).toBeNull();
      state.signedIn = true;
      await userEvent.click(
        screen.getByRole('button', { name: 'Check Again' }),
      );
      expect(
        await screen.findByText('Logged in using ChatGPT'),
      ).toBeInTheDocument();
    });

    it('tells Claude Code users to sign in from a terminal and checks again on request', async () => {
      const state = { signedIn: false };
      extend({
        check_code_agent_status: (args) =>
          (args as { backend: string }).backend === 'claude'
            ? {
                installed: true,
                supported: true,
                signed_in: state.signedIn,
                account: state.signedIn ? 'me@example.com' : null,
              }
            : READY.codex,
      });
      localStorage.setItem('ibl_coding_mode_agent', 'claude');
      renderButton();
      await openPopover();
      expect(
        await screen.findByText(/Not signed in — run/),
      ).toBeInTheDocument();
      expect(screen.getByText('claude').tagName).toBe('CODE');
      expect(screen.queryByRole('button', { name: /Sign in/ })).toBeNull();
      state.signedIn = true;
      await userEvent.click(
        screen.getByRole('button', { name: 'Check Again' }),
      );
      expect(await screen.findByText('me@example.com')).toBeInTheDocument();
    });

    it('shows an installing agent with a spinner, refuses the choice and keeps ibl.ai usable', async () => {
      backend({
        agents: {
          codex: {
            installed: false,
            supported: true,
            installing: true,
          },
          claude: READY.claude,
        },
      });
      renderButton();
      await openPopover();
      const codex = await screen.findByRole('radio', { name: 'Codex' });
      expect(codex).toBeDisabled();
      expect(codex).toHaveAttribute('aria-busy', 'true');
      expect(codex.querySelector('.animate-spin')).not.toBeNull();
      await userEvent.click(codex);
      expect(localStorage.getItem('ibl_coding_mode_agent')).toBeNull();
      // The finished agent and ibl.ai stay selectable meanwhile.
      const claude = screen.getByRole('radio', { name: 'Claude Code' });
      expect(claude).not.toBeDisabled();
      expect(claude.querySelector('.animate-spin')).toBeNull();
      await userEvent.click(claude);
      expect(localStorage.getItem('ibl_coding_mode_agent')).toBe('claude');
      await userEvent.click(screen.getByRole('radio', { name: 'ibl.ai' }));
      expect(localStorage.getItem('ibl_coding_mode_agent')).toBe('opencode');
      expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
    });

    it('follows a launch-time install to its end: progress by agent, then the account once code-agent:changed lands', async () => {
      const state = { installed: false };
      extend({
        check_code_agent_status: (args) =>
          (args as { backend: string }).backend === 'codex'
            ? state.installed
              ? READY.codex
              : {
                  installed: false,
                  supported: true,
                  installing: true,
                }
            : READY.claude,
      });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(await screen.findByText('Installing…')).toBeInTheDocument();
      // Nothing to click: the desktop is doing it.
      expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
      await waitFor(() =>
        expect(eventHandlers['code-agent:changed']).toBeDefined(),
      );
      // Claude's progress never shows on Codex's line.
      act(() => {
        eventHandlers['model:installation-log']?.({
          payload: {
            message: 'installing claude…',
            source: 'code-agent',
            backend: 'claude',
          },
        });
      });
      expect(screen.getByText('Installing…')).toBeInTheDocument();
      act(() => {
        eventHandlers['model:installation-log']?.({
          payload: {
            message: 'downloading Node v24…',
            source: 'code-agent',
            backend: 'codex',
          },
        });
      });
      expect(
        await screen.findByText('downloading Node v24…'),
      ).toBeInTheDocument();
      state.installed = true;
      act(() => {
        eventHandlers['code-agent:changed']?.({
          payload: { backend: 'codex' },
        });
      });
      expect(
        await screen.findByText('Logged in using ChatGPT'),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Codex' })).not.toBeDisabled();
      expect(invoke).not.toHaveBeenCalledWith(
        'install_code_agent',
        expect.anything(),
      );
    });

    it('shows why a launch-time install failed and offers Install to retry', async () => {
      backend({
        agents: {
          codex: {
            installed: false,
            supported: true,
            error: 'npm install of codex-acp failed: registry unreachable',
          },
        },
      });
      extend({ install_code_agent: () => undefined });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(
        await screen.findByText(
          'npm install of codex-acp failed: registry unreachable',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Codex' })).not.toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: 'Install' }));
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_code_agent', {
          backend: 'codex',
        }),
      );
    });

    it('says a remembered agent isn’t available here, with no radio and no install', async () => {
      backend({
        agents: {
          codex: { installed: false, supported: false },
          claude: READY.claude,
        },
      });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(
        await screen.findByText('Not available on this computer'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Codex' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
    });

    it('keeps the agent choice hidden and quiet when the status command rejects', async () => {
      extend({
        check_code_agent_status: () => {
          // What Tauri says for a command an older desktop lacks: a plain string.
          throw 'command check_code_agent_status not found';
        },
      });
      renderButton();
      await openPopover();
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('check_code_agent_status', {
          backend: 'claude',
        }),
      );
      expect(agentGroup()).toBeNull();
      expect(toastError).not.toHaveBeenCalled();
    });

    it('surfaces the desktop’s plain-string rejection of Install as a toast', async () => {
      // Tauri rejects with the Rust `Err` string itself, not an Error.
      backend({
        agents: {
          codex: READY.codex,
          claude: {
            installed: false,
            supported: true,
          },
        },
      });
      extend({
        install_code_agent: () => {
          throw 'npm install of @agentclientprotocol/claude-agent-acp@0.83.0 failed: exit Some(1): npm ERR! 404 Not Found';
        },
      });
      localStorage.setItem('ibl_coding_mode_agent', 'claude');
      renderButton();
      await openPopover();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Install' }),
      );
      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          'npm install of @agentclientprotocol/claude-agent-acp@0.83.0 failed: exit Some(1): npm ERR! 404 Not Found',
        ),
      );
      expect(screen.getByRole('button', { name: 'Install' })).toBeEnabled();
    });

    it('shows why the sign-in state couldn’t be checked, with Check Again', async () => {
      const state = { known: false };
      extend({
        check_code_agent_status: (args) =>
          (args as { backend: string }).backend === 'codex'
            ? state.known
              ? READY.codex
              : {
                  installed: true,
                  supported: true,
                  signed_in: null,
                  account: null,
                  reason: "Couldn't check the Codex sign-in state.",
                }
            : READY.claude,
      });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(
        await screen.findByText("Couldn't check the Codex sign-in state."),
      ).toBeInTheDocument();
      expect(screen.queryByText('Ready')).toBeNull();
      expect(screen.queryByText(/Not signed in/)).toBeNull();
      state.known = true;
      await userEvent.click(
        screen.getByRole('button', { name: 'Check Again' }),
      );
      expect(
        await screen.findByText('Logged in using ChatGPT'),
      ).toBeInTheDocument();
    });

    it('offers Install for an agent installed at another pin', async () => {
      backend({
        agents: {
          codex: {
            installed: false,
            supported: true,
            reason:
              'Codex needs an update (1.0.0 → 2.0.0) — install it again from the Code menu.',
            error: null,
          },
        },
      });
      extend({ install_code_agent: () => undefined });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(await screen.findByText('Not installed')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Install' }));
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_code_agent', {
          backend: 'codex',
        }),
      );
    });

    it('follows a launch-time install into its failure and offers Install to retry', async () => {
      const state = { failed: false };
      extend({
        check_code_agent_status: (args) =>
          (args as { backend: string }).backend === 'codex'
            ? {
                installed: false,
                supported: true,
                installing: !state.failed,
                error: state.failed
                  ? 'npm install of @agentclientprotocol/codex-acp@2.0.0 failed: exit Some(1): npm ERR! 404 Not Found'
                  : null,
              }
            : READY.claude,
        install_code_agent: () => undefined,
      });
      localStorage.setItem('ibl_coding_mode_agent', 'codex');
      renderButton();
      await openPopover();
      expect(await screen.findByText('Installing…')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Codex' })).toBeDisabled();
      await waitFor(() =>
        expect(eventHandlers['code-agent:changed']).toBeDefined(),
      );
      state.failed = true;
      act(() => {
        eventHandlers['code-agent:changed']?.({
          payload: { backend: 'codex' },
        });
      });
      expect(
        await screen.findByText(/npm ERR! 404 Not Found/),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Codex' })).not.toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: 'Install' }));
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('install_code_agent', {
          backend: 'codex',
        }),
      );
    });
  });
});

describe('CodingModeButton pill label on phone widths', () => {
  // The label is CSS-hidden below 520px while Code is off; once it is on the
  // name shows, unless the composer row is too narrow even for Code beside
  // the ••• (`compact`), where the blue fill alone marks it as on.
  const labelSpan = () => {
    const button = screen.getByRole('button', { name: 'Code' });
    return Array.from(button.querySelectorAll('span')).find(
      (span) => span.textContent === 'Code',
    )!;
  };

  it('hides the label on phones while Code is off', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'false');
    renderButton();
    await screen.findByRole('button', { name: 'Code' });
    expect(labelSpan().className).toContain('max-[520px]:hidden');
  });

  it('shows the label once Code is on', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'true');
    renderButton();
    await screen.findByRole('button', { name: 'Code' });
    expect(labelSpan().className).not.toContain('max-[520px]:hidden');
  });

  it('drops the label, on or off, when the row is too narrow for it', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'true');
    render(
      <TooltipProvider>
        <CodingModeButton sessionId={SESSION_ID} approvalsSlot={null} compact />
      </TooltipProvider>,
    );
    await screen.findByRole('button', { name: 'Code' });
    expect(labelSpan()).toHaveClass('hidden');
  });
});

describe('CodingModeButton in the SDK composer’s tool row', () => {
  // On phone widths the row keeps a name only on the one tool that is on;
  // Code's open popover shows its name and x whatever the row says.
  const labelIn = (trigger: HTMLElement) =>
    Array.from(trigger.querySelectorAll('span')).find(
      (span) => span.textContent === 'Code',
    )!;
  const closeXIn = (trigger: HTMLElement) =>
    trigger.querySelector('svg.lucide-x');

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetApprovalModeForTests();
    backend();
  });

  afterEach(() => {
    toolPill.showName = undefined;
  });

  describe('when the row hides the name', () => {
    beforeEach(() => {
      toolPill.showName = false;
    });

    it('shows its icon and x, and no name, while Code is on beside another tool, its name kept as the button’s name', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton();
      const trigger = await screen.findByRole('button', { name: 'Code' });

      expect(labelIn(trigger)).toHaveClass('sr-only');
      expect(trigger).toHaveAccessibleName('Code');
      await waitFor(() => expect(closeXIn(trigger)).not.toBeNull());
      expect(closeXIn(trigger)).toHaveAccessibleName('Turn off Code');
    });

    it('shows its name and x while the popover is open, and folds to its icon alone once the x turns Code off', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton();
      const trigger = await screen.findByRole('button', { name: 'Code' });

      await userEvent.click(trigger);
      await screen.findByRole('switch');
      expect(labelIn(trigger)).not.toHaveClass('sr-only');
      expect(closeXIn(trigger)).not.toBeNull();

      await userEvent.click(closeXIn(trigger)!);
      await waitFor(() =>
        expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
      );
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false');
      expect(labelIn(trigger)).toHaveClass('sr-only');
      expect(closeXIn(trigger)).toBeNull();
    });

    it('shows only the icon while Code is off, and its name and x once a tap turns it on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton();
      await platformKnown();
      const trigger = await screen.findByRole('button', { name: 'Code' });

      expect(labelIn(trigger)).toHaveClass('sr-only');
      expect(trigger).toHaveAccessibleName('Code');

      await userEvent.click(trigger);
      await screen.findByRole('switch');
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(labelIn(trigger)).not.toHaveClass('sr-only');
      expect(labelIn(trigger)).not.toHaveClass('max-[520px]:hidden');
      expect(
        screen.getByRole('button', { name: 'Turn off Code' }),
      ).toBeInTheDocument();
    });

    it('still drops the name in a row too narrow for it, popover open or not', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      render(
        <TooltipProvider>
          <CodingModeButton
            sessionId={SESSION_ID}
            approvalsSlot={null}
            compact
          />
        </TooltipProvider>,
      );
      await platformKnown();
      const trigger = await screen.findByRole('button', { name: 'Code' });
      expect(labelIn(trigger)).toHaveClass('hidden');

      await userEvent.click(trigger);
      expect(await screen.findByRole('switch')).toBeChecked();
      expect(labelIn(trigger)).toHaveClass('hidden');
    });
  });

  // Unset = the real hook outside the row: the OS's own composer.
  describe.each([
    ['outside the row', undefined],
    ['when the row shows the name', true],
  ])('%s, as before the row', (_, showName) => {
    beforeEach(() => {
      toolPill.showName = showName;
    });

    it('hides the name on phones while Code is off, and shows it with the x once a tap turns it on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton();
      await platformKnown();
      const trigger = await screen.findByRole('button', { name: 'Code' });
      expect(labelIn(trigger).className).toBe('max-[520px]:hidden');

      await userEvent.click(trigger);
      await screen.findByRole('switch');
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
      expect(labelIn(trigger).className).toBe('');
      expect(
        screen.getByRole('button', { name: 'Turn off Code' }),
      ).toBeInTheDocument();
    });

    it('shows the name while Code is on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton();
      const trigger = await screen.findByRole('button', { name: 'Code' });
      expect(labelIn(trigger).className).toBe('');
    });
  });

  describe('what it tells the row', () => {
    it('is on while Code is on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton();
      await screen.findByRole('button', { name: 'Code' });
      await waitFor(() =>
        expect(invoke.mock.calls.map(([cmd]) => cmd)).toContain(
          'check_opencode_status',
        ),
      );
      expect(toolPill.registered.mock.lastCall).toEqual([true]);
    });

    it('is off while Code is off, its popover open included', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      renderButton();
      await platformKnown();
      expect(toolPill.registered).toHaveBeenCalled();
      expect(toolPill.registered).not.toHaveBeenCalledWith(true);

      // On from the tap, then off again with the popover still open.
      await openPopover();
      await userEvent.click(await screen.findByRole('switch'));
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('false'),
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
      expect(toolPill.registered.mock.lastCall).toEqual([false]);
    });

    it('is off while Code is switched on but cannot run yet (its on-device model still unchecked)', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      localStorage.setItem('ibl_local_llm_enabled', 'true');
      localStorage.setItem('ibl_local_llm_model', 'qwen3');
      renderButton();
      await screen.findByRole('button', { name: 'Code' });
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('check_code_local_model', {
          model: 'qwen3',
        }),
      );

      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      expect(toolPill.registered).toHaveBeenCalled();
      expect(toolPill.registered).not.toHaveBeenCalledWith(true);
    });

    it('is off where Code cannot run at all and the pill is hidden', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      backend({ sandboxed: true });
      const { container } = renderButton();
      await waitFor(() => expect(container).toBeEmptyDOMElement());

      expect(toolPill.registered.mock.lastCall).toEqual([false]);
    });
  });
});
