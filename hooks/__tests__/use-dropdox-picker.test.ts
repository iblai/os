import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock load-script - inline factory
vi.mock('load-script', () => ({
  default: vi.fn((_url: string, _options: unknown, callback: () => void) => {
    callback?.();
  }),
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

import useDropboxPicker from '../use-dropdox-picker';
import { toast } from 'sonner';

describe('useDropboxPicker', () => {
  let mockDropboxChoose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');

    // Mock Dropbox global
    mockDropboxChoose = vi.fn();
    (
      window as unknown as { Dropbox: { choose: typeof mockDropboxChoose } }
    ).Dropbox = {
      choose: mockDropboxChoose,
    };

    // Default mock implementations
    mockGetCredentials.mockReturnValue({
      unwrap: () => Promise.resolve([{ value: { appKey: 'test-app-key' } }]),
    });
    mockAddTrainingDocument.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { Dropbox?: unknown }).Dropbox;
    // Reset module-level state
  });

  describe('initialization', () => {
    it('should return openChooser function', () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      expect(typeof result.current.openChooser).toBe('function');
    });

    it('should return dropboxReady state', () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      expect(typeof result.current.dropboxReady).toBe('boolean');
    });

    it('should return appKey state', () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      expect(result.current.appKey).toBeDefined();
    });

    it('should fetch credentials on mount', async () => {
      renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalledWith({
          org: 'tenant-1',
          name: 'dropbox',
          learner_id: 'testuser',
        });
      });
    });
  });

  describe('credential fetching', () => {
    it('should set appKey when credentials are fetched', async () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.appKey).toBe('test-app-key');
      });
    });

    it('should log error to console when credentials fail to load', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should not set appKey when credentials array is empty', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalled();
      });

      expect(result.current.appKey).toBeNull();
    });
  });

  describe('openChooser', () => {
    it('should call Dropbox.choose when dropbox is ready', async () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      expect(mockDropboxChoose).toHaveBeenCalled();
    });

    it('should pass correct options to Dropbox.choose', async () => {
      const { result } = renderHook(() =>
        useDropboxPicker({
          linkType: 'direct',
          multiselect: false,
          folderselect: false,
        }),
      );

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      expect(mockDropboxChoose).toHaveBeenCalledWith(
        expect.objectContaining({
          linkType: 'direct',
          multiselect: false,
          folderselect: false,
        }),
      );
    });

    it('should return null when disabled', async () => {
      const { result } = renderHook(() => useDropboxPicker({ disabled: true }));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      expect(mockDropboxChoose).not.toHaveBeenCalled();
    });

    it('should return null when dropbox is not ready', () => {
      delete (window as unknown as { Dropbox?: unknown }).Dropbox;

      const { result } = renderHook(() => useDropboxPicker({}));

      act(() => {
        result.current.openChooser();
      });

      expect(mockDropboxChoose).not.toHaveBeenCalled();
    });
  });

  describe('file selection success', () => {
    it('should add training document on successful file selection', async () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      // Capture the success callback
      const successCallback = mockDropboxChoose.mock.calls[0][0].success;

      await act(async () => {
        await successCallback([{ link: 'https://dropbox.com/file1' }]);
      });

      expect(mockAddTrainingDocument).toHaveBeenCalled();
    });

    it('should show success toast on successful document add', async () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      const successCallback = mockDropboxChoose.mock.calls[0][0].success;

      await act(async () => {
        await successCallback([{ link: 'https://dropbox.com/file1' }]);
      });

      expect(toast.success).toHaveBeenCalledWith(
        'Document has been queued for training',
      );
    });

    it('should join multiple file links', async () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      const successCallback = mockDropboxChoose.mock.calls[0][0].success;

      await act(async () => {
        await successCallback([
          { link: 'https://dropbox.com/file1' },
          { link: 'https://dropbox.com/file2' },
        ]);
      });

      expect(mockAddTrainingDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            url: 'https://dropbox.com/file1,https://dropbox.com/file2',
          }),
        }),
      );
    });

    it('should handle non-array file input', async () => {
      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      const successCallback = mockDropboxChoose.mock.calls[0][0].success;

      await act(async () => {
        await successCallback({ link: 'https://dropbox.com/file1' });
      });

      expect(mockAddTrainingDocument).toHaveBeenCalled();
    });
  });

  describe('file selection error', () => {
    it('should show error toast when adding document fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockAddTrainingDocument.mockReturnValue({
        unwrap: () => Promise.reject({ message: 'API Error' }),
      });

      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      const successCallback = mockDropboxChoose.mock.calls[0][0].success;

      await act(async () => {
        await successCallback([{ link: 'https://dropbox.com/file1' }]);
      });

      expect(toast.error).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should show error toast when mentorId is missing', async () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'tenant-1',
        mentorId: undefined,
      });

      const { result } = renderHook(() => useDropboxPicker({}));

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      const successCallback = mockDropboxChoose.mock.calls[0][0].success;

      await act(async () => {
        await successCallback([{ link: 'https://dropbox.com/file1' }]);
      });

      expect(toast.error).toHaveBeenCalledWith('Mentor not found');
    });
  });

  describe('cancel callback', () => {
    it('should call cancel callback when user cancels', async () => {
      const cancelMock = vi.fn();
      const { result } = renderHook(() =>
        useDropboxPicker({ cancel: cancelMock }),
      );

      await waitFor(() => {
        expect(result.current.dropboxReady).toBe(true);
      });

      act(() => {
        result.current.openChooser();
      });

      const cancelCallback = mockDropboxChoose.mock.calls[0][0].cancel;

      act(() => {
        cancelCallback();
      });

      expect(cancelMock).toHaveBeenCalled();
    });
  });

  describe('autoShow', () => {
    it('should auto open chooser when autoShow is true and dropbox is ready', async () => {
      renderHook(() => useDropboxPicker({ autoShow: true }));

      await waitFor(() => {
        expect(mockDropboxChoose).toHaveBeenCalled();
      });
    });

    it('should not auto open when disabled', async () => {
      renderHook(() => useDropboxPicker({ autoShow: true, disabled: true }));

      // Give time for effects to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockDropboxChoose).not.toHaveBeenCalled();
    });
  });
});
