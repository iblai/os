import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetCredentialsQuery: () => [mockGetCredentials],
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
}));

// Mock useUsername
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

import useGoogleDrivePicker from '../use-google-drive-picker-v2';
import { toast } from 'sonner';

describe('useGoogleDrivePicker v2', () => {
  let mockGapiLoad: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let appendChildSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
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

    // Mock document.body.appendChild - don't auto-trigger onload to avoid race conditions
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
  });

  afterEach(() => {
    vi.clearAllMocks();
    appendChildSpy.mockRestore();
    delete (window as unknown as { gapi?: unknown }).gapi;
  });

  describe('initialization', () => {
    it('should return handlePickerOpen function', () => {
      const { result } = renderHook(() => useGoogleDrivePicker());

      expect(typeof result.current.handlePickerOpen).toBe('function');
    });

    it('should return credentials object', () => {
      const { result } = renderHook(() => useGoogleDrivePicker());

      expect(result.current.credentials).toBeDefined();
      expect(result.current.credentials).toHaveProperty('clientId');
      expect(result.current.credentials).toHaveProperty('developerKey');
      expect(result.current.credentials).toHaveProperty('clientSecret');
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
        expect(result.current.credentials.clientId).toBe('test-client-id');
        expect(result.current.credentials.developerKey).toBe('test-dev-key');
        expect(result.current.credentials.clientSecret).toBe(
          'test-client-secret',
        );
      });
    });

    it('should show error toast when credentials fetch fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API error')),
      });

      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to fetch Google Drive credentials',
        );
      });

      consoleSpy.mockRestore();
    });

    it('should not set credentials when array is empty', async () => {
      mockGetCredentials.mockReturnValue({
        unwrap: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalled();
      });

      expect(result.current.credentials.clientId).toBe('');
    });
  });

  describe('Google API script loading', () => {
    it('should append script to document body', async () => {
      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(appendChildSpy).toHaveBeenCalled();
      });

      const scriptCall = appendChildSpy.mock.calls.find(
        (call) =>
          call[0] instanceof HTMLScriptElement &&
          call[0].src === 'https://apis.google.com/js/api.js',
      );
      expect(scriptCall).toBeDefined();
    });

    it('should set up onload handler that loads gapi auth', async () => {
      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(appendChildSpy).toHaveBeenCalled();
      });

      // Get the script element and verify onload handler exists
      const scriptCall = appendChildSpy.mock.calls.find(
        (call) =>
          call[0] instanceof HTMLScriptElement &&
          call[0].src === 'https://apis.google.com/js/api.js',
      );
      const scriptElement = scriptCall?.[0] as HTMLScriptElement;
      expect(scriptElement.onload).toBeDefined();
    });

    it('should call gapi.load("auth") when script loads', async () => {
      renderHook(() => useGoogleDrivePicker());

      await waitFor(() => {
        expect(appendChildSpy).toHaveBeenCalled();
      });

      // Get the script element
      const scriptCall = appendChildSpy.mock.calls.find(
        (call) =>
          call[0] instanceof HTMLScriptElement &&
          call[0].src === 'https://apis.google.com/js/api.js',
      );
      const scriptElement = scriptCall?.[0] as HTMLScriptElement;

      // Manually trigger the onload callback to cover lines 49-50
      if (scriptElement.onload) {
        // Create a minimal Event object for the onload callback
        const event = new Event('load');
        (scriptElement.onload as (event: Event) => void)(event);
      }

      await waitFor(() => {
        expect(mockGapiLoad).toHaveBeenCalledWith('auth', expect.any(Function));
      });
    });
  });

  describe('handlePickerOpen', () => {
    it('should show not implemented error toast', () => {
      const { result } = renderHook(() => useGoogleDrivePicker());

      result.current.handlePickerOpen();

      expect(toast.error).toHaveBeenCalledWith('Not implemented');
    });
  });
});
