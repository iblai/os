import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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

// Mock useUsername
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

// Mock extractErrorMessage
vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils',
  () => ({
    extractErrorMessage: vi.fn(
      (error: unknown, defaultMsg: string) =>
        (error as { message?: string })?.message || defaultMsg,
    ),
  }),
);

import useOneDrivePicker from '../use-one-drive-picker';
import { toast } from 'sonner';

describe('useOneDrivePicker', () => {
  let mockOneDriveOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');

    // Mock OneDrive global - set it so SDK appears loaded
    mockOneDriveOpen = vi.fn();
    (
      window as unknown as { OneDrive: { open: typeof mockOneDriveOpen } }
    ).OneDrive = {
      open: mockOneDriveOpen,
    };

    // Default mock implementations
    mockGetCredentials.mockReturnValue({
      unwrap: () => Promise.resolve([{ value: { appId: 'test-app-id' } }]),
    });
    mockAddTrainingDocument.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { OneDrive?: unknown }).OneDrive;
  });

  describe('initialization', () => {
    it('should return pickOneDriveFile function', () => {
      const { result } = renderHook(() => useOneDrivePicker());

      expect(typeof result.current.pickOneDriveFile).toBe('function');
    });

    it('should return isSDKLoaded state', () => {
      const { result } = renderHook(() => useOneDrivePicker());

      expect(typeof result.current.isSDKLoaded).toBe('boolean');
    });

    it('should fetch credentials on mount', async () => {
      renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalledWith({
          org: 'tenant-1',
          name: 'onedrive',
          learner_id: 'testuser',
        });
      });
    });
  });

  describe('credential fetching', () => {
    it('should set onedriveAppId when credentials are fetched', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });
    });

    it('should log error to console when credentials fail to load', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not set onedriveAppId when credentials array is empty', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalled();
      });

      expect(result.current.onedriveAppId).toBeNull();
    });
  });

  describe('pickOneDriveFile', () => {
    it('should call OneDrive.open when SDK is loaded and credentials available', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      expect(mockOneDriveOpen).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should show error toast when appId is not loaded', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'OneDrive credentials are not loaded yet',
      );

      consoleSpy.mockRestore();
    });

    it('should show error toast when SDK is not loaded', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      delete (window as unknown as { OneDrive?: unknown }).OneDrive;

      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      expect(toast.error).toHaveBeenCalledWith('OneDrive SDK not loaded yet');

      consoleSpy.mockRestore();
    });

    it('should pass correct options to OneDrive.open', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      expect(mockOneDriveOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'test-app-id',
          action: 'download',
          multiSelect: true,
          openInNewWindow: true,
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('file selection success', () => {
    it('should add training document on successful file selection', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      // Capture the success callback
      const successCallback = mockOneDriveOpen.mock.calls[0][0].success;

      await act(async () => {
        await successCallback({
          value: [{ '@microsoft.graph.downloadUrl': 'https://download.url' }],
        });
      });

      expect(mockAddTrainingDocument).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should show success toast on successful document add', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const successCallback = mockOneDriveOpen.mock.calls[0][0].success;

      await act(async () => {
        await successCallback({
          value: [{ '@microsoft.graph.downloadUrl': 'https://download.url' }],
        });
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Document has been queued for training',
      );

      consoleSpy.mockRestore();
    });

    it('should show error toast when mentorId is missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockUseParams.mockReturnValue({
        tenantKey: 'tenant-1',
        mentorId: undefined,
      });

      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const successCallback = mockOneDriveOpen.mock.calls[0][0].success;

      await act(async () => {
        await successCallback({
          value: [{ '@microsoft.graph.downloadUrl': 'https://download.url' }],
        });
      });

      expect(toast.error).toHaveBeenCalledWith('Agent not found');

      consoleSpy.mockRestore();
    });
  });

  describe('file selection error', () => {
    it('should show error toast when adding document fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockAddTrainingDocument.mockReturnValue({
        unwrap: () => Promise.reject({ message: 'API Error' }),
      });

      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const successCallback = mockOneDriveOpen.mock.calls[0][0].success;

      await act(async () => {
        await successCallback({
          value: [{ '@microsoft.graph.downloadUrl': 'https://download.url' }],
        });
      });

      expect(toast.error).toHaveBeenCalled();

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('OneDrive picker callbacks', () => {
    it('should handle cancel callback', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const cancelCallback = mockOneDriveOpen.mock.calls[0][0].cancel;

      // Should not throw
      expect(() => cancelCallback()).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle error callback', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const errorCallback = mockOneDriveOpen.mock.calls[0][0].error;

      act(() => {
        errorCallback(new Error('Picker error'));
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Error selecting files from OneDrive',
      );

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  // SDK loading error tests are complex due to DOM manipulation
  // The hook attempts to load an external script which is difficult to test without
  // mocking the DOM appendChild which breaks React rendering

  describe('OneDrive.open error handling', () => {
    it('should show error toast when OneDrive.open throws', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockOneDriveOpen.mockImplementation(() => {
        throw new Error('Open failed');
      });

      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.isSDKLoaded).toBe(true);
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Failed to open OneDrive picker',
      );

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
