import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CodingModeButton } from '../coding-mode-button';
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
  openDialog,
  openPath,
  scannerState,
  mentorSettings,
  offlineMode,
  platformMetadata,
  saveMetadata,
  tauriPlatform,
  toastError,
  userOS,
} = vi.hoisted(() => ({
  invoke: vi.fn(),
  openDialog: vi.fn(),
  openPath: vi.fn(),
  toastError: vi.fn(),
  mentorSettings: { current: { llmProvider: 'openai', llmName: 'gpt-4o' } },
  offlineMode: { current: false },
  // The DM-backed copy of the approval mode; `undefined` data = still loading.
  platformMetadata: { current: undefined as unknown },
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
  useGetUserPlatformMetadataQuery: () => ({ data: platformMetadata.current }),
  useUpdateUserPlatformMetadataMutation: () => [saveMetadata],
}));
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
    /** The locally cached approval mode; null = never chosen. */
    permissionMode?: string | null;
    /** Phone↔desktop pairing state (Tauri mobile). */
    remoteHost?: unknown;
  } = {},
) {
  invoke.mockImplementation(async (cmd: string) => {
    switch (cmd) {
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
        // `??` would swallow an explicit null, which is the "never chosen" case.
        return 'permissionMode' in overrides
          ? overrides.permissionMode
          : 'manual';
      case 'check_code_local_model':
        return overrides.local;
      case 'remote_code_get_host':
        return overrides.remoteHost ?? { configured: false, connected: false };
      case 'remote_code_set_host':
        return { ok: true };
      case 'remote_code_clear_host':
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

const renderButton = (
  sessionId: string | undefined = SESSION_ID,
  skillSync?: OpencodeSkillSync,
) =>
  render(
    <TooltipProvider>
      <CodingModeButton sessionId={sessionId} skillSync={skillSync} />
    </TooltipProvider>,
  );

/** Open the popover so its contents are in the DOM. */
async function openPopover() {
  await userEvent.click(await screen.findByRole('button', { name: /Code/i }));
}

describe('CodingModeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mentorSettings.current = { llmProvider: 'openai', llmName: 'gpt-4o' };
    offlineMode.current = false;
    platformMetadata.current = undefined;
    saveMetadata.mockReturnValue({ unwrap: async () => ({}) });
    userOS.current = 'Linux';
    tauriPlatform.current = 'linux';
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

    it('enables without the desktop folder-choice flow (no picker on a phone)', async () => {
      backend({
        remoteHost: { configured: true, connected: true, url: 'http://x:1' },
      });
      renderButton();
      await openPopover();
      const sw = screen.getByRole('switch');
      await waitFor(() => expect(sw).not.toBeDisabled());
      await userEvent.click(sw);
      await waitFor(() =>
        expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true'),
      );
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
      await openPopover();
      // Paired and unblocked — yet no silent default-on.
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBeNull();
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

      it('falls over to the next advertised address when the first refuses', async () => {
        let attempts = 0;
        extend({
          remote_code_set_host: (args) => {
            attempts += 1;
            if ((args as { url: string }).url.includes('192.168.0.10')) {
              throw new Error('connection refused');
            }
            return { ok: true };
          },
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
        await waitFor(() => expect(attempts).toBe(2));
        expect(invoke).toHaveBeenLastCalledWith(
          'remote_code_get_host',
          undefined,
        );
        expect(screen.queryByText('connection refused')).toBeNull();
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

    it('leaves a deliberately disabled host alone on launch', async () => {
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
        await screen.findByText(/doesn't support tool calling/),
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
        await screen.findByText(/doesn't report tool-calling support/),
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
          <CodingModeButton />
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

  describe('toggling', () => {
    it('forces a deliberate folder choice the first time Code is switched on', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('tenant', 'acme');
      localStorage.setItem('dm_token', 'jwt-test-token');
      openDialog.mockResolvedValue('/home/tester/other');
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

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

    it('does not re-prompt for a folder once one is chosen', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      localStorage.setItem('ibl_coding_mode_folder_chosen', 'true');
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

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
        // Already chosen, so the first-run dialog stays out of the way.
        if (cmd === 'get_opencode_permission_mode') return 'manual';
        return undefined;
      });
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

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
      await userEvent.click(await screen.findByRole('switch'));
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
        if (cmd === 'get_opencode_permission_mode') return 'manual';
        return '/home/tester/code/demo';
      });
      renderButton();
      await openPopover();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() => expect(err).toHaveBeenCalled());
      // Code is still ON — the flag is the user's choice, not the install's verdict.
      expect(localStorage.getItem('ibl_coding_mode_enabled')).toBe('true');
      err.mockRestore();
    });
  });

  /**
   * The approval mode decides whether the agent asks before touching files, so
   * neither answer may be assumed: unknown means ask, and the answer has to
   * reach both the backend that enforces it and DM, which carries it to the
   * user's other machines.
   */
  describe('approval mode', () => {
    const openDialogEl = () =>
      screen.findByTestId('code-permission-mode-dialog');

    it('asks on first engagement when no mode has ever been chosen', async () => {
      localStorage.setItem('tenant', 'acme');
      backend({ permissionMode: null });
      renderButton();
      await openPopover();

      await openDialogEl();
      await userEvent.click(
        screen.getByRole('button', { name: /Approve automatically/ }),
      );

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
          mode: 'auto',
        }),
      );
      // …and it follows the user to their other devices.
      expect(saveMetadata).toHaveBeenCalledWith({
        tenantKey: 'acme',
        metadata: { code_mode: { permission_mode: 'auto' } },
      });
      await waitFor(() =>
        expect(
          screen.queryByTestId('code-permission-mode-dialog'),
        ).not.toBeInTheDocument(),
      );
    });

    it('does not ask again once a mode is saved', async () => {
      backend({ permissionMode: 'manual' });
      renderButton();
      await openPopover();

      await screen.findByRole('radio', { name: /Ask Me/ });
      expect(
        screen.queryByTestId('code-permission-mode-dialog'),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Ask Me/ })).toBeChecked();
    });

    it('lets DM override a stale local copy and re-applies it to the backend', async () => {
      backend({ permissionMode: 'manual' });
      platformMetadata.current = {
        metadata: { code_mode: { permission_mode: 'auto' } },
      };
      renderButton();
      await openPopover();

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
          mode: 'auto',
        }),
      );
      expect(await screen.findByTestId('code-auto-mode-hint')).toBeVisible();
    });

    it('keeps the choice when DM refuses to store it', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem('tenant', 'acme');
      saveMetadata.mockReturnValue({
        unwrap: async () => {
          throw new Error('offline');
        },
      });
      backend({ permissionMode: 'manual' });
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('radio', { name: /Automatic/ }),
      );

      await waitFor(() => expect(err).toHaveBeenCalled());
      // Reverting under the user would be worse than a failed sync.
      expect(screen.getByRole('radio', { name: /Automatic/ })).toBeChecked();
      err.mockRestore();
    });

    it('records "ask me each time" from the first-engagement dialog', async () => {
      localStorage.setItem('tenant', 'acme');
      backend({ permissionMode: null });
      renderButton();
      await openPopover();

      await openDialogEl();
      await userEvent.click(
        screen.getByRole('button', { name: /Ask me each time/ }),
      );

      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
          mode: 'manual',
        }),
      );
      expect(saveMetadata).toHaveBeenCalledWith({
        tenantKey: 'acme',
        metadata: { code_mode: { permission_mode: 'manual' } },
      });
    });

    it('keeps the choice when the backend refuses it, and skips DM when signed out', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      backend({ permissionMode: 'manual' });
      extend({
        set_opencode_permission_mode: () => {
          throw new Error('config locked');
        },
      });
      renderButton();
      await openPopover();

      await userEvent.click(
        await screen.findByRole('radio', { name: /Automatic/ }),
      );

      await waitFor(() =>
        expect(err).toHaveBeenCalledWith(
          '[coding-mode] could not apply permission mode',
          expect.any(Error),
        ),
      );
      expect(screen.getByRole('radio', { name: /Automatic/ })).toBeChecked();
      // No tenant → nothing to sync to DM.
      expect(saveMetadata).not.toHaveBeenCalled();
      err.mockRestore();
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
      await openPopover();
      const sw = await screen.findByRole('switch');
      await waitFor(() => expect(sw).toBeEnabled());
      // The verdict effect already wrote the spec; clear it to prove the
      // toggle seeds it again (the send path must never substitute a model).
      localStorage.removeItem('ibl_coding_mode_model');
      await userEvent.click(sw);
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
          <CodingModeButton />
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

  it('closes the popover from the inline X without re-triggering it', async () => {
    const { container } = renderButton();
    await openPopover();
    await screen.findByRole('switch');

    const close = container.querySelector('svg.lucide-x');
    await userEvent.click(close!);

    await waitFor(() =>
      expect(screen.queryByRole('switch')).not.toBeInTheDocument(),
    );
  });

  it('survives a backend that cannot answer at all', async () => {
    invoke.mockRejectedValue(new Error('ipc down'));
    renderButton();
    // Status stays unknown, so Code neither hides nor enables itself.
    expect(
      await screen.findByRole('button', { name: /Code/i }),
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
      expect(screen.getByRole('button', { name: /Code/i })).toHaveAttribute(
        'aria-busy',
        'true',
      );
    });

    it('shows the Code icon again once the sync settles', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'true');
      renderButton(SESSION_ID, { state: 'synced', count: 3 });

      await screen.findByRole('button', { name: /Code/i });
      expect(screen.queryByTestId('code-skills-loading')).toBeNull();
      expect(screen.getByRole('button', { name: /Code/i })).toHaveAttribute(
        'aria-busy',
        'false',
      );
    });

    it('never spins while Code is off, whatever the sync is doing', async () => {
      localStorage.setItem('ibl_coding_mode_enabled', 'false');
      renderButton(SESSION_ID, { state: 'syncing' });

      await screen.findByRole('button', { name: /Code/i });
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
        await openPopover();

        await userEvent.click(await screen.findByRole('switch'));
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
});

describe('CodingModeButton pill label on phone widths', () => {
  // The label is CSS-hidden below 520px ONLY while Code is off; once it is
  // on the name always shows so the user can see what is selected.
  const labelSpan = () => {
    const button = screen.getByRole('button', { name: /Code/i });
    return Array.from(button.querySelectorAll('span')).find(
      (span) => span.textContent === 'Code',
    )!;
  };

  it('hides the label on phones while Code is off', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'false');
    renderButton();
    await screen.findByRole('button', { name: /Code/i });
    expect(labelSpan().className).toContain('max-[520px]:hidden');
  });

  it('always shows the label once Code is on', async () => {
    localStorage.setItem('ibl_coding_mode_enabled', 'true');
    renderButton();
    await screen.findByRole('button', { name: /Code/i });
    expect(labelSpan().className).not.toContain('max-[520px]:hidden');
  });
});
