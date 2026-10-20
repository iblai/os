import { describe, it, expect, afterEach, vi } from 'vitest';
import { isTauriApp, isTauriMobile, initialModelDownloadState } from '../tauri';

const platform = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/plugin-os', () => ({ platform }));

describe('tauri types', () => {
  describe('isTauriApp', () => {
    const originalWindow = global.window;

    afterEach(() => {
      // Restore window
      global.window = originalWindow;
    });

    it('should return false when window is undefined', () => {
      // @ts-expect-error - Temporarily setting window to undefined for testing
      global.window = undefined;

      // Import fresh to avoid caching
      const result = isTauriApp();
      expect(result).toBe(false);
    });

    it('should return true when __TAURI_INTERNALS__ exists in window', () => {
      // @ts-expect-error - Adding test property
      global.window = { __TAURI_INTERNALS__: {} };

      const result = isTauriApp();
      expect(result).toBe(true);
    });

    it('should return true when __TAURI__ exists in window', () => {
      // @ts-expect-error - Adding test property
      global.window = { __TAURI__: {} };

      const result = isTauriApp();
      expect(result).toBe(true);
    });

    it('should return false when neither Tauri global exists', () => {
      // @ts-expect-error - Setting window to empty object
      global.window = {};

      const result = isTauriApp();
      expect(result).toBe(false);
    });
  });

  describe('initialModelDownloadState', () => {
    it('should have correct initial values', () => {
      expect(initialModelDownloadState.status).toBe('idle');
      expect(initialModelDownloadState.progress).toBe(0);
      expect(initialModelDownloadState.message).toBe('');
      expect(initialModelDownloadState.logs).toEqual([]);
      expect(typeof initialModelDownloadState.lastUpdated).toBe('string');
    });

    it('should have a valid ISO date string for lastUpdated', () => {
      const date = new Date(initialModelDownloadState.lastUpdated);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });

  describe('isTauriMobile', () => {
    const originalWindow = global.window;

    afterEach(() => {
      global.window = originalWindow;
      platform.mockReset();
    });

    it('resolves false outside Tauri without asking the OS plugin', async () => {
      // @ts-expect-error - Setting window to empty object
      global.window = {};

      await expect(isTauriMobile()).resolves.toBe(false);
      expect(platform).not.toHaveBeenCalled();
    });

    it.each([
      ['ios', true],
      ['android', true],
      ['macos', false],
      ['linux', false],
    ])('resolves %s as mobile=%s inside Tauri', async (os, expected) => {
      // @ts-expect-error - Adding test property
      global.window = { __TAURI_INTERNALS__: {} };
      platform.mockReturnValue(os);

      await expect(isTauriMobile()).resolves.toBe(expected);
    });

    it('resolves false when the OS plugin is unavailable', async () => {
      // @ts-expect-error - Adding test property
      global.window = { __TAURI_INTERNALS__: {} };
      platform.mockImplementation(() => {
        throw new Error('plugin os not found');
      });

      await expect(isTauriMobile()).resolves.toBe(false);
    });
  });
});
