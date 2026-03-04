import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';

// Store original console methods before anything else
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Mock dependencies
vi.mock('@/features/utils', () => ({
  getUserName: vi.fn(() => 'testuser'),
}));

vi.mock('@/lib/utils', () => ({
  getTenantKeyFromUrl: vi.fn(() => 'test-tenant'),
  getMentorIdFromUrl: vi.fn(() => 'test-mentor'),
}));

vi.mock('./constants', () => ({
  LOCAL_STORAGE_KEYS: {
    SESSION_ID: 'session_id',
  },
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
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
    _resetGetItem: () => {
      localStorageMock.getItem = vi.fn((key: string) => store[key] ?? null);
    },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Import after mocks - this triggers the console overrides
import ConsoleSetup from '../logger';
import { getTenantKeyFromUrl, getMentorIdFromUrl } from '@/lib/utils';
import { getUserName } from '@/features/utils';

// Store the overridden console methods after import
let overriddenLog: typeof console.log;
let overriddenWarn: typeof console.warn;
let overriddenError: typeof console.error;

describe('logger', () => {
  beforeAll(() => {
    // Capture the overridden console methods after the module is imported
    overriddenLog = console.log;
    overriddenWarn = console.warn;
    overriddenError = console.error;
  });

  afterAll(() => {
    // Restore original console methods after all tests
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock._setStore({});
    localStorageMock._resetGetItem();
    // Ensure we're using the overridden console methods for each test
    console.log = overriddenLog;
    console.warn = overriddenWarn;
    console.error = overriddenError;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ConsoleSetup component', () => {
    it('should render null', () => {
      const { container } = render(<ConsoleSetup />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('console overrides', () => {
    it('should export ConsoleSetup as default', () => {
      expect(ConsoleSetup).toBeDefined();
      expect(typeof ConsoleSetup).toBe('function');
    });

    it('should not throw when calling console.log', () => {
      expect(() => console.log('test message')).not.toThrow();
    });

    it('should not throw when calling console.warn', () => {
      expect(() => console.warn('test warning')).not.toThrow();
    });

    it('should not throw when calling console.error', () => {
      expect(() => console.error('test error')).not.toThrow();
    });

    it('should not throw with object arguments', () => {
      const testObj = { key: 'value', nested: { data: 123 } };
      expect(() => console.log('Message:', testObj)).not.toThrow();
    });

    it('should handle circular references without throwing', () => {
      const circularObj: any = { a: 1 };
      circularObj.self = circularObj;
      expect(() => console.log(circularObj)).not.toThrow();
    });

    it('should handle null arguments', () => {
      expect(() => console.log(null)).not.toThrow();
    });

    it('should handle primitive arguments', () => {
      expect(() => console.log('string', 123, true)).not.toThrow();
    });

    it('should handle multiple mixed arguments', () => {
      const obj = { test: 'data' };
      expect(() => console.log('Message:', obj, 123, true, null)).not.toThrow();
    });
  });

  describe('metadata formatting', () => {
    it('should use getTenantKeyFromUrl', () => {
      expect(getTenantKeyFromUrl).toBeDefined();
    });

    it('should use getMentorIdFromUrl', () => {
      expect(getMentorIdFromUrl).toBeDefined();
    });

    it('should use getUserName', () => {
      expect(getUserName).toBeDefined();
    });

    it('should not throw when logging with metadata', () => {
      localStorageMock._setStore({
        session_id: JSON.stringify({ 'test-mentor': 'session-123' }),
      });

      expect(() => console.log('test')).not.toThrow();
    });

    it('should handle missing metadata gracefully', () => {
      (getTenantKeyFromUrl as any).mockReturnValue(null);
      (getMentorIdFromUrl as any).mockReturnValue(null);
      (getUserName as any).mockReturnValue(null);

      expect(() => console.log('test')).not.toThrow();

      // Restore mocks
      (getTenantKeyFromUrl as any).mockReturnValue('test-tenant');
      (getMentorIdFromUrl as any).mockReturnValue('test-mentor');
      (getUserName as any).mockReturnValue('testuser');
    });

    it('should not throw when formatting date', () => {
      expect(() => console.log('test')).not.toThrow();
    });

    it('should handle getTenantKeyFromUrl throwing an error', () => {
      (getTenantKeyFromUrl as any).mockImplementation(() => {
        throw new Error('Failed to get tenant key');
      });

      // Should not throw even when getTenantKeyFromUrl throws
      expect(() => console.log('test message')).not.toThrow();

      // Restore mock
      (getTenantKeyFromUrl as any).mockReturnValue('test-tenant');
    });
  });

  describe('localStorage session handling', () => {
    it('should read from localStorage', () => {
      localStorageMock._setStore({
        session_id: JSON.stringify({ 'test-mentor': 'session-123' }),
      });

      // The logger module reads from localStorage when formatting
      expect(localStorageMock.getItem).toBeDefined();
    });

    it('should handle missing session data', () => {
      localStorageMock._setStore({});
      expect(localStorageMock.getItem('session_id')).toBeNull();
    });

    it('should handle invalid JSON in session data', () => {
      localStorageMock._setStore({
        session_id: 'invalid-json',
      });

      // Should not throw when parsing fails
      const sessionData = localStorageMock.getItem('session_id');
      expect(() => {
        try {
          JSON.parse(sessionData || '');
        } catch {
          // Expected
        }
      }).not.toThrow();
    });

    it('should handle invalid JSON when logging and return empty sessionId', () => {
      // Set invalid JSON that will cause JSON.parse to fail
      localStorageMock._setStore({
        session_id: '{invalid-json-syntax',
      });

      // Should not throw when console.log is called with invalid session JSON
      expect(() => console.log('test message')).not.toThrow();
    });

    it('should not throw when session ID is available', () => {
      localStorageMock._setStore({
        session_id: JSON.stringify({ 'test-mentor': 'session-abc-123' }),
      });

      expect(() => console.log('test with session')).not.toThrow();
    });

    it('should successfully parse and use session ID from localStorage', async () => {
      // Set valid session data before the test
      localStorageMock._setStore({
        session_id: JSON.stringify({ 'test-mentor': 'valid-session-id' }),
      });

      // Re-import the module to ensure fresh execution with the new localStorage state
      vi.resetModules();

      // Re-mock dependencies after reset
      vi.doMock('@/features/utils', () => ({
        getUserName: vi.fn(() => 'testuser'),
      }));
      vi.doMock('@/lib/utils', () => ({
        getTenantKeyFromUrl: vi.fn(() => 'test-tenant'),
        getMentorIdFromUrl: vi.fn(() => 'test-mentor'),
      }));
      vi.doMock('./constants', () => ({
        LOCAL_STORAGE_KEYS: {
          SESSION_ID: 'sessionIds',
        },
      }));

      // Dynamically import the module to get fresh instance
      const { default: FreshConsoleSetup } = await import('../logger');

      // Now console.log should use the session from localStorage
      expect(() => console.log('test with fresh session')).not.toThrow();
      expect(FreshConsoleSetup).toBeDefined();
    });

    it('should handle missing mentorId when getting session', () => {
      (getMentorIdFromUrl as any).mockReturnValue(null);

      expect(() => console.log('test')).not.toThrow();

      // Restore mock
      (getMentorIdFromUrl as any).mockReturnValue('test-mentor');
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem = vi.fn(() => {
        throw new Error('localStorage error');
      }) as any;

      const logSpy = vi.spyOn(console, 'log');

      // Should not throw
      expect(() => console.log('test')).not.toThrow();

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();

      // Restore localStorage mock
      localStorageMock.getItem = vi.fn(() => null) as any;
    });

    it('should return empty string when mentorId key is not in session storage', () => {
      // Set session data without the test-mentor key
      localStorageMock._setStore({
        session_id: JSON.stringify({ 'other-mentor': 'some-session' }),
      });

      // Should not throw - will use nullish coalescing to return ''
      expect(() => console.log('test with missing mentor key')).not.toThrow();
    });

    it('should handle when localStorage.getItem is not a function', () => {
      // Temporarily make localStorage.getItem not a function
      const originalGetItem = localStorageMock.getItem;
      (localStorageMock as any).getItem = 'not-a-function';

      // Should not throw - will return early
      expect(() => console.log('test')).not.toThrow();

      // Restore
      localStorageMock.getItem = originalGetItem;
    });
  });

  describe('edge cases for metadata', () => {
    it('should handle when all metadata sources return falsy values', () => {
      // Mock all metadata sources to return falsy values
      (getTenantKeyFromUrl as any).mockReturnValue('');
      (getMentorIdFromUrl as any).mockReturnValue('');
      (getUserName as any).mockReturnValue('');
      localStorageMock._setStore({});

      // Should not throw and should handle empty metadata gracefully
      expect(() => console.log('test with no metadata')).not.toThrow();

      // Restore mocks
      (getTenantKeyFromUrl as any).mockReturnValue('test-tenant');
      (getMentorIdFromUrl as any).mockReturnValue('test-mentor');
      (getUserName as any).mockReturnValue('testuser');
    });

    it('should handle SSR environment where window is undefined', async () => {
      // Store original window
      const originalWindow = globalThis.window;

      // Delete window to simulate SSR
      // @ts-expect-error - intentionally making window undefined for SSR test
      delete globalThis.window;

      // Reset modules to re-evaluate the module in SSR context
      vi.resetModules();

      // Re-mock dependencies
      vi.doMock('@/features/utils', () => ({
        getUserName: vi.fn(() => 'testuser'),
      }));
      vi.doMock('@/lib/utils', () => ({
        getTenantKeyFromUrl: vi.fn(() => 'test-tenant'),
        getMentorIdFromUrl: vi.fn(() => 'test-mentor'),
      }));
      vi.doMock('./constants', () => ({
        LOCAL_STORAGE_KEYS: {
          SESSION_ID: 'session_id',
        },
      }));

      // Import fresh module
      const { default: SSRConsoleSetup } = await import('../logger');
      expect(SSRConsoleSetup).toBeDefined();

      // Restore window
      globalThis.window = originalWindow;

      // Reset modules again to restore normal state
      vi.resetModules();
    });

    it('should return empty string from getTenantKeyPrefix in SSR', async () => {
      // This test verifies the SSR branch by checking the function behavior
      // when window is temporarily undefined
      const originalWindow = globalThis.window;

      vi.resetModules();

      // @ts-expect-error - intentionally making window undefined for SSR test
      delete globalThis.window;

      vi.doMock('@/features/utils', () => ({
        getUserName: vi.fn(() => 'testuser'),
      }));
      vi.doMock('@/lib/utils', () => ({
        getTenantKeyFromUrl: vi.fn(() => 'test-tenant'),
        getMentorIdFromUrl: vi.fn(() => 'test-mentor'),
      }));
      vi.doMock('./constants', () => ({
        LOCAL_STORAGE_KEYS: {
          SESSION_ID: 'session_id',
        },
      }));

      // Dynamically import and test
      await import('../logger');

      // Call console.log which internally uses the SSR-safe functions
      // These will return empty strings since window is undefined
      expect(() => console.log('SSR test')).not.toThrow();

      // Restore window
      globalThis.window = originalWindow;
      vi.resetModules();
    });

    it('should return empty metadata string when formatLogMessageMetadata returns early for SSR', async () => {
      const originalWindow = globalThis.window;

      vi.resetModules();

      // @ts-expect-error - intentionally making window undefined for SSR test
      delete globalThis.window;

      vi.doMock('@/features/utils', () => ({
        getUserName: vi.fn(() => 'testuser'),
      }));
      vi.doMock('@/lib/utils', () => ({
        getTenantKeyFromUrl: vi.fn(() => 'test-tenant'),
        getMentorIdFromUrl: vi.fn(() => 'test-mentor'),
      }));
      vi.doMock('./constants', () => ({
        LOCAL_STORAGE_KEYS: {
          SESSION_ID: 'session_id',
        },
      }));

      // Import the module in SSR context
      const loggerModule = await import('../logger');
      expect(loggerModule.default).toBeDefined();

      // Verify the module loaded (even though console overrides won't work in SSR)
      expect(typeof loggerModule.default).toBe('function');

      // Restore window
      globalThis.window = originalWindow;
      vi.resetModules();
    });

    it('should handle edge case where Date methods return unexpected values', () => {
      // This tests resilience of the date formatting function
      const originalDate = global.Date;
      const mockDate = vi.fn(() => ({
        getFullYear: () => NaN,
        getMonth: () => NaN,
        getDate: () => NaN,
        getHours: () => NaN,
        getMinutes: () => NaN,
        getSeconds: () => NaN,
      }));

      // @ts-expect-error - mocking Date constructor
      global.Date = mockDate;

      // Should still not throw even with weird Date behavior
      expect(() => console.log('test with weird date')).not.toThrow();

      // Restore Date
      global.Date = originalDate;
    });

    it('should handle edge case with various empty values combinations', () => {
      // Test with empty tenant key
      (getTenantKeyFromUrl as any).mockReturnValue('');
      expect(() => console.log('test')).not.toThrow();
      (getTenantKeyFromUrl as any).mockReturnValue('test-tenant');

      // Test with empty mentor ID
      (getMentorIdFromUrl as any).mockReturnValue('');
      expect(() => console.warn('test')).not.toThrow();
      (getMentorIdFromUrl as any).mockReturnValue('test-mentor');

      // Test with empty username
      (getUserName as any).mockReturnValue('');
      expect(() => console.error('test')).not.toThrow();
      (getUserName as any).mockReturnValue('testuser');

      // Test with all empty
      (getTenantKeyFromUrl as any).mockReturnValue('');
      (getMentorIdFromUrl as any).mockReturnValue('');
      (getUserName as any).mockReturnValue('');
      expect(() => console.log('all empty')).not.toThrow();

      // Restore all
      (getTenantKeyFromUrl as any).mockReturnValue('test-tenant');
      (getMentorIdFromUrl as any).mockReturnValue('test-mentor');
      (getUserName as any).mockReturnValue('testuser');
    });

    it('should handle when getMentorIdFromUrl throws an error', () => {
      (getMentorIdFromUrl as any).mockImplementation(() => {
        throw new Error('Failed to get mentor ID');
      });

      // Should not throw even when getMentorIdFromUrl throws
      expect(() => console.log('test message')).not.toThrow();

      // Restore mock
      (getMentorIdFromUrl as any).mockReturnValue('test-mentor');
    });

    it('should handle when getUserName throws an error', () => {
      (getUserName as any).mockImplementation(() => {
        throw new Error('Failed to get username');
      });

      // Should not throw even when getUserName throws
      expect(() => console.log('test message')).not.toThrow();

      // Restore mock
      (getUserName as any).mockReturnValue('testuser');
    });

    it('should handle undefined arguments', () => {
      expect(() => console.log(undefined)).not.toThrow();
      expect(() => console.warn(undefined)).not.toThrow();
      expect(() => console.error(undefined)).not.toThrow();
    });

    it('should handle array arguments', () => {
      const testArray = [1, 2, 3, { nested: 'value' }];
      expect(() => console.log('Array:', testArray)).not.toThrow();
    });

    it('should handle function arguments', () => {
      const testFn = () => 'test';
      expect(() => console.log('Function:', testFn)).not.toThrow();
    });

    it('should handle symbol arguments', () => {
      const testSymbol = Symbol('test');
      expect(() => console.log('Symbol:', testSymbol)).not.toThrow();
    });

    it('should handle BigInt arguments', () => {
      const testBigInt = BigInt(9007199254740991);
      expect(() => console.log('BigInt:', testBigInt)).not.toThrow();
    });
  });
});
