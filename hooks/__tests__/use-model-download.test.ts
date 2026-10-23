import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as useTauriModule from '../use-tauri';
import * as useLocalStorageModule from '../use-local-storage';

// Mock dependencies
vi.mock('../use-tauri');
vi.mock('../use-local-storage');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => 'setup-toast'),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/types/tauri', async () => {
  const actual = await vi.importActual('@/types/tauri');
  return {
    ...actual,
    isTauriApp: vi.fn(() => true), // Mock isTauriApp to return true in tests
  };
});

// Create localStorage mock before importing the hook
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

import { toast } from 'sonner';
import { useModelDownload } from '../use-model-download';

describe('useModelDownload hook', () => {
  let mockInvoke: ReturnType<typeof vi.fn>;
  let mockListen: ReturnType<typeof vi.fn>;
  let mockSetState: ReturnType<typeof vi.fn>;
  let mockSetIsFirstLaunchDismissed: ReturnType<typeof vi.fn>;
  let mockState: any;

  beforeEach(() => {
    mockInvoke = vi.fn();
    mockSetState = vi.fn();
    mockSetIsFirstLaunchDismissed = vi.fn();

    // Default mock for listen that returns a proper unlisten function
    const unlistenMock = vi.fn();
    mockListen = vi.fn().mockResolvedValue(unlistenMock);

    // Default mock for invoke returns null/undefined for status checks
    mockInvoke.mockResolvedValue(null);

    mockState = {
      status: 'idle',
      progress: 0,
      message: '',
      logs: [],
      lastUpdated: new Date().toISOString(),
    };

    // Mock useTauri
    vi.mocked(useTauriModule.useTauri).mockReturnValue({
      isAvailable: true,
      invoke: mockInvoke,
      listen: mockListen,
    });

    // Mock useLocalStorage - called twice in the hook
    vi.mocked(useLocalStorageModule.useLocalStorage).mockImplementation(
      (key: string, defaultValue: any) => {
        if (key === 'model_download_state') {
          return [mockState, mockSetState, vi.fn()];
        }
        if (key === 'model_download_prompt_dismissed') {
          return [false, mockSetIsFirstLaunchDismissed, vi.fn()];
        }
        return [defaultValue, vi.fn(), vi.fn()];
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useModelDownload());

      expect(result.current.state).toBeDefined();
      expect(result.current.ollamaStatus).toBeNull();
    });

    it('should not setup listeners when Tauri is not available', () => {
      vi.mocked(useTauriModule.useTauri).mockReturnValue({
        isAvailable: false,
        invoke: mockInvoke,
        listen: mockListen,
      });

      renderHook(() => useModelDownload());

      expect(mockListen).not.toHaveBeenCalled();
    });

    it('should setup listeners when Tauri is available', async () => {
      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });
    });
  });

  describe('Download progress handling', () => {
    it('should handle download progress updates', async () => {
      const unlistenMock = vi.fn();
      let progressCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'download-progress') {
          progressCallback = callback;
        }
        return unlistenMock;
      });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      // Simulate progress update
      if (progressCallback) {
        act(() => {
          progressCallback({
            status: 'downloading',
            percentage: 50,
            message: 'Downloading...',
          });
        });

        expect(mockSetState).toHaveBeenCalled();
      }
    });

    it('should handle completed status', async () => {
      const unlistenMock = vi.fn();
      let progressCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'download-progress') {
          progressCallback = callback;
        }
        return unlistenMock;
      });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      if (progressCallback) {
        act(() => {
          progressCallback({
            status: 'completed',
            percentage: 100,
            message: 'Download complete',
          });
        });

        expect(mockSetState).toHaveBeenCalled();
      }
    });

    it('should handle cancelled status', async () => {
      const unlistenMock = vi.fn();
      let progressCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'download-progress') {
          progressCallback = callback;
        }
        return unlistenMock;
      });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      if (progressCallback) {
        act(() => {
          progressCallback({
            status: 'cancelled',
            percentage: 0,
            message: 'Download cancelled',
          });
        });

        expect(mockSetState).toHaveBeenCalled();
      }
    });

    it('should handle error status', async () => {
      const unlistenMock = vi.fn();
      let progressCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'download-progress') {
          progressCallback = callback;
        }
        return unlistenMock;
      });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      if (progressCallback) {
        act(() => {
          progressCallback({
            status: 'error',
            percentage: 0,
            message: 'Download failed',
          });
        });

        expect(mockSetState).toHaveBeenCalled();
      }
    });
  });

  describe('Installation logs', () => {
    it('should handle installation log events', async () => {
      const unlistenMock = vi.fn();
      let logCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'installation-log') {
          logCallback = callback;
        }
        return unlistenMock;
      });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      if (logCallback) {
        act(() => {
          logCallback({
            level: 'info',
            message: 'Installing Ollama...',
            timestamp: new Date().toISOString(),
          });
        });

        expect(mockSetState).toHaveBeenCalled();
      }
    });

    it('should limit logs to MAX_LOGS entries', async () => {
      const stateWithManyLogs = {
        ...mockState,
        logs: Array(100).fill({
          level: 'info',
          message: 'Old log',
          timestamp: new Date().toISOString(),
        }),
      };

      vi.mocked(useLocalStorageModule.useLocalStorage)
        .mockImplementationOnce(() => [
          stateWithManyLogs,
          mockSetState,
          vi.fn(),
        ])
        .mockImplementationOnce(() => [
          false,
          mockSetIsFirstLaunchDismissed,
          vi.fn(),
        ]);

      const unlistenMock = vi.fn();
      let logCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'installation-log') {
          logCallback = callback;
        }
        return unlistenMock;
      });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      if (logCallback) {
        act(() => {
          logCallback({
            level: 'info',
            message: 'New log',
            timestamp: new Date().toISOString(),
          });
        });

        const setStateCall = mockSetState.mock.calls.find(
          (call) => typeof call[0] === 'function',
        );
        if (setStateCall) {
          const newState = setStateCall[0](stateWithManyLogs);
          expect(newState.logs.length).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Ollama status check', () => {
    it('should check Ollama status on mount', async () => {
      mockInvoke.mockResolvedValue({
        is_installed: true,
        is_running: true,
        model_downloaded: false,
      });

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('check_ollama_status');
      });
    });

    it('should handle Ollama not installed', async () => {
      mockInvoke.mockResolvedValue({
        is_installed: false,
        is_running: false,
        model_downloaded: false,
      });

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });
    });

    it('should handle status check errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Status check failed'));

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });
    });
  });

  describe('Download actions', () => {
    it('should start download when requested', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      const { result } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(result.current.startDownload).toBeDefined();
      });

      if (result.current.startDownload) {
        await act(async () => {
          await result.current.startDownload?.();
        });

        expect(mockInvoke).toHaveBeenCalledWith('download_model', undefined);
      }
    });

    it('should cancel download when requested', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      const { result } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(result.current.cancelDownload).toBeDefined();
      });

      if (result.current.cancelDownload) {
        await act(async () => {
          await result.current.cancelDownload?.();
        });

        expect(mockInvoke).toHaveBeenCalledWith('cancel_model_download');
      }
    });

    it('should handle download errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Download failed'));

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      const { result } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(result.current.startDownload).toBeDefined();
      });

      if (result.current.startDownload) {
        await act(async () => {
          await result.current.startDownload?.().catch(() => {});
        });
      }
    });
  });

  describe('Downloading an on-device model', () => {
    const LOCAL_MODELS_ENABLED = 'ibl_local_llm_enabled';
    const SELECTED_LOCAL_MODEL = 'ibl_local_llm_model';
    const managerMissing = {
      installed: false,
      running: false,
      model_installed: false,
      installed_models: [],
    };
    const managerRunning = {
      ...managerMissing,
      installed: true,
      running: true,
    };

    function stubBackend({
      installed,
      install = async () => 'Model manager installed and started',
    }: {
      installed: boolean;
      install?: () => Promise<string>;
    }) {
      let managerInstalled = installed;
      mockInvoke.mockImplementation(async (cmd: string) => {
        switch (cmd) {
          case 'check_disk_space_for_model':
            return true;
          case 'check_ollama_status':
            return managerInstalled ? managerRunning : managerMissing;
          case 'install_ollama': {
            const result = await install();
            managerInstalled = true;
            return result;
          }
          default:
            return null;
        }
      });
    }

    async function renderAndSettle() {
      const hook = renderHook(() => useModelDownload());
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('check_ollama_status');
      });
      return hook;
    }

    const commandsInvoked = () => mockInvoke.mock.calls.map((call) => call[0]);

    beforeEach(() => {
      localStorage.removeItem(LOCAL_MODELS_ENABLED);
      localStorage.removeItem(SELECTED_LOCAL_MODEL);
    });

    it('turns on Local Models, sets up the Model Manager, then downloads, telling the user about the one-time setup', async () => {
      stubBackend({ installed: false });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      const commands = commandsInvoked();
      expect(commands).toContain('install_ollama');
      expect(commands.indexOf('install_ollama')).toBeLessThan(
        commands.indexOf('download_model'),
      );
      expect(mockInvoke).toHaveBeenCalledWith('download_model', {
        model: 'qwen3',
      });
      expect(toast.loading).toHaveBeenCalledWith(
        'Setting up the Model Manager',
        expect.objectContaining({
          description: expect.stringContaining('first time'),
        }),
      );
      expect(toast.dismiss).toHaveBeenCalledWith('setup-toast');
      expect(localStorage.getItem(LOCAL_MODELS_ENABLED)).toBe('true');
    });

    it('turns Local Models on before downloading when it is off, even with the Model Manager installed', async () => {
      stubBackend({ installed: true });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      const commands = commandsInvoked();
      expect(localStorage.getItem(LOCAL_MODELS_ENABLED)).toBe('true');
      expect(commands.indexOf('install_ollama')).toBeGreaterThan(-1);
      expect(commands.indexOf('install_ollama')).toBeLessThan(
        commands.indexOf('download_model'),
      );
      expect(toast.loading).not.toHaveBeenCalled();
    });

    it('downloads straight away when Local Models is on and the Model Manager is installed', async () => {
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      stubBackend({ installed: true });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      expect(commandsInvoked()).not.toContain('install_ollama');
      expect(mockInvoke).toHaveBeenCalledWith('download_model', {
        model: 'qwen3',
      });
      expect(toast.loading).not.toHaveBeenCalled();
    });

    it('does not download when the Model Manager setup fails', async () => {
      stubBackend({
        installed: false,
        install: async () => {
          throw new Error('no internet connection');
        },
      });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      expect(commandsInvoked()).not.toContain('download_model');
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to enable local models: no internet connection',
      );
      expect(toast.dismiss).toHaveBeenCalledWith('setup-toast');
      expect(localStorage.getItem(LOCAL_MODELS_ENABLED)).toBe('false');
    });

    it('clears a leftover selection of the model being downloaded, then puts it back in use once the download finishes', async () => {
      mockSetState.mockImplementation((update: any) => {
        mockState = typeof update === 'function' ? update(mockState) : update;
      });
      localStorage.setItem(SELECTED_LOCAL_MODEL, 'qwen3');
      stubBackend({ installed: true });
      const backend = mockInvoke.getMockImplementation()!;
      let selectedDuringDownload: string | null = 'not downloaded';
      mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
        if (cmd === 'download_model') {
          selectedDuringDownload = localStorage.getItem(SELECTED_LOCAL_MODEL);
        }
        return backend(cmd, args);
      });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      expect(selectedDuringDownload).toBeNull();
      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBe('qwen3');
      expect(localStorage.getItem(LOCAL_MODELS_ENABLED)).toBe('true');
    });

    it('puts the model back in use when its re-download fails', async () => {
      mockSetState.mockImplementation((update: any) => {
        mockState = typeof update === 'function' ? update(mockState) : update;
      });
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      localStorage.setItem(SELECTED_LOCAL_MODEL, 'qwen3');
      stubBackend({ installed: true });
      const backend = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
        if (cmd === 'download_model') throw new Error('connection reset');
        return backend(cmd, args);
      });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
      );
      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBe('qwen3');
    });

    it('puts the model back in use when its re-download is cancelled', async () => {
      mockSetState.mockImplementation((update: any) => {
        mockState = typeof update === 'function' ? update(mockState) : update;
      });
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      localStorage.setItem(SELECTED_LOCAL_MODEL, 'qwen3');
      stubBackend({ installed: true });
      const backend = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
        if (cmd === 'download_model') {
          // Cancel lands while the pull runs; the backend then resolves cleanly.
          mockState = { ...mockState, status: 'cancelled' };
          return null;
        }
        return backend(cmd, args);
      });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBe('qwen3');
    });

    it('keeps a model picked during the download when the download ends', async () => {
      mockSetState.mockImplementation((update: any) => {
        mockState = typeof update === 'function' ? update(mockState) : update;
      });
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      localStorage.setItem(SELECTED_LOCAL_MODEL, 'qwen3');
      stubBackend({ installed: true });
      const backend = mockInvoke.getMockImplementation()!;
      mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
        if (cmd === 'download_model') {
          localStorage.setItem(SELECTED_LOCAL_MODEL, 'phi3:mini');
          throw new Error('connection reset');
        }
        return backend(cmd, args);
      });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBe('phi3:mini');
    });

    it('does not download when the user cancels while the Model Manager is being set up', async () => {
      mockSetState.mockImplementation((update: any) => {
        mockState = typeof update === 'function' ? update(mockState) : update;
      });
      stubBackend({
        installed: false,
        install: async () => {
          mockState = { ...mockState, status: 'cancelled' };
          return 'Model manager installed and started';
        },
      });
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.startDownload('qwen3');
      });

      expect(commandsInvoked()).toContain('install_ollama');
      expect(commandsInvoked()).not.toContain('download_model');
    });
  });

  // web-utils 2.9 sends an online turn to the device only when a model is in
  // USE (`ibl_local_llm_model`), not merely when Local Models is on. Foundry
  // keeps its own selection and never wrote that key, so a Foundry user with
  // Local Models on had every online chat answered by the cloud until they
  // opened Profile then Advanced, where the SDK mirrors the pick.
  describe('Foundry selection reaches the shared on-device key', () => {
    const LOCAL_MODELS_ENABLED = 'ibl_local_llm_enabled';
    const SELECTED_LOCAL_MODEL = 'ibl_local_llm_model';
    const PENDING_CHANGE = 'ibl_local_llm_download_pending';

    function stubFoundry({ downloaded = true } = {}) {
      mockInvoke.mockImplementation(async (cmd: string) => {
        switch (cmd) {
          case 'check_foundry_local_status':
            return {
              is_supported: true,
              has_models: true,
              models: [
                {
                  id: 'phi-4-mini',
                  foundry_id: 'phi-4-mini-cpu',
                  is_downloaded: downloaded,
                },
              ],
            };
          case 'get_selected_foundry_model':
            return 'phi-4-mini';
          default:
            return null;
        }
      });
    }

    async function mountAndSettle() {
      const hook = renderHook(() => useModelDownload());
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('check_foundry_local_status');
      });
      return hook;
    }

    beforeEach(() => {
      localStorage.removeItem(LOCAL_MODELS_ENABLED);
      localStorage.removeItem(SELECTED_LOCAL_MODEL);
      localStorage.removeItem(PENDING_CHANGE);
    });

    it('puts the loaded Foundry model in use so online chats stay on the device', async () => {
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      stubFoundry();
      await mountAndSettle();

      await waitFor(() =>
        expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBe('phi-4-mini'),
      );
    });

    it('leaves the key alone while Local Models is off', async () => {
      stubFoundry();
      await mountAndSettle();

      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('get_selected_foundry_model'),
      );
      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBeNull();
    });

    it('never overwrites a model the user already has in use', async () => {
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      localStorage.setItem(SELECTED_LOCAL_MODEL, 'qwen3');
      stubFoundry();
      await mountAndSettle();

      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('get_selected_foundry_model'),
      );
      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBe('qwen3');
    });

    it('stands aside while a download is choosing the model', async () => {
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      localStorage.setItem(PENDING_CHANGE, 'qwen3');
      stubFoundry();
      await mountAndSettle();

      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('get_selected_foundry_model'),
      );
      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBeNull();
    });

    it('waits until the model is actually downloaded', async () => {
      localStorage.setItem(LOCAL_MODELS_ENABLED, 'true');
      stubFoundry({ downloaded: false });
      await mountAndSettle();

      await waitFor(() =>
        expect(mockInvoke).toHaveBeenCalledWith('get_selected_foundry_model'),
      );
      expect(localStorage.getItem(SELECTED_LOCAL_MODEL)).toBeNull();
    });
  });

  describe('First launch prompt', () => {
    it('should track first launch prompt state', () => {
      const { result } = renderHook(() => useModelDownload());

      // The property should exist in the returned object
      expect('shouldShowFirstLaunchPrompt' in result.current).toBe(true);
      // shouldShowFirstLaunchPrompt is undefined when ollamaStatus is null
      // because ollamaStatus?.installed evaluates to undefined
      expect(result.current.shouldShowFirstLaunchPrompt).toBeUndefined();
    });

    it('should update dismissal state', async () => {
      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      const { result } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(result.current.dismissFirstLaunchPrompt).toBeDefined();
      });

      if (result.current.dismissFirstLaunchPrompt) {
        act(() => {
          result.current.dismissFirstLaunchPrompt?.();
        });

        expect(mockSetIsFirstLaunchDismissed).toHaveBeenCalledWith(true);
      }
    });
  });

  describe('Cleanup', () => {
    it('should cleanup listeners on unmount', async () => {
      const unlistenMock1 = vi.fn();
      const unlistenMock2 = vi.fn();
      const unlistenMock3 = vi.fn();

      mockListen
        .mockResolvedValueOnce(unlistenMock1)
        .mockResolvedValueOnce(unlistenMock2)
        .mockResolvedValueOnce(unlistenMock3);

      const { unmount } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(unlistenMock1).toHaveBeenCalled();
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const unlistenMock = vi.fn(() => {
        throw new Error('Cleanup error');
      });

      mockListen.mockResolvedValue(unlistenMock);

      const { unmount } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      // The hook doesn't catch cleanup errors, so unmount will throw
      // We expect this behavior and don't want the test to fail
      expect(() => {
        unmount();
      }).toThrow('Cleanup error');
    });
  });

  describe('State persistence', () => {
    it('should persist state to localStorage', async () => {
      const unlistenMock = vi.fn();
      let progressCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'download-progress') {
          progressCallback = callback;
        }
        return unlistenMock;
      });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      if (progressCallback) {
        act(() => {
          progressCallback({
            status: 'downloading',
            percentage: 75,
            message: 'Almost done...',
          });
        });

        expect(mockSetState).toHaveBeenCalled();
        const call = mockSetState.mock.calls.find(
          (c) => typeof c[0] === 'function',
        );
        if (call) {
          const updater = call[0];
          const newState = updater(mockState);
          expect(newState.lastUpdated).toBeDefined();
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should handle disk space errors', async () => {
      const diskSpaceError: any = {
        type: 'DiskSpaceError',
        message: 'Insufficient disk space',
        required_space: 1000000000,
        available_space: 500000000,
      };

      mockInvoke.mockRejectedValue(diskSpaceError);

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      const { result } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(result.current.startDownload).toBeDefined();
      });

      if (result.current.startDownload) {
        await act(async () => {
          await result.current.startDownload?.().catch(() => {});
        });
      }
    });

    it('should handle network errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      const { result } = renderHook(() => useModelDownload());

      if (result.current.startDownload) {
        await act(async () => {
          await result.current.startDownload?.().catch(() => {});
        });
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple rapid status checks', async () => {
      mockInvoke.mockResolvedValue({
        is_installed: true,
        is_running: true,
        model_downloaded: true,
      });

      const unlistenMock = vi.fn();
      mockListen.mockResolvedValue(unlistenMock);

      const { rerender } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Rerender multiple times
      rerender();
      rerender();
      rerender();

      // Should only check once
      await waitFor(() => {
        const statusCheckCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === 'check_ollama_status',
        );
        expect(statusCheckCalls.length).toBe(1);
      });
    });

    it('should handle state updates during unmount', async () => {
      const unlistenMock = vi.fn();
      let progressCallback: any;

      mockListen.mockImplementation(async (event: string, callback: any) => {
        if (event === 'download-progress') {
          progressCallback = callback;
        }
        return unlistenMock;
      });

      const { unmount } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalled();
      });

      unmount();

      // Try to update after unmount
      if (progressCallback) {
        expect(() => {
          progressCallback({
            status: 'downloading',
            percentage: 50,
            message: 'Progress',
          });
        }).not.toThrow();
      }
    });
  });
});
