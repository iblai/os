import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock next/navigation
const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock isTauriApp
const mockIsTauriApp = vi.fn();
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => mockIsTauriApp(),
}));

// Mock @tauri-apps/api/core
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Create localStorage mock
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

import {
  useTauriOffline,
  isOfflineServerOrigin,
  isTauriOfflineMode,
  getLastMentorRoute,
} from '../use-tauri-offline';

// Helper to clear localStorage
const clearLocalStorage = () => {
  localStorageMock.clear();
};

describe('useTauriOffline', () => {
  const LAST_MENTOR_ROUTE_KEY = 'tauri_last_mentor_route';
  const OFFLINE_MODE_KEY = 'tauri_offline_mode';
  const CACHED_API_RESPONSES_KEY = 'tauri_cached_api_responses';

  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalStorage();
    mockPathname.mockReturnValue(null);
    mockIsTauriApp.mockReturnValue(false);
    mockInvoke.mockResolvedValue({ cached_count: 0, failed_count: 0, cached_urls: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearLocalStorage();
  });

  describe('initial state', () => {
    it('should return isOffline as false when not in Tauri', () => {
      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.isOffline).toBe(false);
    });

    it('should return null for lastMentorRoute when nothing saved', () => {
      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.lastMentorRoute).toBeNull();
    });

    it('should return isOnMentorRoute as false when not on mentor route', () => {
      mockPathname.mockReturnValue('/some-other-route');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.isOnMentorRoute).toBe(false);
    });
  });

  describe('mentor route detection', () => {
    it('should detect mentor route and extract tenant and mentor id', () => {
      mockPathname.mockReturnValue('/platform/tenant-1/mentor-123');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.isOnMentorRoute).toBe(true);
      expect(result.current.currentTenantKey).toBe('tenant-1');
      expect(result.current.currentMentorId).toBe('mentor-123');
    });

    it('should handle tenant with underscores', () => {
      mockPathname.mockReturnValue('/platform/my_tenant_key/mentor_id');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.currentTenantKey).toBe('my_tenant_key');
      expect(result.current.currentMentorId).toBe('mentor_id');
    });

    it('should handle tenant with hyphens', () => {
      mockPathname.mockReturnValue('/platform/my-tenant-key/mentor-id');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.currentTenantKey).toBe('my-tenant-key');
      expect(result.current.currentMentorId).toBe('mentor-id');
    });

    it('should return null values when not on mentor route', () => {
      mockPathname.mockReturnValue('/other-page');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.isOnMentorRoute).toBe(false);
      expect(result.current.currentTenantKey).toBeNull();
      expect(result.current.currentMentorId).toBeNull();
    });
  });

  describe('offline mode detection', () => {
    it('should detect offline mode when flag is set in localStorage', () => {
      mockIsTauriApp.mockReturnValue(true);
      localStorage.setItem(OFFLINE_MODE_KEY, 'true');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.isOffline).toBe(true);
    });

    it('should not be offline when flag is not set', () => {
      mockIsTauriApp.mockReturnValue(true);

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.isOffline).toBe(false);
    });

    it('should not be offline when not in Tauri even if flag is set', () => {
      mockIsTauriApp.mockReturnValue(false);
      localStorage.setItem(OFFLINE_MODE_KEY, 'true');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.isOffline).toBe(false);
    });
  });

  describe('saveCurrentRoute', () => {
    it('should save route to localStorage when on mentor route in Tauri', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockIsTauriApp.mockReturnValue(true);
      mockPathname.mockReturnValue('/platform/tenant-1/mentor-123');

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.saveCurrentRoute();
      });

      expect(localStorage.getItem(LAST_MENTOR_ROUTE_KEY)).toBe('/platform/tenant-1/mentor-123');

      consoleSpy.mockRestore();
    });

    it('should not save when not in Tauri', () => {
      mockIsTauriApp.mockReturnValue(false);
      mockPathname.mockReturnValue('/platform/tenant-1/mentor-123');

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.saveCurrentRoute();
      });

      expect(localStorage.getItem(LAST_MENTOR_ROUTE_KEY)).toBeNull();
    });

    it('should not save when not on mentor route', () => {
      mockIsTauriApp.mockReturnValue(true);
      mockPathname.mockReturnValue('/other-route');

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.saveCurrentRoute();
      });

      expect(localStorage.getItem(LAST_MENTOR_ROUTE_KEY)).toBeNull();
    });

    it('should not save duplicate routes', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockIsTauriApp.mockReturnValue(true);
      mockPathname.mockReturnValue('/platform/tenant-1/mentor-123');

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.saveCurrentRoute();
      });
      act(() => {
        result.current.saveCurrentRoute();
      });

      // Should only log once
      const saveCalls = consoleSpy.mock.calls.filter(
        (call) => call[0] === '[TauriOffline] Saving mentor route:',
      );
      expect(saveCalls.length).toBe(1);

      consoleSpy.mockRestore();
    });
  });

  describe('getCachedApiResponse', () => {
    it('should return cached response when available', () => {
      mockIsTauriApp.mockReturnValue(true);
      const cachedData = { key1: { data: 'value1' } };
      localStorage.setItem(CACHED_API_RESPONSES_KEY, JSON.stringify(cachedData));

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.getCachedApiResponse('key1')).toEqual({ data: 'value1' });
    });

    it('should return null when key not found', () => {
      mockIsTauriApp.mockReturnValue(true);
      const cachedData = { key1: { data: 'value1' } };
      localStorage.setItem(CACHED_API_RESPONSES_KEY, JSON.stringify(cachedData));

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.getCachedApiResponse('nonexistent')).toBeNull();
    });

    it('should return null when no cache exists', () => {
      mockIsTauriApp.mockReturnValue(true);

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.getCachedApiResponse('key1')).toBeNull();
    });

    it('should return null when not in Tauri', () => {
      mockIsTauriApp.mockReturnValue(false);
      const cachedData = { key1: { data: 'value1' } };
      localStorage.setItem(CACHED_API_RESPONSES_KEY, JSON.stringify(cachedData));

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.getCachedApiResponse('key1')).toBeNull();
    });

    it('should handle JSON parse errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockIsTauriApp.mockReturnValue(true);
      localStorage.setItem(CACHED_API_RESPONSES_KEY, 'invalid-json');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.getCachedApiResponse('key1')).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('setCachedApiResponse', () => {
    it('should cache API response', () => {
      mockIsTauriApp.mockReturnValue(true);

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.setCachedApiResponse('key1', { data: 'value1' });
      });

      const cached = JSON.parse(localStorage.getItem(CACHED_API_RESPONSES_KEY) || '{}');
      expect(cached.key1).toEqual({ data: 'value1' });
    });

    it('should preserve existing cached responses', () => {
      mockIsTauriApp.mockReturnValue(true);
      localStorage.setItem(CACHED_API_RESPONSES_KEY, JSON.stringify({ existing: 'data' }));

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.setCachedApiResponse('key1', { data: 'value1' });
      });

      const cached = JSON.parse(localStorage.getItem(CACHED_API_RESPONSES_KEY) || '{}');
      expect(cached.existing).toBe('data');
      expect(cached.key1).toEqual({ data: 'value1' });
    });

    it('should not cache when not in Tauri', () => {
      mockIsTauriApp.mockReturnValue(false);

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.setCachedApiResponse('key1', { data: 'value1' });
      });

      expect(localStorage.getItem(CACHED_API_RESPONSES_KEY)).toBeNull();
    });

    it('should limit cache to 100 entries', () => {
      mockIsTauriApp.mockReturnValue(true);

      // Pre-populate with 100 entries
      const existingData: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        existingData[`key${i}`] = { data: i };
      }
      localStorage.setItem(CACHED_API_RESPONSES_KEY, JSON.stringify(existingData));

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.setCachedApiResponse('newKey', { data: 'new' });
      });

      const cached = JSON.parse(localStorage.getItem(CACHED_API_RESPONSES_KEY) || '{}');
      const keys = Object.keys(cached);
      expect(keys.length).toBeLessThanOrEqual(100);
      expect(cached.newKey).toEqual({ data: 'new' });
    });

    it('should handle JSON parse errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockIsTauriApp.mockReturnValue(true);
      localStorage.setItem(CACHED_API_RESPONSES_KEY, 'invalid-json');

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.setCachedApiResponse('key1', { data: 'value1' });
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('clearCachedApiResponses', () => {
    it('should clear all cached API responses', () => {
      mockIsTauriApp.mockReturnValue(true);
      localStorage.setItem(CACHED_API_RESPONSES_KEY, JSON.stringify({ key: 'value' }));

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.clearCachedApiResponses();
      });

      expect(localStorage.getItem(CACHED_API_RESPONSES_KEY)).toBeNull();
    });

    it('should do nothing when not in Tauri', () => {
      mockIsTauriApp.mockReturnValue(false);
      localStorage.setItem(CACHED_API_RESPONSES_KEY, JSON.stringify({ key: 'value' }));

      const { result } = renderHook(() => useTauriOffline());

      act(() => {
        result.current.clearCachedApiResponses();
      });

      expect(localStorage.getItem(CACHED_API_RESPONSES_KEY)).not.toBeNull();
    });
  });

  describe('lastMentorRoute', () => {
    it('should return saved mentor route from localStorage', () => {
      localStorage.setItem(LAST_MENTOR_ROUTE_KEY, '/platform/tenant/mentor');

      const { result } = renderHook(() => useTauriOffline());

      expect(result.current.lastMentorRoute).toBe('/platform/tenant/mentor');
    });
  });
});

describe('isOfflineServerOrigin', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('should return true for localhost:3456', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3456' },
      writable: true,
    });

    expect(isOfflineServerOrigin()).toBe(true);
  });

  it('should return true for 127.0.0.1:3456', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://127.0.0.1:3456' },
      writable: true,
    });

    expect(isOfflineServerOrigin()).toBe(true);
  });

  it('should return false for other origins', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true,
    });

    expect(isOfflineServerOrigin()).toBe(false);
  });
});

describe('isTauriOfflineMode', () => {
  const originalLocation = window.location;
  const OFFLINE_MODE_KEY = 'tauri_offline_mode';

  beforeEach(() => {
    clearLocalStorage();
    mockIsTauriApp.mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    clearLocalStorage();
  });

  it('should return true when on offline server origin', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3456' },
      writable: true,
    });

    expect(isTauriOfflineMode()).toBe(true);
  });

  it('should return true when __TAURI_OFFLINE_MODE__ is true', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true,
    });
    mockIsTauriApp.mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_OFFLINE_MODE__ = true;

    expect(isTauriOfflineMode()).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__TAURI_OFFLINE_MODE__;
  });

  it('should return true when localStorage flag is set', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true,
    });
    mockIsTauriApp.mockReturnValue(true);
    localStorage.setItem(OFFLINE_MODE_KEY, 'true');

    expect(isTauriOfflineMode()).toBe(true);
  });

  it('should return false when not in Tauri and not on offline server', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com' },
      writable: true,
    });
    mockIsTauriApp.mockReturnValue(false);

    expect(isTauriOfflineMode()).toBe(false);
  });
});

describe('getLastMentorRoute', () => {
  const LAST_MENTOR_ROUTE_KEY = 'tauri_last_mentor_route';

  beforeEach(() => {
    clearLocalStorage();
  });

  afterEach(() => {
    clearLocalStorage();
  });

  it('should return saved mentor route', () => {
    localStorage.setItem(LAST_MENTOR_ROUTE_KEY, '/platform/tenant/mentor');

    expect(getLastMentorRoute()).toBe('/platform/tenant/mentor');
  });

  it('should return null when no route saved', () => {
    expect(getLastMentorRoute()).toBeNull();
  });
});

describe('triggerPrecache error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalStorage();
    mockPathname.mockReturnValue('/platform/tenant-1/mentor-123');
    mockIsTauriApp.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearLocalStorage();
  });

  it('should log error when saveMentorRouteToTauri fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Make invoke reject for save_last_mentor_route command
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'save_last_mentor_route') {
        return Promise.reject(new Error('Save route failed'));
      }
      return Promise.resolve({ cached_count: 0, failed_count: 0, cached_urls: [] });
    });

    const { result } = renderHook(() => useTauriOffline());

    await act(async () => {
      result.current.saveCurrentRoute();
      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Should have logged the error
    expect(consoleSpy).toHaveBeenCalledWith(
      '[TauriOffline] Failed to save route to Tauri:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should log error when precache_app fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Make invoke succeed for save_last_mentor_route but fail for precache_app
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'save_last_mentor_route') {
        return Promise.resolve();
      }
      if (cmd === 'precache_app') {
        return Promise.reject(new Error('Precache failed'));
      }
      return Promise.resolve({ cached_count: 0, failed_count: 0, cached_urls: [] });
    });

    const { result } = renderHook(() => useTauriOffline());

    await act(async () => {
      result.current.saveCurrentRoute();
      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Should have logged the precache error
    expect(consoleSpy).toHaveBeenCalledWith('[TauriOffline] Pre-cache failed:', expect.any(Error));

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
});
