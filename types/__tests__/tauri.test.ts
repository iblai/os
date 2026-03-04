import { describe, it, expect, afterEach } from 'vitest';
import { isTauriApp, initialModelDownloadState } from '../tauri';

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
});
