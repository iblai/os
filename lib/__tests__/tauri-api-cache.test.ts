import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @/types/tauri
const mockIsTauriApp = vi.fn();
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => mockIsTauriApp(),
}));

// Create localStorage mock before importing module
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
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

import {
  isTauriOfflineMode,
  getCachedApiResponse,
  setCachedApiResponse,
  clearApiCache,
  fetchWithCache,
  CacheKeys,
  preCacheMentorData,
} from '../tauri-api-cache';

describe('tauri-api-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock._setStore({});
    mockIsTauriApp.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isTauriOfflineMode', () => {
    it('should return false when not in Tauri', () => {
      mockIsTauriApp.mockReturnValue(false);
      expect(isTauriOfflineMode()).toBe(false);
    });

    it('should return false when offline mode is not set', () => {
      expect(isTauriOfflineMode()).toBe(false);
    });

    it('should return true when offline mode is true', () => {
      localStorageMock._setStore({ tauri_offline_mode: 'true' });
      expect(isTauriOfflineMode()).toBe(true);
    });

    it('should return false when offline mode is false', () => {
      localStorageMock._setStore({ tauri_offline_mode: 'false' });
      expect(isTauriOfflineMode()).toBe(false);
    });
  });

  describe('getCachedApiResponse', () => {
    it('should return null when not in Tauri', () => {
      mockIsTauriApp.mockReturnValue(false);
      const result = getCachedApiResponse('test-endpoint');
      expect(result).toBeNull();
    });

    it('should return null when no cache exists', () => {
      const result = getCachedApiResponse('test-endpoint');
      expect(result).toBeNull();
    });

    it('should return cached data', () => {
      const testData = { foo: 'bar' };
      localStorageMock._setStore({
        'tauri_api_cache_test-endpoint_': JSON.stringify(testData),
      });

      const result = getCachedApiResponse<typeof testData>('test-endpoint');
      expect(result).toEqual(testData);
    });

    it('should return cached data with params', () => {
      const testData = { foo: 'bar' };
      const params = { id: '123' };
      localStorageMock._setStore({
        [`tauri_api_cache_test-endpoint_${JSON.stringify(params)}`]:
          JSON.stringify(testData),
      });

      const result = getCachedApiResponse<typeof testData>(
        'test-endpoint',
        params,
      );
      expect(result).toEqual(testData);
    });

    it('should return null and clear when cache is expired (online)', () => {
      const testData = { foo: 'bar' };
      localStorageMock._setStore({
        'tauri_api_cache_test-endpoint_': JSON.stringify(testData),
        'tauri_api_cache_expiry_test-endpoint_': String(Date.now() - 1000), // Expired
      });

      const result = getCachedApiResponse<typeof testData>('test-endpoint');
      expect(result).toBeNull();
    });

    it('should return cached data even if expired in offline mode', () => {
      const testData = { foo: 'bar' };
      localStorageMock._setStore({
        tauri_offline_mode: 'true',
        'tauri_api_cache_test-endpoint_': JSON.stringify(testData),
        'tauri_api_cache_expiry_test-endpoint_': String(Date.now() - 1000), // Expired
      });

      const result = getCachedApiResponse<typeof testData>('test-endpoint');
      expect(result).toEqual(testData);
    });

    it('should return null on JSON parse error', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      localStorageMock._setStore({
        'tauri_api_cache_test-endpoint_': 'invalid json',
      });

      const result = getCachedApiResponse('test-endpoint');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('setCachedApiResponse', () => {
    it('should not cache when not in Tauri', () => {
      mockIsTauriApp.mockReturnValue(false);
      setCachedApiResponse('test-endpoint', { foo: 'bar' });
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should cache data', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const testData = { foo: 'bar' };
      setCachedApiResponse('test-endpoint', testData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tauri_api_cache_test-endpoint_',
        JSON.stringify(testData),
      );
      consoleSpy.mockRestore();
    });

    it('should cache data with params', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const testData = { foo: 'bar' };
      const params = { id: '123' };
      setCachedApiResponse('test-endpoint', testData, params);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        `tauri_api_cache_test-endpoint_${JSON.stringify(params)}`,
        JSON.stringify(testData),
      );
      consoleSpy.mockRestore();
    });

    it('should set expiry time', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const testData = { foo: 'bar' };
      const ttlMs = 10000;
      const now = Date.now();

      setCachedApiResponse('test-endpoint', testData, undefined, ttlMs);

      // Check that expiry was set
      const setExpiryCall = localStorageMock.setItem.mock.calls.find((call) =>
        call[0].startsWith('tauri_api_cache_expiry_'),
      );
      expect(setExpiryCall).toBeDefined();
      const expiryValue = parseInt(setExpiryCall![1], 10);
      expect(expiryValue).toBeGreaterThanOrEqual(now + ttlMs);
      expect(expiryValue).toBeLessThanOrEqual(now + ttlMs + 100);

      consoleSpy.mockRestore();
    });
  });

  describe('clearApiCache', () => {
    it('should clear all cache entries', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      localStorageMock._setStore({
        tauri_api_cache_endpoint1_: 'data1',
        tauri_api_cache_endpoint2_: 'data2',
        tauri_api_cache_expiry_endpoint1_: '12345',
        other_key: 'other_value',
      });

      clearApiCache();

      // Should have called removeItem for cache keys
      expect(localStorageMock.removeItem).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('fetchWithCache', () => {
    it('should return cached data in offline mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const testData = { foo: 'bar' };
      localStorageMock._setStore({
        tauri_offline_mode: 'true',
        'tauri_api_cache_test-endpoint_': JSON.stringify(testData),
      });

      const fetchFn = vi.fn();
      const result = await fetchWithCache('test-endpoint', fetchFn);

      expect(result).toEqual(testData);
      expect(fetchFn).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw error when offline with no cache', async () => {
      localStorageMock._setStore({ tauri_offline_mode: 'true' });

      const fetchFn = vi.fn();
      await expect(fetchWithCache('test-endpoint', fetchFn)).rejects.toThrow(
        'No cached data available for test-endpoint in offline mode',
      );
    });

    it('should fetch and cache when online', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const testData = { foo: 'bar' };
      const fetchFn = vi.fn().mockResolvedValue(testData);

      const result = await fetchWithCache('test-endpoint', fetchFn);

      expect(result).toEqual(testData);
      expect(fetchFn).toHaveBeenCalled();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return cached data when fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const testData = { foo: 'bar' };
      localStorageMock._setStore({
        'tauri_api_cache_test-endpoint_': JSON.stringify(testData),
      });

      const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await fetchWithCache('test-endpoint', fetchFn);

      expect(result).toEqual(testData);
      consoleSpy.mockRestore();
    });

    it('should throw when fetch fails and no cache', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchWithCache('test-endpoint', fetchFn)).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('CacheKeys', () => {
    it('should generate mentor settings key', () => {
      const key = CacheKeys.mentorSettings('org1', 'mentor1', 'user1');
      expect(key).toBe('mentor_settings_org1_mentor1_user1');
    });

    it('should generate mentor public settings key', () => {
      const key = CacheKeys.mentorPublicSettings('org1', 'mentor1');
      expect(key).toBe('mentor_public_settings_org1_mentor1');
    });

    it('should generate tenant metadata key', () => {
      const key = CacheKeys.tenantMetadata('org1');
      expect(key).toBe('tenant_metadata_org1');
    });

    it('should generate user tenants key', () => {
      const key = CacheKeys.userTenants('user1');
      expect(key).toBe('user_tenants_user1');
    });

    it('should generate session chats key', () => {
      const key = CacheKeys.sessionChats('session1');
      expect(key).toBe('session_chats_session1');
    });
  });

  describe('preCacheMentorData', () => {
    it('should not cache when not in Tauri', async () => {
      mockIsTauriApp.mockReturnValue(false);
      const fetchMentorSettings = vi.fn();
      const fetchTenantMetadata = vi.fn();

      await preCacheMentorData(
        'org1',
        'mentor1',
        'user1',
        fetchMentorSettings,
        fetchTenantMetadata,
      );

      expect(fetchMentorSettings).not.toHaveBeenCalled();
      expect(fetchTenantMetadata).not.toHaveBeenCalled();
    });

    it('should call fetch functions when in Tauri', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const fetchMentorSettings = vi.fn().mockResolvedValue({ settings: true });
      const fetchTenantMetadata = vi.fn().mockResolvedValue({ metadata: true });

      await preCacheMentorData(
        'org1',
        'mentor1',
        'user1',
        fetchMentorSettings,
        fetchTenantMetadata,
      );

      expect(fetchMentorSettings).toHaveBeenCalled();
      expect(fetchTenantMetadata).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle fetch failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchMentorSettings = vi
        .fn()
        .mockRejectedValue(new Error('Failed'));
      const fetchTenantMetadata = vi
        .fn()
        .mockRejectedValue(new Error('Failed'));

      // Should not throw
      await preCacheMentorData(
        'org1',
        'mentor1',
        'user1',
        fetchMentorSettings,
        fetchTenantMetadata,
      );

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });
});
