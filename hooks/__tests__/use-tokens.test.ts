import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDmToken, useAxdToken } from '../use-tokens';

// Mock useLocalStorage
const mockUseLocalStorage = vi.fn();
vi.mock('../use-local-storage', () => ({
  useLocalStorage: (...args: unknown[]) => mockUseLocalStorage(...args),
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  LOCAL_STORAGE_KEYS: {
    DM_TOKEN_KEY: 'dm_token',
    AXD_TOKEN_KEY: 'axd_token',
  },
}));

describe('use-tokens', () => {
  beforeEach(() => {
    mockUseLocalStorage.mockReset();
  });

  describe('useDmToken', () => {
    it('should return dm token from localStorage', () => {
      mockUseLocalStorage.mockReturnValue(['test-dm-token', vi.fn(), vi.fn()]);

      const { result } = renderHook(() => useDmToken());

      expect(result.current).toBe('test-dm-token');
      expect(mockUseLocalStorage).toHaveBeenCalledWith('dm_token', '');
    });

    it('should return empty string when no token stored', () => {
      mockUseLocalStorage.mockReturnValue(['', vi.fn(), vi.fn()]);

      const { result } = renderHook(() => useDmToken());

      expect(result.current).toBe('');
    });

    it('should update when localStorage changes', () => {
      mockUseLocalStorage.mockReturnValue(['initial-token', vi.fn(), vi.fn()]);

      const { result, rerender } = renderHook(() => useDmToken());

      expect(result.current).toBe('initial-token');

      mockUseLocalStorage.mockReturnValue(['updated-token', vi.fn(), vi.fn()]);
      rerender();

      expect(result.current).toBe('updated-token');
    });
  });

  describe('useAxdToken', () => {
    it('should return axd token from localStorage', () => {
      mockUseLocalStorage.mockReturnValue(['test-axd-token', vi.fn(), vi.fn()]);

      const { result } = renderHook(() => useAxdToken());

      expect(result.current).toBe('test-axd-token');
      expect(mockUseLocalStorage).toHaveBeenCalledWith('axd_token', '');
    });

    it('should return empty string when no token stored', () => {
      mockUseLocalStorage.mockReturnValue(['', vi.fn(), vi.fn()]);

      const { result } = renderHook(() => useAxdToken());

      expect(result.current).toBe('');
    });

    it('should update when localStorage changes', () => {
      mockUseLocalStorage.mockReturnValue(['initial-axd', vi.fn(), vi.fn()]);

      const { result, rerender } = renderHook(() => useAxdToken());

      expect(result.current).toBe('initial-axd');

      mockUseLocalStorage.mockReturnValue(['updated-axd', vi.fn(), vi.fn()]);
      rerender();

      expect(result.current).toBe('updated-axd');
    });
  });
});
