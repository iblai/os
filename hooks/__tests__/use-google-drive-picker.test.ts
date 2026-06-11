import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useGoogleDrivePicker from '../use-google-drive-picker';

// Hoisted mocks
const mocked = vi.hoisted(() => ({
  useParams: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  openPicker: vi.fn(),
  // Mutable holder so each test can control the auth response value returned
  // by the GoogleDrivePicker hook before the component renders.
  state: { authRes: null as unknown },
  useLazyGetCredentialsQuery: vi.fn(),
  useAddTrainingDocumentMutation: vi.fn(),
  useUsername: vi.fn(),
  extractErrorMessage: vi.fn(),
}));

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: mocked.useParams,
}));

vi.mock('sonner', () => ({
  toast: mocked.toast,
}));

vi.mock('google-drive-picker', () => ({
  default: () => [mocked.openPicker, mocked.state.authRes],
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetCredentialsQuery: mocked.useLazyGetCredentialsQuery,
  useAddTrainingDocumentMutation: mocked.useAddTrainingDocumentMutation,
}));

vi.mock('../use-user', () => ({
  useUsername: mocked.useUsername,
}));

vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils',
  () => ({
    extractErrorMessage: mocked.extractErrorMessage,
  }),
);

// Grab the picker config passed to the most recent openPicker() call.
const lastPickerConfig = () =>
  mocked.openPicker.mock.calls.at(-1)?.[0] as {
    callbackFunction: (data: {
      action: string;
      docs?: Array<{ url: string; type: string }>;
    }) => Promise<void> | void;
  };

describe('useGoogleDrivePicker', () => {
  let mockGetCredentials: ReturnType<typeof vi.fn>;
  let mockAddTrainingDocument: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  const defaultCredentials = {
    client_id: 'test-client-id',
    developer_key: 'test-developer-key',
    client_secret: 'test-client-secret',
  };

  beforeEach(() => {
    mocked.state.authRes = null;

    // Setup default mocks
    mockGetCredentials = vi.fn().mockReturnValue({
      unwrap: vi.fn().mockResolvedValue([{ value: defaultCredentials }]),
    });

    mockAddTrainingDocument = vi.fn().mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });

    mocked.useLazyGetCredentialsQuery.mockReturnValue([mockGetCredentials]);
    mocked.useAddTrainingDocumentMutation.mockReturnValue([
      mockAddTrainingDocument,
    ]);
    mocked.useUsername.mockReturnValue('test-user');
    mocked.useParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });

    mocked.extractErrorMessage.mockImplementation(
      (error: unknown, defaultMsg: string) =>
        (error as { message?: string })?.message || defaultMsg,
    );

    // window.gapi loads synchronously so isPickerLoaded becomes true on mount.
    global.window.gapi = {
      load: vi.fn((_modules: string, callback: () => void) => {
        callback();
      }),
    } as unknown as typeof window.gapi;

    // Suppress console output in tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Default: no picker modals present.
    global.document.querySelectorAll = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    delete (global.window as { gapi?: unknown }).gapi;
  });

  // Render and resolve once credentials are loaded and the picker is ready.
  const renderLoaded = async () => {
    const view = renderHook(() => useGoogleDrivePicker());
    await waitFor(() => {
      expect(view.result.current.credentials).toEqual(defaultCredentials);
      expect(view.result.current.isPickerLoaded).toBe(true);
    });
    return view;
  };

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      // Keep picker unloaded so we can observe the initial values.
      global.window.gapi = {
        load: vi.fn(),
      } as unknown as typeof window.gapi;

      const { result } = renderHook(() => useGoogleDrivePicker());

      expect(result.current.credentials).toEqual({
        client_id: '',
        developer_key: '',
        client_secret: '',
      });
      expect(result.current.isPickerLoaded).toBe(false);
      expect(result.current.pickerError).toBe(null);
    });

    it('should fetch credentials on mount', async () => {
      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalledWith({
          org: 'test-tenant',
          name: 'drive',
          learner_id: 'test-user',
        });
      });
    });

    it('should set credentials after successful fetch', async () => {
      const { result } = await renderLoaded();

      expect(result.current.credentials).toEqual(defaultCredentials);
    });

    it('should mark the picker as loaded when gapi is available', async () => {
      const { result } = await renderLoaded();

      expect(window.gapi.load).toHaveBeenCalledWith(
        'auth2:picker',
        expect.any(Function),
      );
      expect(result.current.isPickerLoaded).toBe(true);
    });

    it('should handle empty credentials array', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue([]),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(result.current.credentials.client_id).toBe('');
      });
    });

    it('should log error when credentials fetch fails', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    it('should retry loading the api when gapi is not yet available', async () => {
      vi.useFakeTimers();
      delete (global.window as { gapi?: unknown }).gapi;

      renderHook(() => useGoogleDrivePicker());

      // First pass scheduled a retry via setTimeout (gapi missing).
      // Make gapi available and let the retry fire.
      global.window.gapi = {
        load: vi.fn((_modules: string, callback: () => void) => {
          callback();
        }),
      } as unknown as typeof window.gapi;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      expect(window.gapi.load).toHaveBeenCalledWith(
        'auth2:picker',
        expect.any(Function),
      );
    });
  });

  describe('Return values', () => {
    it('should return all expected properties and methods', async () => {
      const { result } = await renderLoaded();

      expect(result.current).toHaveProperty('credentials');
      expect(result.current).toHaveProperty('isPickerLoaded');
      expect(result.current).toHaveProperty('pickerError');
      expect(result.current).toHaveProperty('handlePickerOpen');
      expect(result.current).toHaveProperty('loadGoogleApiScript');
      expect(result.current).toHaveProperty('forceClosePickerModal');
      expect(result.current).toHaveProperty('resetPickerState');

      expect(typeof result.current.handlePickerOpen).toBe('function');
      expect(typeof result.current.loadGoogleApiScript).toBe('function');
      expect(typeof result.current.forceClosePickerModal).toBe('function');
      expect(typeof result.current.resetPickerState).toBe('function');
    });
  });

  describe('handlePickerOpen', () => {
    it('should show an error toast when credentials are not loaded', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue([]),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(result.current.isPickerLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      expect(mocked.toast.error).toHaveBeenCalledWith(
        'Google Drive credentials are not loaded yet',
      );
      expect(mocked.openPicker).not.toHaveBeenCalled();
    });

    it('should show an error toast when the picker is not loaded yet', async () => {
      // gapi never loads -> isPickerLoaded stays false.
      global.window.gapi = {
        load: vi.fn(),
      } as unknown as typeof window.gapi;

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(result.current.credentials).toEqual(defaultCredentials);
      });

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      expect(mocked.toast.error).toHaveBeenCalledWith(
        'Google Picker is not loaded yet. Please try again.',
      );
    });

    it('should open the picker with the expected configuration', async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      expect(mocked.openPicker).toHaveBeenCalledTimes(1);
      const config = lastPickerConfig() as unknown as {
        clientId: string;
        developerKey: string;
        token: null;
        multiselect: boolean;
      };
      expect(config.clientId).toBe('test-client-id');
      expect(config.developerKey).toBe('test-developer-key');
      expect(config.token).toBe(null);
      expect(config.multiselect).toBe(false);
    });

    it('should catch errors thrown while opening the picker', async () => {
      mocked.openPicker.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      expect(mocked.toast.error).toHaveBeenCalledWith(
        'Failed to open Google Drive picker. This might be due to permission issues (403 error).',
      );
      await waitFor(() => {
        expect(result.current.pickerError).toBe(
          'Failed to open Google Drive picker',
        );
      });
    });
  });

  describe('picker callback', () => {
    it('should submit a training document when files are picked', async () => {
      mocked.state.authRes = {
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      await act(async () => {
        await lastPickerConfig().callbackFunction({
          action: 'picked',
          docs: [{ url: 'https://drive/file-1', type: 'document' }],
        });
      });

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalled();
      });

      const payload = mockAddTrainingDocument.mock.calls[0][0];
      expect(payload.org).toBe('test-tenant');
      expect(payload.formData.pathway).toBe('test-mentor');
      expect(payload.formData.url).toBe('https://drive/file-1');
      expect(payload.formData.google_drive_auth_data.auth.token).toBe(
        'token-123',
      );
      expect(mocked.toast.success).toHaveBeenCalledWith(
        'Document has been queued for training',
      );
    });

    it('should show an error toast when training document submission fails', async () => {
      mocked.state.authRes = { access_token: 'token-123' };
      mockAddTrainingDocument.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ message: 'API Error' }),
      });

      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      await act(async () => {
        await lastPickerConfig().callbackFunction({
          action: 'picked',
          docs: [{ url: 'https://drive/file-1', type: 'document' }],
        });
      });

      await waitFor(() => {
        expect(mocked.toast.error).toHaveBeenCalledWith('API Error');
      });
    });

    it('should show an error toast when the agent id is missing', async () => {
      mocked.useParams.mockReturnValue({ tenantKey: 'test-tenant' });
      mocked.state.authRes = { access_token: 'token-123' };

      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      await act(async () => {
        await lastPickerConfig().callbackFunction({
          action: 'picked',
          docs: [{ url: 'https://drive/file-1', type: 'document' }],
        });
      });

      await waitFor(() => {
        expect(mocked.toast.error).toHaveBeenCalledWith('Agent not found');
      });
      expect(mockAddTrainingDocument).not.toHaveBeenCalled();
    });

    it('should reset state when the picker is cancelled', async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      act(() => {
        lastPickerConfig().callbackFunction({ action: 'cancel' });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Google Drive picker was cancelled',
      );
    });

    it('should enable pointer events when the picker reports loaded', async () => {
      const iframeParent = {
        style: { pointerEvents: '' },
      } as unknown as HTMLElement;
      const iframe = { parentElement: iframeParent } as unknown as Element;
      const overlay = { style: { pointerEvents: '' } } as unknown as Element;

      const { result } = await renderLoaded();

      // Only return picker elements once the picker has been opened so the
      // earlier mount effects keep seeing an empty modal list.
      global.document.querySelectorAll = vi.fn((selector: string) => {
        if (selector.includes('iframe')) return [iframe];
        if (selector.includes('dialog')) return [overlay];
        return [];
      }) as unknown as typeof document.querySelectorAll;

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      act(() => {
        lastPickerConfig().callbackFunction({ action: 'loaded' });
      });

      // The 'loaded' branch enables pointer events from inside a setTimeout.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(iframeParent.style.pointerEvents).toBe('auto');
      expect((overlay as unknown as HTMLElement).style.pointerEvents).toBe(
        'auto',
      );
    });

    it('should handle errors thrown inside the picker callback', async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      // docs getter throws when accessed inside the callback.
      const data = { action: 'picked' } as { action: string; docs?: unknown };
      Object.defineProperty(data, 'docs', {
        get() {
          throw new Error('callback boom');
        },
      });

      await act(async () => {
        await lastPickerConfig().callbackFunction(
          data as { action: string; docs?: [] },
        );
      });

      expect(mocked.toast.error).toHaveBeenCalledWith(
        'Error with Google Drive picker. Try refreshing the page if it gets stuck.',
      );
    });
  });

  describe('forceClosePickerModal', () => {
    it('should hide and remove picker iframes and overlays', async () => {
      vi.useFakeTimers();
      const grandParent = { removeChild: vi.fn() };
      const iframeParent = {
        style: { display: '' },
        parentElement: grandParent,
      } as unknown as HTMLElement;
      const iframe = { parentElement: iframeParent } as unknown as Element;
      const overlay = { style: { display: '' } } as unknown as Element;

      global.document.querySelectorAll = vi.fn((selector: string) => {
        if (selector.includes('iframe')) return [iframe];
        if (selector.includes('dialog')) return [overlay];
        return [];
      }) as unknown as typeof document.querySelectorAll;

      const view = renderHook(() => useGoogleDrivePicker());
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      act(() => {
        view.result.current.forceClosePickerModal();
      });

      expect(iframeParent.style.display).toBe('none');
      expect((overlay as unknown as HTMLElement).style.display).toBe('none');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      expect(grandParent.removeChild).toHaveBeenCalledWith(iframeParent);
      expect(mocked.toast.success).toHaveBeenCalledWith(
        'Google Drive picker closed',
      );
    });

    it('should show an error toast when closing the modal fails', async () => {
      const { result } = await renderLoaded();

      global.document.querySelectorAll = vi.fn(() => {
        throw new Error('query boom');
      }) as unknown as typeof document.querySelectorAll;

      act(() => {
        result.current.forceClosePickerModal();
      });

      expect(mocked.toast.error).toHaveBeenCalledWith(
        'Unable to close picker modal. Please refresh the page.',
      );
    });
  });

  describe('resetPickerState', () => {
    it('should remove existing picker iframes and overlays', async () => {
      const iframeGrandParent = { removeChild: vi.fn() };
      const iframeParent = {
        parentElement: iframeGrandParent,
      } as unknown as HTMLElement;
      const iframe = { parentElement: iframeParent } as unknown as Element;
      const overlayParent = { removeChild: vi.fn() };
      const overlay = { parentElement: overlayParent } as unknown as Element;

      const { result } = await renderLoaded();

      global.document.querySelectorAll = vi.fn((selector: string) => {
        if (selector.includes('iframe')) return [iframe];
        if (selector.includes('dialog')) return [overlay];
        return [];
      }) as unknown as typeof document.querySelectorAll;

      act(() => {
        result.current.resetPickerState();
      });

      expect(iframeGrandParent.removeChild).toHaveBeenCalledWith(iframeParent);
      expect(overlayParent.removeChild).toHaveBeenCalledWith(overlay);
      expect(result.current.pickerError).toBe(null);
    });
  });

  describe('loadGoogleApiScript', () => {
    it('should load gapi when called and the picker is not loaded', () => {
      // Mount with a no-op loader so isPickerLoaded stays false.
      const noopLoad = vi.fn();
      global.window.gapi = {
        load: noopLoad,
      } as unknown as typeof window.gapi;

      const { result } = renderHook(() => useGoogleDrivePicker());

      // Now swap in a loader that runs its callback so loadGoogleApiScript
      // executes its setIsPickerLoaded(true) branch.
      const eagerLoad = vi.fn((_modules: string, callback: () => void) => {
        callback();
      });
      (window.gapi as unknown as { load: typeof eagerLoad }).load = eagerLoad;

      act(() => {
        result.current.loadGoogleApiScript();
      });

      expect(eagerLoad).toHaveBeenCalledWith(
        'auth2:picker',
        expect.any(Function),
      );
      expect(result.current.isPickerLoaded).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing credentials developer_key', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue([
          {
            value: {
              client_id: 'test-client-id',
              client_secret: 'test-client-secret',
            },
          },
        ]),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(result.current.credentials.developer_key).toBeUndefined();
      });
    });

    it('should handle null username', () => {
      mocked.useUsername.mockReturnValue(null);

      const { result } = renderHook(() => useGoogleDrivePicker());

      expect(result.current).toBeDefined();
    });

    it('should handle missing tenantKey', () => {
      mocked.useParams.mockReturnValue({
        mentorId: 'test-mentor',
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      expect(result.current).toBeDefined();
    });
  });
});
