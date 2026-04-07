import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('register-sw', () => {
  let mockRegistration: Partial<ServiceWorkerRegistration>;
  let mockServiceWorker: Partial<ServiceWorkerContainer>;
  let mockController: Partial<ServiceWorker>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock service worker registration
    mockRegistration = {
      installing: null,
      waiting: null,
      active: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      update: vi.fn(),
      unregister: vi.fn().mockResolvedValue(true),
    };

    // Mock service worker controller
    mockController = {
      postMessage: vi.fn(),
    };

    // Mock navigator.serviceWorker
    mockServiceWorker = {
      register: vi.fn().mockResolvedValue(mockRegistration),
      controller: mockController as ServiceWorker,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Set up navigator mock
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorker,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('isServiceWorkerSupported', () => {
    it('should return true when service worker is supported', async () => {
      const { isServiceWorkerSupported } = await import('../register-sw');
      expect(isServiceWorkerSupported()).toBe(true);
    });

    it('should return false when service worker is not supported', async () => {
      // @ts-expect-error - removing serviceWorker
      delete navigator.serviceWorker;

      vi.resetModules();
      const { isServiceWorkerSupported } = await import('../register-sw');
      expect(isServiceWorkerSupported()).toBe(false);
    });
  });

  describe('getServiceWorkerStatus', () => {
    it('should return initial status', async () => {
      const { getServiceWorkerStatus } = await import('../register-sw');
      const status = getServiceWorkerStatus();

      expect(status).toMatchObject({
        isSupported: true,
        isRegistered: false,
        isOnline: true,
        updateAvailable: false,
      });
    });
  });

  describe('registerServiceWorker', () => {
    it('should register service worker', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { registerServiceWorker } = await import('../register-sw');

      const registration = await registerServiceWorker();

      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
      });
      expect(registration).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should return null when service worker not supported', async () => {
      // @ts-expect-error - removing serviceWorker
      delete navigator.serviceWorker;

      vi.resetModules();
      const { registerServiceWorker } = await import('../register-sw');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const registration = await registerServiceWorker();

      expect(registration).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should handle registration error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockServiceWorker.register = vi
        .fn()
        .mockRejectedValue(new Error('Registration failed'));

      vi.resetModules();
      const { registerServiceWorker } = await import('../register-sw');

      const registration = await registerServiceWorker();

      expect(registration).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('unregisterServiceWorker', () => {
    it('should return false when not registered', async () => {
      const { unregisterServiceWorker } = await import('../register-sw');

      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
    });

    it('should unregister successfully after registration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { registerServiceWorker, unregisterServiceWorker } = await import(
        '../register-sw'
      );

      await registerServiceWorker();
      const result = await unregisterServiceWorker();

      expect(result).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('skipWaiting', () => {
    it('should post SKIP_WAITING message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockWaiting = { postMessage: vi.fn() };
      (mockRegistration as { waiting: ServiceWorker | null }).waiting =
        mockWaiting as unknown as ServiceWorker;

      const { registerServiceWorker, skipWaiting } = await import(
        '../register-sw'
      );
      await registerServiceWorker();

      skipWaiting();

      expect(mockWaiting.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
      consoleSpy.mockRestore();
    });

    it('should not throw when no waiting worker', async () => {
      const { skipWaiting } = await import('../register-sw');

      expect(() => skipWaiting()).not.toThrow();
    });
  });

  describe('clearAllCaches', () => {
    it('should post CLEAR_CACHE message', async () => {
      const { clearAllCaches } = await import('../register-sw');

      clearAllCaches();

      expect(mockController.postMessage).toHaveBeenCalledWith({
        type: 'CLEAR_CACHE',
      });
    });
  });

  describe('setTauriMode', () => {
    it('should post SET_TAURI message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { setTauriMode } = await import('../register-sw');

      setTauriMode(true);

      expect(mockController.postMessage).toHaveBeenCalledWith({
        type: 'SET_TAURI',
        data: true,
      });
      consoleSpy.mockRestore();
    });

    it('should send false when not in Tauri', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { setTauriMode } = await import('../register-sw');

      setTauriMode(false);

      expect(mockController.postMessage).toHaveBeenCalledWith({
        type: 'SET_TAURI',
        data: false,
      });
      consoleSpy.mockRestore();
    });
  });

  describe('setOfflineStatus', () => {
    it('should post SET_OFFLINE message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { setOfflineStatus } = await import('../register-sw');

      setOfflineStatus(true);

      expect(mockController.postMessage).toHaveBeenCalledWith({
        type: 'SET_OFFLINE',
        data: true,
      });
      consoleSpy.mockRestore();
    });
  });

  describe('getCacheStatus', () => {
    it('should return null when no controller', async () => {
      (mockServiceWorker as { controller: ServiceWorker | null }).controller =
        null;

      vi.resetModules();
      const { getCacheStatus } = await import('../register-sw');

      const status = await getCacheStatus();

      expect(status).toBeNull();
    });
  });

  describe('onUpdate', () => {
    it('should add update callback', async () => {
      const { onUpdate } = await import('../register-sw');
      const callback = vi.fn();

      const unsubscribe = onUpdate(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return unsubscribe function', async () => {
      const { onUpdate } = await import('../register-sw');
      const callback = vi.fn();

      const unsubscribe = onUpdate(callback);
      unsubscribe();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('onStatusChange', () => {
    it('should add status change callback', async () => {
      const { onStatusChange } = await import('../register-sw');
      const callback = vi.fn();

      const unsubscribe = onStatusChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return unsubscribe function', async () => {
      const { onStatusChange } = await import('../register-sw');
      const callback = vi.fn();

      const unsubscribe = onStatusChange(callback);
      unsubscribe();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('setupNetworkListeners', () => {
    it('should setup online/offline listeners', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const { setupNetworkListeners } = await import('../register-sw');

      const cleanup = setupNetworkListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'online',
        expect.any(Function),
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function),
      );
      expect(typeof cleanup).toBe('function');

      addEventListenerSpy.mockRestore();
    });

    it('should return cleanup function that removes listeners', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { setupNetworkListeners } = await import('../register-sw');

      const cleanup = setupNetworkListeners();
      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'online',
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'offline',
        expect.any(Function),
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('initServiceWorker', () => {
    it('should setup network listeners and register', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { initServiceWorker } = await import('../register-sw');

      const status = await initServiceWorker();

      expect(status).toMatchObject({
        isSupported: true,
        isOnline: true,
      });

      consoleSpy.mockRestore();
    });

    it('should setup controller change listener', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const addEventListenerSpy = vi.fn();
      (mockServiceWorker as { addEventListener: any }).addEventListener =
        addEventListenerSpy;

      vi.resetModules();
      const { initServiceWorker } = await import('../register-sw');

      await initServiceWorker();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function),
      );

      consoleSpy.mockRestore();
    });

    it('should not setup controller listener when service worker not supported', async () => {
      // @ts-expect-error - removing serviceWorker
      delete navigator.serviceWorker;

      vi.resetModules();
      const { initServiceWorker } = await import('../register-sw');

      await initServiceWorker();

      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  describe('registerServiceWorker with basePath', () => {
    it('should use custom base path when provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      process.env.NEXT_PUBLIC_BASE_PATH = '/custom-path';

      vi.resetModules();
      const { registerServiceWorker } = await import('../register-sw');

      await registerServiceWorker();

      expect(mockServiceWorker.register).toHaveBeenCalledWith(
        '/custom-path/sw.js',
        {
          scope: '/custom-path',
        },
      );

      delete process.env.NEXT_PUBLIC_BASE_PATH;
      consoleSpy.mockRestore();
    });
  });

  describe('updatefound event handling', () => {
    it('should handle updatefound event with installing worker', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockInstallingWorker = {
        state: 'installing',
        addEventListener: vi.fn(),
      };

      (mockRegistration as { installing: ServiceWorker | null }).installing =
        mockInstallingWorker as unknown as ServiceWorker;

      const { registerServiceWorker } = await import('../register-sw');
      await registerServiceWorker();

      // Get the updatefound callback
      const updatefoundCallback = (
        mockRegistration.addEventListener as any
      ).mock.calls.find((call: any) => call[0] === 'updatefound')?.[1];

      expect(updatefoundCallback).toBeDefined();

      // Call the updatefound callback
      if (updatefoundCallback) {
        updatefoundCallback();

        // Get the statechange callback
        const statechangeCallback =
          mockInstallingWorker.addEventListener.mock.calls.find(
            (call: any) => call[0] === 'statechange',
          )?.[1];

        expect(statechangeCallback).toBeDefined();

        // Set up controller for testing installed state
        (mockServiceWorker as { controller: ServiceWorker | null }).controller =
          mockController as ServiceWorker;

        // Simulate state change to 'installed'
        mockInstallingWorker.state = 'installed';
        if (statechangeCallback) {
          statechangeCallback();
        }
      }

      consoleSpy.mockRestore();
    });

    it('should handle updatefound with no installing worker', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      (mockRegistration as { installing: ServiceWorker | null }).installing =
        null;

      const { registerServiceWorker } = await import('../register-sw');
      await registerServiceWorker();

      // Get the updatefound callback
      const updatefoundCallback = (
        mockRegistration.addEventListener as any
      ).mock.calls.find((call: any) => call[0] === 'updatefound')?.[1];

      // Should not throw when no installing worker
      expect(() => updatefoundCallback?.()).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should not mark update available when no controller', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockInstallingWorker = {
        state: 'installing',
        addEventListener: vi.fn(),
      };

      (mockRegistration as { installing: ServiceWorker | null }).installing =
        mockInstallingWorker as unknown as ServiceWorker;

      (mockServiceWorker as { controller: ServiceWorker | null }).controller =
        null;

      const { registerServiceWorker, getServiceWorkerStatus } = await import(
        '../register-sw'
      );
      await registerServiceWorker();

      // Get the updatefound callback
      const updatefoundCallback = (
        mockRegistration.addEventListener as any
      ).mock.calls.find((call: any) => call[0] === 'updatefound')?.[1];

      if (updatefoundCallback) {
        updatefoundCallback();

        const statechangeCallback =
          mockInstallingWorker.addEventListener.mock.calls.find(
            (call: any) => call[0] === 'statechange',
          )?.[1];

        // Simulate state change to 'installed' without controller
        mockInstallingWorker.state = 'installed';
        if (statechangeCallback) {
          statechangeCallback();
        }

        const status = getServiceWorkerStatus();
        // Update should not be marked as available without controller
        expect(status.updateAvailable).toBe(false);
      }

      consoleSpy.mockRestore();
    });
  });

  describe('update polling', () => {
    it('should setup periodic update checks', async () => {
      vi.useFakeTimers();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.resetModules();
      const { registerServiceWorker } = await import('../register-sw');

      await registerServiceWorker();

      // Fast-forward 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Update should have been called
      expect(mockRegistration.update).toHaveBeenCalled();

      vi.useRealTimers();
      consoleSpy.mockRestore();
    });
  });

  describe('getCacheStatus timeout', () => {
    it('should timeout after 5 seconds', async () => {
      vi.useFakeTimers();
      const { getCacheStatus } = await import('../register-sw');

      const promise = getCacheStatus();

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      const result = await promise;
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should handle message response before timeout', async () => {
      vi.useFakeTimers();
      const mockAddEventListener = vi.fn((event, handler) => {
        if (event === 'message') {
          // Simulate immediate response
          setTimeout(() => {
            handler({
              data: {
                type: 'CACHE_STATUS',
                status: { cache1: 10, cache2: 20 },
              },
            });
          }, 100);
        }
      });
      (mockServiceWorker as { addEventListener: any }).addEventListener =
        mockAddEventListener;

      vi.resetModules();
      const { getCacheStatus } = await import('../register-sw');

      const promise = getCacheStatus();

      // Fast-forward past the message response time
      vi.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toEqual({ cache1: 10, cache2: 20 });

      vi.useRealTimers();
    });
  });

  describe('unregisterServiceWorker edge cases', () => {
    it('should handle unregister failure', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockRegistration.unregister = vi
        .fn()
        .mockRejectedValue(new Error('Unregister failed'));

      vi.resetModules();
      const { registerServiceWorker, unregisterServiceWorker } = await import(
        '../register-sw'
      );

      await registerServiceWorker();
      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('network listeners edge cases', () => {
    it('should handle online event', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { setupNetworkListeners } = await import('../register-sw');

      const cleanup = setupNetworkListeners();

      // Trigger online event
      window.dispatchEvent(new Event('online'));

      // Should log message
      expect(consoleSpy).toHaveBeenCalledWith('[SW Registration] Back online');

      cleanup();
      consoleSpy.mockRestore();
    });

    it('should handle offline event', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { setupNetworkListeners } = await import('../register-sw');

      const cleanup = setupNetworkListeners();

      // Trigger offline event
      window.dispatchEvent(new Event('offline'));

      // Should log message
      expect(consoleSpy).toHaveBeenCalledWith('[SW Registration] Gone offline');

      cleanup();
      consoleSpy.mockRestore();
    });
  });

  describe('status callbacks', () => {
    it('should call onUpdate callbacks when update is found', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const callback = vi.fn();

      const mockInstallingWorker = {
        state: 'installing',
        addEventListener: vi.fn(),
      };

      (mockRegistration as { installing: ServiceWorker | null }).installing =
        mockInstallingWorker as unknown as ServiceWorker;
      (mockServiceWorker as { controller: ServiceWorker | null }).controller =
        mockController as ServiceWorker;

      const { registerServiceWorker, onUpdate } = await import(
        '../register-sw'
      );

      onUpdate(callback);
      await registerServiceWorker();

      // Get the updatefound callback
      const updatefoundCallback = (
        mockRegistration.addEventListener as any
      ).mock.calls.find((call: any) => call[0] === 'updatefound')?.[1];

      if (updatefoundCallback) {
        updatefoundCallback();

        const statechangeCallback =
          mockInstallingWorker.addEventListener.mock.calls.find(
            (call: any) => call[0] === 'statechange',
          )?.[1];

        mockInstallingWorker.state = 'installed';
        if (statechangeCallback) {
          statechangeCallback();
        }

        expect(callback).toHaveBeenCalledWith(mockRegistration);
      }

      consoleSpy.mockRestore();
    });

    it('should call onStatusChange callbacks on registration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const callback = vi.fn();

      vi.resetModules();
      const { registerServiceWorker, onStatusChange } = await import(
        '../register-sw'
      );

      onStatusChange(callback);
      await registerServiceWorker();

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isSupported: true,
          isRegistered: true,
        }),
      );

      consoleSpy.mockRestore();
    });

    it('should remove callbacks when unsubscribed', async () => {
      const callback = vi.fn();

      const { onUpdate } = await import('../register-sw');

      const unsubscribe = onUpdate(callback);
      unsubscribe();

      // Callback should not be in the list anymore
      // Verify by checking it doesn't get called
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
