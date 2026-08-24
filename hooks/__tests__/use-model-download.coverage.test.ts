import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import * as useTauriModule from '../use-tauri';
import * as useLocalStorageModule from '../use-local-storage';
import {
  TAURI_COMMANDS as C,
  TAURI_EVENTS as E,
  initialModelDownloadState,
  type ModelDownloadState,
} from '@/types/tauri';

vi.mock('../use-tauri');
vi.mock('../use-local-storage');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('@/types/tauri', async () => {
  const actual =
    await vi.importActual<typeof import('@/types/tauri')>('@/types/tauri');
  return {
    ...actual,
    isTauriApp: vi.fn(() => true),
  };
});

// localStorage stub so the offline-mode probe has something to read.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

import { useModelDownload } from '../use-model-download';

type InvokeHandlers = Record<string, unknown | ((args?: unknown) => unknown)>;
type EventHandler = (payload: unknown) => void;

describe('useModelDownload — full coverage', () => {
  let mockInvoke: Mock;
  let mockListen: Mock;
  let setState: Mock;
  let setDismissed: Mock;
  let storeState: ModelDownloadState;
  let statusLog: string[];
  let dismissed: boolean;
  let ollamaStatusStore: { installed?: boolean } | null;
  let setOllamaStatus: Mock;
  let listeners: Record<string, EventHandler>;
  let unlisten: Mock;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  const setInvoke = (handlers: InvokeHandlers = {}) => {
    mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
      if (Object.prototype.hasOwnProperty.call(handlers, cmd)) {
        const h = handlers[cmd];
        return typeof h === 'function'
          ? (h as (a?: unknown) => unknown)(args)
          : h;
      }
      // Sensible defaults so the mount-time status check never explodes.
      if (cmd === C.CHECK_FOUNDRY_STATUS) return null;
      if (cmd === C.CHECK_OLLAMA_STATUS)
        return { installed: false, running: false, model_installed: false };
      return null;
    });
  };

  /** A Foundry status payload with the supplied models. */
  const foundry = (
    models: Array<Record<string, unknown>>,
    overrides: Record<string, unknown> = {},
  ) => ({
    is_windows: false,
    is_supported: true,
    is_available: true,
    has_models: models.length > 0,
    models,
    endpoint: 'http://localhost:5273',
    ...overrides,
  });

  const renderReady = async () => {
    const utils = renderHook(() => useModelDownload());
    await waitFor(() =>
      expect(mockListen).toHaveBeenCalledWith(
        E.DOWNLOAD_PROGRESS,
        expect.any(Function),
      ),
    );
    await flush();
    return utils;
  };

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockInvoke = vi.fn();
    setInvoke();

    listeners = {};
    unlisten = vi.fn();
    mockListen = vi.fn(async (event: string, cb: EventHandler) => {
      listeners[event] = cb;
      return unlisten;
    });

    storeState = { ...initialModelDownloadState };
    statusLog = [];
    dismissed = false;
    // Real updater semantics so the inner setState bodies actually execute.
    setState = vi.fn((arg: unknown) => {
      storeState =
        typeof arg === 'function'
          ? (arg as (p: ModelDownloadState) => ModelDownloadState)(storeState)
          : (arg as ModelDownloadState);
      statusLog.push(storeState.status);
    });
    setDismissed = vi.fn((arg: unknown) => {
      dismissed =
        typeof arg === 'function'
          ? (arg as (p: boolean) => boolean)(dismissed)
          : (arg as boolean);
    });

    vi.mocked(useTauriModule.useTauri).mockReturnValue({
      isAvailable: true,
      invoke: mockInvoke as never,
      listen: mockListen as never,
    });
    ollamaStatusStore = null;
    setOllamaStatus = vi.fn((arg: unknown) => {
      ollamaStatusStore =
        typeof arg === 'function'
          ? (arg as (p: unknown) => { installed?: boolean } | null)(
              ollamaStatusStore,
            )
          : (arg as { installed?: boolean } | null);
    });
    vi.mocked(useLocalStorageModule.useLocalStorage).mockImplementation(((
      key: string,
      def: unknown,
    ) => {
      if (key === 'model_download_state')
        return [storeState, setState, vi.fn()];
      if (key === 'model_download_prompt_dismissed')
        return [dismissed, setDismissed, vi.fn()];
      if (key === 'ollama_status')
        return [ollamaStatusStore, setOllamaStatus, vi.fn()];
      return [def, vi.fn(), vi.fn()];
    }) as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    delete (window as any).__TAURI_OFFLINE_MODE__;
  });

  // ----- Event listeners ---------------------------------------------------

  describe('event listeners', () => {
    it('updates state on a downloading progress event', async () => {
      await renderReady();

      act(() => {
        listeners[E.DOWNLOAD_PROGRESS]({
          status: 'downloading',
          percentage: 42,
          message: 'Downloading…',
        });
      });

      expect(storeState.status).toBe('downloading');
      expect(storeState.progress).toBe(42);
    });

    it('refreshes status on a completed progress event', async () => {
      await renderReady();
      mockInvoke.mockClear();

      act(() => {
        listeners[E.DOWNLOAD_PROGRESS]({
          status: 'completed',
          percentage: 100,
          message: 'Done',
        });
      });

      expect(statusLog).toContain('completed');
      // completed → checkStatusRef.current() re-checks the backend.
      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith(C.CHECK_FOUNDRY_STATUS),
      );
    });

    it('maps cancelled and error progress statuses', async () => {
      await renderReady();

      act(() => {
        listeners[E.DOWNLOAD_PROGRESS]({
          status: 'cancelled',
          percentage: 0,
          message: 'Cancelled',
        });
      });
      expect(storeState.status).toBe('cancelled');

      act(() => {
        listeners[E.DOWNLOAD_PROGRESS]({
          status: 'error',
          percentage: 0,
          message: 'Boom',
        });
      });
      expect(storeState.status).toBe('error');
    });

    it('appends installation log entries (bounded to MAX_LOGS)', async () => {
      storeState = {
        ...initialModelDownloadState,
        logs: Array.from({ length: 100 }, (_, i) => ({
          timestamp: 't',
          level: 'info' as const,
          message: `log-${i}`,
        })),
      };

      await renderReady();

      act(() => {
        listeners[E.INSTALLATION_LOG]({
          timestamp: 't',
          level: 'info',
          message: 'newest',
        });
      });

      expect(storeState.logs.length).toBe(100);
      expect(storeState.logs[storeState.logs.length - 1].message).toBe(
        'newest',
      );
    });

    it('surfaces disk-space errors via state and a toast', async () => {
      await renderReady();

      act(() => {
        listeners[E.DISK_SPACE_ERROR]({
          required_gb: 10,
          available_gb: 1,
          message: 'Not enough space',
        });
      });

      expect(storeState.status).toBe('error');
      expect(storeState.error).toBe('Not enough space');
      expect(toast.error).toHaveBeenCalledWith('Not enough space');
    });

    it('forwards ollama status events to state', async () => {
      await renderReady();

      act(() => {
        listeners[E.OLLAMA_STATUS]({
          installed: true,
          running: true,
          model_installed: false,
        });
      });

      // ollamaStatus is persisted via useLocalStorage (shared across instances);
      // the mocked setter writes the store, so assert against that.
      await waitFor(() => expect(ollamaStatusStore?.installed).toBe(true));
    });

    it('logs when listener setup fails', async () => {
      mockListen.mockRejectedValueOnce(new Error('listen boom'));

      renderHook(() => useModelDownload());

      await waitFor(() =>
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to setup Tauri event listeners:',
          expect.any(Error),
        ),
      );
    });

    it('cleans up listeners on unmount', async () => {
      const { unmount } = await renderReady();
      unmount();
      await waitFor(() => expect(unlisten).toHaveBeenCalled());
    });
  });

  // ----- checkStatus: Foundry paths ---------------------------------------

  describe('checkStatus — Foundry Local', () => {
    it('loads a saved, already-downloaded model', async () => {
      setInvoke({
        [C.CHECK_FOUNDRY_STATUS]: foundry([
          { id: 'm1', name: 'M1', foundry_id: 'f1', is_downloaded: true },
        ]),
        [C.GET_SELECTED_FOUNDRY_MODEL]: 'm1',
        [C.CHECK_OLLAMA_STATUS]: {
          installed: true,
          running: true,
          model_installed: true,
        },
      });

      const utils = await renderReady();

      await waitFor(() =>
        expect(utils.result.current.isUsingFoundry).toBe(true),
      );
      expect(utils.result.current.selectedFoundryModel).toBe('m1');
      expect(mockInvoke).toHaveBeenCalledWith(C.LOAD_FOUNDRY_MODEL, {
        modelId: 'f1',
      });
      expect(storeState.status).toBe('completed');
    });

    it('falls back to the first model when the saved one is gone', async () => {
      setInvoke({
        [C.CHECK_FOUNDRY_STATUS]: foundry([
          { id: 'm1', name: 'M1', foundry_id: 'f1', is_downloaded: false },
        ]),
        [C.GET_SELECTED_FOUNDRY_MODEL]: 'does-not-exist',
      });

      const utils = await renderReady();

      await waitFor(() =>
        expect(utils.result.current.selectedFoundryModel).toBe('m1'),
      );
      // First model is not downloaded → no auto-load.
      expect(mockInvoke).not.toHaveBeenCalledWith(
        C.LOAD_FOUNDRY_MODEL,
        expect.anything(),
      );
      expect(mockInvoke).toHaveBeenCalledWith(C.SET_SELECTED_FOUNDRY_MODEL, {
        modelId: 'm1',
      });
    });

    it('defaults to the first model when nothing is saved', async () => {
      setInvoke({
        [C.CHECK_FOUNDRY_STATUS]: foundry([
          { id: 'm1', name: 'M1', foundry_id: 'f1', is_downloaded: true },
        ]),
        [C.GET_SELECTED_FOUNDRY_MODEL]: null,
      });

      const utils = await renderReady();

      await waitFor(() =>
        expect(utils.result.current.selectedFoundryModel).toBe('m1'),
      );
      expect(mockInvoke).toHaveBeenCalledWith(C.SET_SELECTED_FOUNDRY_MODEL, {
        modelId: 'm1',
      });
    });

    it('recovers when reading the saved selection throws', async () => {
      setInvoke({
        [C.CHECK_FOUNDRY_STATUS]: foundry([
          { id: 'm1', name: 'M1', foundry_id: 'f1', is_downloaded: true },
        ]),
        [C.GET_SELECTED_FOUNDRY_MODEL]: () =>
          Promise.reject(new Error('read failed')),
      });

      const utils = await renderReady();

      // Falls back to the first model in the catch block.
      await waitFor(() =>
        expect(utils.result.current.selectedFoundryModel).toBe('m1'),
      );
    });

    it('shows the install prompt when Foundry is supported but empty', async () => {
      setInvoke({
        [C.CHECK_FOUNDRY_STATUS]: foundry([], { has_models: false }),
        [C.CHECK_OLLAMA_STATUS]: {
          installed: true,
          running: true,
          model_installed: true,
        },
      });

      const utils = await renderReady();

      await waitFor(() => expect(storeState.status).toBe('completed'));
      // Not using Foundry because it has no models → Ollama is the backend.
      expect(utils.result.current.isUsingFoundry).toBe(false);
    });
  });

  // ----- checkStatus: Ollama fallback -------------------------------------

  describe('checkStatus — Ollama fallback', () => {
    it('marks completed when the model is already installed', async () => {
      setInvoke({
        [C.CHECK_OLLAMA_STATUS]: {
          installed: true,
          running: true,
          model_installed: true,
        },
      });

      await renderReady();

      await waitFor(() => expect(storeState.status).toBe('completed'));
      expect(storeState.message).toBe('Model installed');
    });

    it('returns to idle when no model is installed', async () => {
      setInvoke({
        [C.CHECK_OLLAMA_STATUS]: {
          installed: true,
          running: true,
          model_installed: false,
        },
      });

      await renderReady();

      await waitFor(() => expect(storeState.status).toBe('idle'));
    });

    it('returns to idle when the status check throws', async () => {
      setInvoke({
        [C.CHECK_FOUNDRY_STATUS]: () =>
          Promise.reject(new Error('status boom')),
      });

      await renderReady();

      await waitFor(() => expect(storeState.status).toBe('idle'));
    });
  });

  // ----- startDownload -----------------------------------------------------

  describe('startDownload', () => {
    it('completes a successful download and refreshes status', async () => {
      setInvoke({
        [C.CHECK_DISK_SPACE]: true,
        [C.DOWNLOAD_MODEL]: undefined,
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.startDownload('phi3:mini');
      });

      expect(mockInvoke).toHaveBeenCalledWith(C.DOWNLOAD_MODEL, {
        model: 'phi3:mini',
      });
      // The download is marked complete before the follow-up status refresh.
      expect(statusLog).toContain('completed');
      expect(toast.success).toHaveBeenCalledWith(
        'Model downloaded successfully!',
      );
    });

    it('aborts early when there is not enough disk space', async () => {
      setInvoke({ [C.CHECK_DISK_SPACE]: false });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.startDownload();
      });

      expect(mockInvoke).not.toHaveBeenCalledWith(
        C.DOWNLOAD_MODEL,
        expect.anything(),
      );
      // The disk-space error is surfaced through the event channel, not here.
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('reports a failed download via state and a toast', async () => {
      setInvoke({
        [C.CHECK_DISK_SPACE]: true,
        [C.DOWNLOAD_MODEL]: () => Promise.reject(new Error('pull failed')),
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.startDownload();
      });

      expect(storeState.status).toBe('error');
      expect(storeState.error).toBe('pull failed');
      expect(toast.error).toHaveBeenCalledWith('Download failed: pull failed');
    });

    it('suppresses the error toast when a cancellation already landed', async () => {
      let rejectDownload: (e: unknown) => void = () => {};
      setInvoke({
        [C.CHECK_DISK_SPACE]: true,
        [C.DOWNLOAD_MODEL]: () =>
          new Promise((_, rej) => {
            rejectDownload = rej;
          }),
        [C.CANCEL_DOWNLOAD]: undefined,
      });

      const { result } = await renderReady();

      let downloadPromise: Promise<void> | undefined;
      act(() => {
        downloadPromise = result.current.startDownload();
      });
      await flush(); // pass the disk check, reach the pending pull

      await act(async () => {
        await result.current.cancelDownload();
      });

      await act(async () => {
        rejectDownload(new Error('aborted'));
        await downloadPromise?.catch(() => {});
      });

      expect(storeState.status).toBe('cancelled');
      expect(toast.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Download failed'),
      );
    });
  });

  // ----- cancelDownload ----------------------------------------------------

  describe('cancelDownload', () => {
    it('marks the state cancelled and notifies the backend', async () => {
      setInvoke({ [C.CANCEL_DOWNLOAD]: undefined });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.cancelDownload();
      });

      expect(storeState.status).toBe('cancelled');
      expect(mockInvoke).toHaveBeenCalledWith(C.CANCEL_DOWNLOAD);
      expect(toast.info).toHaveBeenCalledWith('Download cancelled');
    });

    it('logs but does not throw when the backend cancel fails', async () => {
      setInvoke({
        [C.CANCEL_DOWNLOAD]: () => Promise.reject(new Error('cancel failed')),
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.cancelDownload();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to cancel download:',
        expect.any(Error),
      );
    });
  });

  // ----- installOllama -----------------------------------------------------

  describe('installOllama', () => {
    it('installs, succeeds, and re-checks until running', async () => {
      setInvoke({
        [C.INSTALL_OLLAMA]: 'Ollama ready',
        [C.CHECK_OLLAMA_STATUS]: {
          installed: true,
          running: true,
          model_installed: false,
        },
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.installOllama();
      });
      await flush();

      expect(mockInvoke).toHaveBeenCalledWith(C.INSTALL_OLLAMA);
      expect(toast.success).toHaveBeenCalledWith('Ollama ready');
      expect(storeState.managerInstalling).toBe(false);
    });

    it('reports an installation failure', async () => {
      setInvoke({
        [C.INSTALL_OLLAMA]: () => Promise.reject(new Error('install boom')),
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.installOllama();
      });

      expect(storeState.status).toBe('error');
      expect(storeState.error).toBe('install boom');
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to enable local models: install boom',
      );
    });
  });

  // ----- stopManager -------------------------------------------------------

  describe('stopManager', () => {
    it('stops the manager and re-checks status', async () => {
      setInvoke({ [C.STOP_OLLAMA]: undefined });

      const { result } = await renderReady();
      mockInvoke.mockClear();

      await act(async () => {
        await result.current.stopManager();
      });

      expect(mockInvoke).toHaveBeenCalledWith(C.STOP_OLLAMA);
      // checkStatus runs afterwards.
      expect(mockInvoke).toHaveBeenCalledWith(C.CHECK_FOUNDRY_STATUS);
    });

    it('logs when stopping the manager fails', async () => {
      setInvoke({
        [C.STOP_OLLAMA]: () => Promise.reject(new Error('stop boom')),
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.stopManager();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to stop model manager:',
        'stop boom',
      );
    });
  });

  // ----- installFoundry ----------------------------------------------------

  describe('installFoundry', () => {
    it('installs Foundry and pulls the default model', async () => {
      setInvoke({
        [C.INSTALL_FOUNDRY]: 'Foundry installed',
        [C.DOWNLOAD_FOUNDRY_MODEL]: undefined,
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.installFoundry();
      });

      expect(mockInvoke).toHaveBeenCalledWith(C.INSTALL_FOUNDRY);
      expect(mockInvoke).toHaveBeenCalledWith(C.DOWNLOAD_FOUNDRY_MODEL, {
        modelId: 'qwen2.5-0.5b',
      });
      // Marked complete before the trailing checkStatus() refresh runs.
      expect(statusLog).toContain('completed');
    });

    it('reports a Foundry install failure', async () => {
      setInvoke({
        [C.INSTALL_FOUNDRY]: () => Promise.reject(new Error('foundry boom')),
      });

      const { result } = await renderReady();

      await act(async () => {
        await result.current.installFoundry();
      });

      expect(storeState.status).toBe('error');
      expect(storeState.error).toBe('foundry boom');
    });
  });

  // ----- onSelectFoundryModel ---------------------------------------------

  describe('onSelectFoundryModel', () => {
    const withFoundryModels = (model: Record<string, unknown>) => ({
      [C.CHECK_FOUNDRY_STATUS]: foundry([model]),
      [C.GET_SELECTED_FOUNDRY_MODEL]: null,
    });

    it('toasts when the requested model is unknown', async () => {
      const { result } = await renderReady();

      await act(async () => {
        await result.current.onSelectFoundryModel('ghost');
      });

      expect(toast.error).toHaveBeenCalledWith('Model not found');
    });

    it('downloads then loads a not-yet-downloaded model', async () => {
      setInvoke({
        ...withFoundryModels({
          id: 'm1',
          name: 'M1',
          foundry_id: 'f1',
          is_downloaded: false,
        }),
        [C.SET_SELECTED_FOUNDRY_MODEL]: undefined,
        [C.DOWNLOAD_FOUNDRY_MODEL]: undefined,
        [C.LOAD_FOUNDRY_MODEL]: undefined,
      });

      const { result } = await renderReady();
      await waitFor(() => expect(result.current.foundryModels.length).toBe(1));

      await act(async () => {
        await result.current.onSelectFoundryModel('m1');
      });

      expect(mockInvoke).toHaveBeenCalledWith(C.DOWNLOAD_FOUNDRY_MODEL, {
        modelId: 'f1',
      });
      expect(mockInvoke).toHaveBeenCalledWith(C.LOAD_FOUNDRY_MODEL, {
        modelId: 'f1',
      });
      expect(storeState.status).toBe('completed');
      expect(toast.success).toHaveBeenCalledWith(
        'Model downloaded and loaded: M1',
      );
    });

    it('reports a download failure for a not-yet-downloaded model', async () => {
      setInvoke({
        ...withFoundryModels({
          id: 'm1',
          name: 'M1',
          foundry_id: 'f1',
          is_downloaded: false,
        }),
        [C.SET_SELECTED_FOUNDRY_MODEL]: undefined,
        [C.DOWNLOAD_FOUNDRY_MODEL]: () =>
          Promise.reject(new Error('dl failed')),
      });

      const { result } = await renderReady();
      await waitFor(() => expect(result.current.foundryModels.length).toBe(1));

      await act(async () => {
        await result.current.onSelectFoundryModel('m1');
      });

      expect(storeState.status).toBe('error');
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to download model: dl failed',
      );
    });

    it('loads an already-downloaded model directly', async () => {
      setInvoke({
        ...withFoundryModels({
          id: 'm1',
          name: 'M1',
          foundry_id: 'f1',
          is_downloaded: true,
        }),
        [C.SET_SELECTED_FOUNDRY_MODEL]: undefined,
        [C.LOAD_FOUNDRY_MODEL]: undefined,
      });

      const { result } = await renderReady();
      await waitFor(() => expect(result.current.foundryModels.length).toBe(1));

      await act(async () => {
        await result.current.onSelectFoundryModel('m1');
      });

      expect(storeState.status).toBe('completed');
      expect(toast.success).toHaveBeenCalledWith('Loaded model: M1');
    });

    it('reports failures from the outer try/catch', async () => {
      setInvoke({
        ...withFoundryModels({
          id: 'm1',
          name: 'M1',
          foundry_id: 'f1',
          is_downloaded: true,
        }),
        [C.SET_SELECTED_FOUNDRY_MODEL]: undefined,
        [C.LOAD_FOUNDRY_MODEL]: () => Promise.reject(new Error('load boom')),
      });

      const { result } = await renderReady();
      await waitFor(() => expect(result.current.foundryModels.length).toBe(1));

      await act(async () => {
        await result.current.onSelectFoundryModel('m1');
      });

      expect(storeState.status).toBe('error');
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to load model: load boom',
      );
    });
  });

  // ----- misc actions ------------------------------------------------------

  describe('miscellaneous actions', () => {
    it('clears logs', async () => {
      storeState = {
        ...initialModelDownloadState,
        logs: [{ timestamp: 't', level: 'info', message: 'x' }],
      };

      const { result } = await renderReady();

      act(() => {
        result.current.clearLogs();
      });

      expect(storeState.logs).toEqual([]);
    });

    it('resets the download state', async () => {
      const { result } = await renderReady();

      act(() => {
        result.current.resetState();
      });

      expect(storeState).toEqual(initialModelDownloadState);
    });

    it('dismisses the first-launch prompt', async () => {
      const { result } = await renderReady();

      act(() => {
        result.current.dismissFirstLaunchPrompt();
      });

      expect(setDismissed).toHaveBeenCalledWith(true);
    });

    it('detects Tauri offline mode from the global flag', async () => {
      (window as any).__TAURI_OFFLINE_MODE__ = true;

      const utils = await renderReady();

      // Offline mode is detected, yet Local LLM settings remain available.
      expect(utils.result.current.isAvailable).toBe(true);
    });
  });

  // ----- not-in-Tauri early returns ---------------------------------------

  describe('when Tauri is unavailable', () => {
    beforeEach(() => {
      vi.mocked(useTauriModule.useTauri).mockReturnValue({
        isAvailable: false,
        invoke: mockInvoke as never,
        listen: mockListen as never,
      });
    });

    it('does not set up listeners or check status', () => {
      renderHook(() => useModelDownload());
      expect(mockListen).not.toHaveBeenCalled();
    });

    it('early-returns from every backend action', async () => {
      const { result } = renderHook(() => useModelDownload());

      await act(async () => {
        await result.current.checkStatus();
        await result.current.startDownload();
        await result.current.cancelDownload();
        await result.current.installOllama();
        await result.current.stopManager();
        await result.current.installFoundry();
        await result.current.onSelectFoundryModel('whatever');
      });

      // startDownload surfaces a toast; the rest silently no-op.
      expect(toast.error).toHaveBeenCalledWith(
        'Desktop app required for local model download',
      );
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  // ----- hot-reload reset --------------------------------------------------

  describe('hot reload', () => {
    it('re-checks status when foundry state is lost after a remount', async () => {
      setInvoke({
        [C.CHECK_FOUNDRY_STATUS]: () =>
          Promise.reject(new Error('not ready yet')),
      });

      const { rerender } = renderHook(() => useModelDownload());
      await flush();

      // Simulate Fast Refresh handing back a fresh invoke identity while the
      // foundry status never resolved (still null, still "not loaded").
      const freshInvoke = vi.fn(
        mockInvoke.getMockImplementation() as (...a: unknown[]) => unknown,
      );
      vi.mocked(useTauriModule.useTauri).mockReturnValue({
        isAvailable: true,
        invoke: freshInvoke as never,
        listen: mockListen as never,
      });

      await act(async () => {
        rerender();
        await Promise.resolve();
      });
      await flush();

      // The guard reset, so checkStatus ran again against the new invoke.
      expect(freshInvoke).toHaveBeenCalledWith(C.CHECK_FOUNDRY_STATUS);
    });
  });
});
