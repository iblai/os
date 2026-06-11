import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Hoisted mocks
const mocked = vi.hoisted(() => ({
  openPicker: vi.fn(),
  // Mutable holder so individual tests can control the auth response returned
  // by the GoogleDrivePicker hook before the component renders.
  state: { authRes: null as unknown },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock data-layer
const mockGetCredentials = vi.fn();
const mockAddTrainingDocument = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetCredentialsQuery: () => [mockGetCredentials],
  useAddTrainingDocumentMutation: () => [mockAddTrainingDocument],
}));

// Mock google-drive-picker
vi.mock('google-drive-picker', () => ({
  default: () => [mocked.openPicker, mocked.state.authRes],
}));

// Mock useUsername
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

// Mock extractErrorMessage
import { toast } from 'sonner';
vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils',
  () => ({
    extractErrorMessage: vi.fn(
      (error: unknown, defaultMsg: string) =>
        (error as { message?: string })?.message || defaultMsg,
    ),
  }),
);

import useGoogleDrivePicker from '../use-google-drive-picker-v3';

// Helper: grab the picker config passed to the most recent openPicker() call.
const lastPickerConfig = () =>
  mocked.openPicker.mock.calls.at(-1)?.[0] as {
    callbackFunction: (data: {
      action: string;
      docs?: Array<{ url: string; type: string }>;
    }) => void;
  };

describe('useGoogleDrivePicker v3', () => {
  let mockGapiLoad: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let appendChildSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mocked.state.authRes = null;
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');

    // Mock gapi global
    mockGapiLoad = vi.fn((_type: string, callback: () => void) => {
      callback();
    });
    (window as unknown as { gapi: { load: typeof mockGapiLoad } }).gapi = {
      load: mockGapiLoad,
    };

    // Mock document.body.appendChild
    appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node: Node) => {
        return node as HTMLScriptElement;
      });

    // Default mock implementations
    mockGetCredentials.mockReturnValue({
      unwrap: () =>
        Promise.resolve([
          {
            value: {
              client_id: 'test-client-id',
              developer_key: 'test-dev-key',
              client_secret: 'test-client-secret',
            },
          },
        ]),
    });
    mockAddTrainingDocument.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    appendChildSpy.mockRestore();
    delete (window as unknown as { gapi?: unknown }).gapi;
  });

  // Renders the hook and resolves once credentials have been loaded.
  const renderLoaded = async () => {
    const view = renderHook(() => useGoogleDrivePicker());
    await waitFor(() => {
      expect(view.result.current.credentials.client_id).toBe('test-client-id');
    });
    return view;
  };

  // Fires the appended script's onload handler so the picker reports loaded.
  const triggerScriptOnload = () => {
    const scriptCall = appendChildSpy.mock.calls.find(
      (call: [Node]) =>
        call[0] instanceof HTMLScriptElement &&
        (call[0] as HTMLScriptElement).src ===
          'https://apis.google.com/js/api.js',
    );
    const scriptElement = scriptCall?.[0] as HTMLScriptElement | undefined;
    act(() => {
      scriptElement?.onload?.(new Event('load'));
    });
  };

  describe('initialization', () => {
    it('should return handlePickerOpen function', () => {
      const { result } = renderHook(() => useGoogleDrivePicker());

      expect(typeof result.current.handlePickerOpen).toBe('function');
    });

    it('should return credentials object', () => {
      const { result } = renderHook(() => useGoogleDrivePicker());

      expect(result.current.credentials).toBeDefined();
      expect(result.current.credentials).toHaveProperty('client_id');
      expect(result.current.credentials).toHaveProperty('developer_key');
      expect(result.current.credentials).toHaveProperty('client_secret');
    });

    it('should fetch credentials on mount', async () => {
      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalledWith({
          org: 'tenant-1',
          name: 'drive',
          learner_id: 'testuser',
        });
      });
    });
  });

  describe('credential fetching', () => {
    it('should set credentials when fetched successfully', async () => {
      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(result.current.credentials.client_id).toBe('test-client-id');
        expect(result.current.credentials.developer_key).toBe('test-dev-key');
        expect(result.current.credentials.client_secret).toBe(
          'test-client-secret',
        );
      });
    });

    it('should not set credentials when array is empty', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalled();
      });

      expect(result.current.credentials.client_id).toBe('');
    });

    it('should not set credentials when response is undefined', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.resolve(undefined),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalled();
      });

      expect(result.current.credentials.client_id).toBe('');
    });
  });

  describe('Google API script loading', () => {
    it('should append script to document body', async () => {
      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(appendChildSpy).toHaveBeenCalled();
      });

      const scriptCall = appendChildSpy.mock.calls.find(
        (call: [Node]) =>
          call[0] instanceof HTMLScriptElement &&
          (call[0] as HTMLScriptElement).src ===
            'https://apis.google.com/js/api.js',
      );
      expect(scriptCall).toBeDefined();
    });

    it('should set isPickerLoaded via gapi load when script onload fires', async () => {
      await renderLoaded();

      triggerScriptOnload();

      expect(mockGapiLoad).toHaveBeenCalledWith('auth', expect.any(Function));
    });
  });

  describe('handlePickerOpen', () => {
    it('should log error when credentials not loaded', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Google drive Credentials are not loaded yet',
      );

      consoleSpy.mockRestore();
    });

    it('should load the api script then open the picker when not yet loaded', async () => {
      const { result } = await renderLoaded();

      // Picker not loaded yet (mount script onload never fired).
      await act(async () => {
        await result.current.handlePickerOpen();
      });

      // handlePickerOpen appended its own script; fire its onload to trigger
      // gapi.load -> setIsPickerLoaded(true) -> openPickerInternal().
      const scriptCall = appendChildSpy.mock.calls
        .reverse()
        .find(
          (call: [Node]) =>
            call[0] instanceof HTMLScriptElement &&
            (call[0] as HTMLScriptElement).src ===
              'https://apis.google.com/js/api.js',
        );
      const scriptElement = scriptCall?.[0] as HTMLScriptElement;
      act(() => {
        scriptElement.onload?.(new Event('load'));
      });

      expect(mockOpenPickerCalled()).toBe(true);
    });

    it('should open the picker directly when already loaded', async () => {
      const { result } = await renderLoaded();

      triggerScriptOnload();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      expect(mockOpenPickerCalled()).toBe(true);
    });
  });

  describe('picker callback and file selection', () => {
    it('should submit a training document when files are picked', async () => {
      mocked.state.authRes = {
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      const { result } = await renderLoaded();
      triggerScriptOnload();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      // Invoke the picker callback with a picked document.
      act(() => {
        lastPickerConfig().callbackFunction({
          action: 'picked',
          docs: [{ url: 'https://drive/file-1', type: 'document' }],
        });
      });

      await waitFor(() => {
        expect(mockAddTrainingDocument).toHaveBeenCalled();
      });

      const payload = mockAddTrainingDocument.mock.calls[0][0];
      expect(payload.org).toBe('tenant-1');
      expect(payload.formData.pathway).toBe('mentor-1');
      expect(payload.formData.url).toBe('https://drive/file-1');
      expect(payload.formData.google_drive_auth_data.auth.token).toBe(
        'token-123',
      );
    });

    it('should ignore callback actions that are not picked', async () => {
      mocked.state.authRes = { access_token: 'token-123' };

      const { result } = await renderLoaded();
      triggerScriptOnload();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      act(() => {
        lastPickerConfig().callbackFunction({ action: 'cancel' });
      });

      expect(mockAddTrainingDocument).not.toHaveBeenCalled();
    });

    it('should show an error toast when the training document fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mocked.state.authRes = {
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      mockAddTrainingDocument.mockReturnValue({
        unwrap: () => Promise.reject({ message: 'API Error' }),
      });

      const { result } = await renderLoaded();
      triggerScriptOnload();

      await act(async () => {
        await result.current.handlePickerOpen();
      });

      act(() => {
        lastPickerConfig().callbackFunction({
          action: 'picked',
          docs: [{ url: 'https://drive/file-1', type: 'document' }],
        });
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('API Error');
      });

      consoleSpy.mockRestore();
    });
  });

  describe('file selection handling', () => {
    it('should not submit when no files are selected', async () => {
      await renderLoaded();

      expect(mockAddTrainingDocument).not.toHaveBeenCalled();
    });
  });
});

// Convenience matcher kept outside the suite to read cleanly above.
function mockOpenPickerCalled() {
  return mocked.openPicker.mock.calls.length > 0;
}
