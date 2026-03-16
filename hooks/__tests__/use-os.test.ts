import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(),
}));

import { platform } from '@tauri-apps/plugin-os';
import { useOS } from '../use-os';

describe('useOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAppleDevice', () => {
    it('should return true for ios', () => {
      vi.mocked(platform).mockReturnValue('ios' as never);
      const { result } = renderHook(() => useOS());
      expect(result.current.isAppleDevice).toBe(true);
    });

    it('should return true for macos', () => {
      vi.mocked(platform).mockReturnValue('macos' as never);
      const { result } = renderHook(() => useOS());
      expect(result.current.isAppleDevice).toBe(true);
    });

    it('should return false for windows', () => {
      vi.mocked(platform).mockReturnValue('windows' as never);
      const { result } = renderHook(() => useOS());
      expect(result.current.isAppleDevice).toBe(false);
    });

    it('should return false for linux', () => {
      vi.mocked(platform).mockReturnValue('linux' as never);
      const { result } = renderHook(() => useOS());
      expect(result.current.isAppleDevice).toBe(false);
    });

    it('should return false for android', () => {
      vi.mocked(platform).mockReturnValue('android' as never);
      const { result } = renderHook(() => useOS());
      expect(result.current.isAppleDevice).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return false when platform() throws', () => {
      vi.mocked(platform).mockImplementation(() => {
        throw new Error('Tauri not available');
      });
      const { result } = renderHook(() => useOS());
      expect(result.current.isAppleDevice).toBe(false);
    });
  });
});
