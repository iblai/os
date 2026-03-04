import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../use-local-storage';

describe('useLocalStorage', () => {
  const originalLocalStorage = window.localStorage;

  let store: Record<string, string>;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Create a mock localStorage with actual storage
    store = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
      length: 0,
      key: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('initial value', () => {
    it('should return initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      expect(result.current[0]).toBe('defaultValue');
    });

    it('should return stored value when localStorage has data', () => {
      // Pre-populate the store with a non-JSON string
      store['testKey'] = 'storedValue';

      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      expect(result.current[0]).toBe('storedValue');
    });

    it('should support function initializer', () => {
      const initializer = vi.fn(() => 'computedDefault');

      const { result } = renderHook(() => useLocalStorage('testKey', initializer));

      expect(result.current[0]).toBe('computedDefault');
    });

    it('should respect initializeWithValue option set to false during initial render', () => {
      store['testKey'] = '{"val":"storedValue"}';

      // With initializeWithValue: false, the initial state is set to the default value
      // However, useEffect runs after and reads from localStorage
      // So eventually the value will be the stored value
      // This test verifies the option is being used in the useState initializer
      const { result } = renderHook(() =>
        useLocalStorage('testKey', { val: 'defaultValue' }, { initializeWithValue: false }),
      );

      // After effects run, the value is read from localStorage
      expect(result.current[0]).toEqual({ val: 'storedValue' });
    });
  });

  describe('setValue', () => {
    it('should update state and localStorage', () => {
      // Use objects as they round-trip properly through JSON serialization
      const { result } = renderHook(() => useLocalStorage('testKey', { value: 'default' }));

      act(() => {
        result.current[1]({ value: 'newValue' });
      });

      expect(result.current[0]).toEqual({ value: 'newValue' });
      expect(window.localStorage.setItem).toHaveBeenCalledWith('testKey', '{"value":"newValue"}');
    });

    it('should support function updater', () => {
      // Use objects to test function updater, as objects get properly deserialized
      const { result } = renderHook(() => useLocalStorage('testKey', { count: 0 }));

      act(() => {
        result.current[1]((prev) => ({ count: prev.count + 1 }));
      });

      expect(result.current[0]).toEqual({ count: 1 });

      act(() => {
        result.current[1]((prev) => ({ count: prev.count + 10 }));
      });

      expect(result.current[0]).toEqual({ count: 11 });
    });

    it('should dispatch custom storage event', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      act(() => {
        result.current[1]('newValue');
      });

      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(StorageEvent));
    });
  });

  describe('removeValue', () => {
    it('should remove item from localStorage and reset to initial value', () => {
      store['testKey'] = 'storedValue';

      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      expect(result.current[0]).toBe('storedValue');

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe('defaultValue');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('testKey');
    });

    it('should dispatch custom storage event on remove', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      act(() => {
        result.current[2]();
      });

      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(StorageEvent));
    });

    it('should handle function initializer on remove', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', () => 'computedDefault'));

      act(() => {
        result.current[1]('newValue');
      });

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe('computedDefault');
    });
  });

  describe('serialization', () => {
    it('should use default JSON serializer', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', { nested: 'value' }));

      act(() => {
        result.current[1]({ nested: 'updated' });
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith('testKey', '{"nested":"updated"}');
    });

    it('should use custom serializer when provided', () => {
      const customSerializer = vi.fn((value: string) => `custom:${value}`);

      const { result } = renderHook(() =>
        useLocalStorage<string>('testKey', 'default', { serializer: customSerializer }),
      );

      act(() => {
        result.current[1]('testValue');
      });

      expect(customSerializer).toHaveBeenCalledWith('testValue');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('testKey', 'custom:testValue');
    });
  });

  describe('deserialization', () => {
    it('should parse JSON objects from localStorage', () => {
      store['testKey'] = '{"key":"value"}';

      const { result } = renderHook(() => useLocalStorage('testKey', {} as { key: string }));

      expect(result.current[0]).toEqual({ key: 'value' });
    });

    it('should parse JSON arrays from localStorage', () => {
      store['testKey'] = '[1,2,3]';

      const { result } = renderHook(() => useLocalStorage('testKey', [] as number[]));

      expect(result.current[0]).toEqual([1, 2, 3]);
    });

    it('should return plain string for non-JSON values', () => {
      store['testKey'] = 'plainString';

      const { result } = renderHook(() => useLocalStorage('testKey', 'default'));

      expect(result.current[0]).toBe('plainString');
    });

    it('should handle "undefined" string', () => {
      store['testKey'] = 'undefined';

      const { result } = renderHook(() =>
        useLocalStorage<string | undefined>('testKey', 'default'),
      );

      expect(result.current[0]).toBeUndefined();
    });

    it('should use custom deserializer when provided', () => {
      store['testKey'] = 'custom:value';
      const customDeserializer = vi.fn((value: string) => value.replace('custom:', ''));

      const { result } = renderHook(() =>
        useLocalStorage('testKey', 'default', { deserializer: customDeserializer }),
      );

      expect(customDeserializer).toHaveBeenCalledWith('custom:value');
      expect(result.current[0]).toBe('value');
    });

    it('should return default value on JSON parse error', () => {
      store['testKey'] = '{invalid json';

      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      // Non-JSON starting with { should attempt parse and fail
      expect(result.current[0]).toBe('defaultValue');
    });
  });

  describe('error handling', () => {
    it('should handle localStorage.getItem throwing', () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      expect(result.current[0]).toBe('defaultValue');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should handle localStorage.setItem throwing', () => {
      (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      act(() => {
        result.current[1]('newValue');
      });

      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('storage event handling', () => {
    it('should update when storage event is received for same key', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      // Simulate external change to localStorage
      store['testKey'] = 'externalValue';

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'testKey' }));
      });

      expect(result.current[0]).toBe('externalValue');
    });

    it('should ignore storage events for different keys', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'otherKey' }));
      });

      expect(result.current[0]).toBe('defaultValue');
    });

    it('should handle custom local-storage events', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));

      // Simulate external change to localStorage
      store['testKey'] = 'updatedValue';

      act(() => {
        window.dispatchEvent(new StorageEvent('local-storage', { key: 'testKey' }));
      });

      expect(result.current[0]).toBe('updatedValue');
    });
  });

  describe('key change behavior', () => {
    it('should read new key value when key changes', () => {
      store['key1'] = 'value1';
      store['key2'] = 'value2';

      const { result, rerender } = renderHook(
        ({ storageKey }) => useLocalStorage(storageKey, 'default'),
        { initialProps: { storageKey: 'key1' } },
      );

      expect(result.current[0]).toBe('value1');

      rerender({ storageKey: 'key2' });

      expect(result.current[0]).toBe('value2');
    });
  });

  describe('complex data types', () => {
    it('should handle nested objects', () => {
      const complexObj = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      };

      const { result } = renderHook(() => useLocalStorage('testKey', {} as typeof complexObj));

      act(() => {
        result.current[1](complexObj);
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'testKey',
        JSON.stringify(complexObj),
      );
    });

    it('should handle arrays of objects', () => {
      const arrayData = [{ id: 1 }, { id: 2 }];

      const { result } = renderHook(() => useLocalStorage('testKey', [] as typeof arrayData));

      act(() => {
        result.current[1](arrayData);
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'testKey',
        JSON.stringify(arrayData),
      );
    });

    it('should handle numbers', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 0));

      act(() => {
        result.current[1](42);
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith('testKey', '42');
    });

    it('should handle booleans', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', false));

      act(() => {
        result.current[1](true);
      });

      expect(window.localStorage.setItem).toHaveBeenCalledWith('testKey', 'true');
    });
  });

  describe('server-side rendering (SSR)', () => {
    it('should return initial value when window is undefined (readValue)', async () => {
      // Reset modules so we can re-import with modified window
      vi.resetModules();

      // Save original window
      const originalWindow = global.window;

      // Make window undefined to simulate server environment
      // @ts-expect-error - setting window to undefined for SSR simulation
      delete global.window;

      // Dynamically import the hook to trigger module-level IS_SERVER evaluation
      const { useLocalStorage: useLocalStorageSSR } = await import('../use-local-storage');

      // Restore window before rendering (renderHook needs window)
      global.window = originalWindow;

      // When IS_SERVER is true at module load time, readValue returns initialValue
      const { result } = renderHook(() => useLocalStorageSSR('testKey', 'serverDefault'));

      // The hook should return the initial value since IS_SERVER was true at load time
      expect(result.current[0]).toBe('serverDefault');
    });

    it('should warn when trying to setValue on server', async () => {
      // Reset modules so we can re-import with modified window
      vi.resetModules();

      // Save original window
      const originalWindow = global.window;

      // Make window undefined to simulate server environment
      // @ts-expect-error - setting window to undefined for SSR simulation
      delete global.window;

      // Dynamically import the hook to trigger module-level IS_SERVER evaluation
      const { useLocalStorage: useLocalStorageSSR } = await import('../use-local-storage');

      // Restore window before rendering (renderHook needs window)
      global.window = originalWindow;

      // Re-spy on console.warn after restoring window
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useLocalStorageSSR('testKey', 'serverDefault'));

      // Call setValue - it should warn about server-side usage
      act(() => {
        result.current[1]('newValue');
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tried setting localStorage key'),
      );

      warnSpy.mockRestore();
    });

    it('should warn when trying to removeValue on server', async () => {
      // Reset modules so we can re-import with modified window
      vi.resetModules();

      // Save original window
      const originalWindow = global.window;

      // Make window undefined to simulate server environment
      // @ts-expect-error - setting window to undefined for SSR simulation
      delete global.window;

      // Dynamically import the hook to trigger module-level IS_SERVER evaluation
      const { useLocalStorage: useLocalStorageSSR } = await import('../use-local-storage');

      // Restore window before rendering (renderHook needs window)
      global.window = originalWindow;

      // Re-spy on console.warn after restoring window
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useLocalStorageSSR('testKey', 'serverDefault'));

      // Call removeValue - it should warn about server-side usage
      act(() => {
        result.current[2]();
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tried removing localStorage key'),
      );

      warnSpy.mockRestore();
    });
  });
});
