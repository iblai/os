import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEmbedMode } from '../use-embed-mode';

// Mock next/navigation
const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

describe('useEmbedMode', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  describe('embed parameter detection', () => {
    it('should return true when embed=true', () => {
      mockGet.mockImplementation((key: string) =>
        key === 'embed' ? 'true' : null,
      );

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('embed');
    });

    it('should return false when embed=false', () => {
      mockGet.mockImplementation((key: string) =>
        key === 'embed' ? 'false' : null,
      );

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);
    });

    it('should return false when embed parameter is not present', () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);
    });

    it('should return false when embed has unexpected value', () => {
      mockGet.mockImplementation((key: string) =>
        key === 'embed' ? 'yes' : null,
      );

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);
    });

    it('should return false when embed is empty string', () => {
      mockGet.mockImplementation((key: string) =>
        key === 'embed' ? '' : null,
      );

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);
    });

    it('should be case sensitive (TRUE should return false)', () => {
      mockGet.mockImplementation((key: string) =>
        key === 'embed' ? 'TRUE' : null,
      );

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);
    });

    it('should be case sensitive (True should return false)', () => {
      mockGet.mockImplementation((key: string) =>
        key === 'embed' ? 'True' : null,
      );

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);
    });
  });

  describe('window.location fallback (transient empty searchParams)', () => {
    it('falls back to the live URL when useSearchParams is empty but ?embed=true is in the URL', () => {
      mockGet.mockReturnValue(null); // useSearchParams momentarily empty
      window.history.replaceState({}, '', '/platform/main/m1?embed=true');

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(true);

      window.history.replaceState({}, '', '/'); // reset
    });

    it('returns false when neither searchParams nor the URL have embed=true', () => {
      mockGet.mockReturnValue(null);
      window.history.replaceState({}, '', '/platform/main/m1');

      const { result } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);

      window.history.replaceState({}, '', '/'); // reset
    });
  });

  describe('re-render behavior', () => {
    it('should update when search params change', () => {
      mockGet.mockReturnValue(null);

      const { result, rerender } = renderHook(() => useEmbedMode());

      expect(result.current).toBe(false);

      mockGet.mockImplementation((key: string) =>
        key === 'embed' ? 'true' : null,
      );
      rerender();

      expect(result.current).toBe(true);
    });
  });
});
