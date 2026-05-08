import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useGoogleDrivePicker from '../use-google-drive-picker';

// Hoisted mocks
const mocked = vi.hoisted(() => ({
  useParams: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  GoogleDrivePicker: vi.fn(),
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
  default: mocked.GoogleDrivePicker,
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

describe('useGoogleDrivePicker', () => {
  let mockGetCredentials: ReturnType<typeof vi.fn>;
  let mockAddTrainingDocument: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultCredentials = {
    client_id: 'test-client-id',
    developer_key: 'test-developer-key',
    client_secret: 'test-client-secret',
  };

  beforeEach(() => {
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

    mocked.GoogleDrivePicker.mockReturnValue([vi.fn(), null]);
    mocked.extractErrorMessage.mockReturnValue(
      'Error adding training document',
    );

    // Mock window.gapi to immediately call callback
    global.window.gapi = {
      load: vi.fn((_modules: string, callback: () => void) => {
        // Call callback synchronously to avoid timeout issues
        setTimeout(callback, 0);
      }),
    } as any;

    // Suppress console errors in tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock document.querySelectorAll for picker modal cleanup
    global.document.querySelectorAll = vi.fn().mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
    delete (global.window as any).gapi;
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
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
      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(
        () => {
          expect(result.current.credentials).toEqual(defaultCredentials);
        },
        { timeout: 3000 },
      );
    });

    it('should handle empty credentials array', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue([]),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(
        () => {
          expect(result.current.credentials.client_id).toBe('');
        },
        { timeout: 1000 },
      );
    });

    it('should log error when credentials fetch fails', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      renderHook(() => useGoogleDrivePicker());

      await waitFor(
        () => {
          expect(consoleErrorSpy).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Return values', () => {
    it('should return all expected properties and methods', async () => {
      const { result } = renderHook(() => useGoogleDrivePicker());

      // Wait for hook to initialize
      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalled();
      });

      // Check all return values exist
      expect(result.current).toHaveProperty('credentials');
      expect(result.current).toHaveProperty('isPickerLoaded');
      expect(result.current).toHaveProperty('pickerError');
      expect(result.current).toHaveProperty('handlePickerOpen');
      expect(result.current).toHaveProperty('loadGoogleApiScript');
      expect(result.current).toHaveProperty('forceClosePickerModal');
      expect(result.current).toHaveProperty('resetPickerState');

      // Check types
      expect(typeof result.current.handlePickerOpen).toBe('function');
      expect(typeof result.current.loadGoogleApiScript).toBe('function');
      expect(typeof result.current.forceClosePickerModal).toBe('function');
      expect(typeof result.current.resetPickerState).toBe('function');
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

      await waitFor(
        () => {
          expect(result.current.credentials.developer_key).toBeUndefined();
        },
        { timeout: 1000 },
      );
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
