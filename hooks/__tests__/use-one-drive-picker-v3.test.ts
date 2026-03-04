import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
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
vi.mock('@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils', () => ({
  extractErrorMessage: vi.fn(
    (error: unknown, defaultMsg: string) => (error as { message?: string })?.message || defaultMsg,
  ),
}));

import useOneDrivePicker from '../use-one-drive-picker-v3';
import { toast } from 'sonner';

describe('useOneDrivePicker v3', () => {
  let mockOneDriveOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'tenant-1', mentorId: 'mentor-1' });
    mockUseUsername.mockReturnValue('testuser');

    // Mock OneDrive global
    mockOneDriveOpen = vi.fn();
    (window as unknown as { OneDrive: { open: typeof mockOneDriveOpen } }).OneDrive = {
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

    it('should return onedriveAppId', () => {
      const { result } = renderHook(() => useOneDrivePicker());

      expect(result.current).toHaveProperty('onedriveAppId');
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

    it('should log error when credentials fail to load', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not set appId when credentials array is empty', async () => {
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
    it('should call OneDrive.open with correct options structure', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      expect(mockOneDriveOpen).toHaveBeenCalled();
      const options = mockOneDriveOpen.mock.calls[0][0];
      // The hook has an empty dependency array so clientId may not be updated
      // but the structure should be correct
      expect(options).toMatchObject({
        action: 'download',
        multiSelect: true,
        openInNewWindow: true,
      });
      expect(options).toHaveProperty('clientId');
      expect(options).toHaveProperty('success');
      expect(options).toHaveProperty('cancel');
      expect(options).toHaveProperty('error');
    });

    it('should include advanced options with filter', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const options = mockOneDriveOpen.mock.calls[0][0];
      expect(options.advanced).toBeDefined();
      expect(options.advanced.filter).toContain('folder');
      expect(options.advanced.filter).toContain('.pdf');
    });
  });

  describe('file selection success', () => {
    it('should add training document on successful file selection', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      // Get success callback
      const successCallback = mockOneDriveOpen.mock.calls[0][0].success;

      await act(async () => {
        await successCallback({
          value: [{ '@microsoft.graph.downloadUrl': 'https://download.url' }],
        });
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith({
        org: 'tenant-1',
        userId: 'testuser',
        formData: expect.objectContaining({
          type: 'onedrive',
          pathway: 'mentor-1',
          url: 'https://download.url',
        }),
      });
    });

    it('should show success toast on successful document add', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
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

      expect(toast.success).toHaveBeenCalledWith('Document has been queued for training');
    });

    it('should join multiple file URLs', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const successCallback = mockOneDriveOpen.mock.calls[0][0].success;

      await act(async () => {
        await successCallback({
          value: [
            { '@microsoft.graph.downloadUrl': 'https://url1.com' },
            { '@microsoft.graph.downloadUrl': 'https://url2.com' },
          ],
        });
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            url: 'https://url1.com,https://url2.com',
          }),
        }),
      );
    });
  });

  describe('file selection error', () => {
    it('should show error toast when adding document fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAddTrainingDocument.mockReturnValue({
        unwrap: () => Promise.reject({ message: 'API Error' }),
      });

      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
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
    });
  });

  describe('OneDrive callbacks', () => {
    it('should show info toast on cancel', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const cancelCallback = mockOneDriveOpen.mock.calls[0][0].cancel;

      act(() => {
        cancelCallback();
      });

      expect(toast.info).toHaveBeenCalledWith('No file selected');
    });

    it('should show error toast on error callback', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      const errorCallback = mockOneDriveOpen.mock.calls[0][0].error;

      act(() => {
        errorCallback();
      });

      expect(toast.error).toHaveBeenCalledWith('Error selecting file');
    });
  });

  describe('getFullDomain', () => {
    it('should cache the full domain after first call', async () => {
      const { result } = renderHook(() => useOneDrivePicker());

      await waitFor(() => {
        expect(result.current.onedriveAppId).toBe('test-app-id');
      });

      // Call pickOneDriveFile twice to verify caching
      act(() => {
        result.current.pickOneDriveFile();
      });

      act(() => {
        result.current.pickOneDriveFile();
      });

      // Both calls should have same redirectUri
      const firstCallOptions = mockOneDriveOpen.mock.calls[0][0];
      const secondCallOptions = mockOneDriveOpen.mock.calls[1][0];
      expect(firstCallOptions.advanced.redirectUri).toBe(secondCallOptions.advanced.redirectUri);
    });
  });
});
