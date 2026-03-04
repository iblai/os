import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHeader } from '../use-header';

// Mock config
const mockIblEnableSpecialLogoWhenIframed = vi.fn();
vi.mock('@/lib/config', () => ({
  config: {
    iblEnableSpecialLogoWhenIframed: () => mockIblEnableSpecialLogoWhenIframed(),
  },
}));

// Mock utils
const mockIsInIframe = vi.fn();
vi.mock('@/lib/utils', () => ({
  isInIframe: () => mockIsInIframe(),
}));

describe('useHeader', () => {
  beforeEach(() => {
    mockIblEnableSpecialLogoWhenIframed.mockReset();
    mockIsInIframe.mockReset();
  });

  describe('useSpecialIframeLogo', () => {
    it('should return true when both conditions are met', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue('true');
      mockIsInIframe.mockReturnValue(true);

      const { result } = renderHook(() => useHeader());

      expect(result.current.useSpecialIframeLogo).toBe(true);
    });

    it('should return false when config is disabled', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue('false');
      mockIsInIframe.mockReturnValue(true);

      const { result } = renderHook(() => useHeader());

      expect(result.current.useSpecialIframeLogo).toBe(false);
    });

    it('should return false when not in iframe', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue('true');
      mockIsInIframe.mockReturnValue(false);

      const { result } = renderHook(() => useHeader());

      expect(result.current.useSpecialIframeLogo).toBe(false);
    });

    it('should return false when both conditions are false', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue('false');
      mockIsInIframe.mockReturnValue(false);

      const { result } = renderHook(() => useHeader());

      expect(result.current.useSpecialIframeLogo).toBe(false);
    });

    it('should return false when config returns undefined', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue(undefined);
      mockIsInIframe.mockReturnValue(true);

      const { result } = renderHook(() => useHeader());

      expect(result.current.useSpecialIframeLogo).toBe(false);
    });

    it('should return false when config returns empty string', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue('');
      mockIsInIframe.mockReturnValue(true);

      const { result } = renderHook(() => useHeader());

      expect(result.current.useSpecialIframeLogo).toBe(false);
    });

    it('should return false when config returns "TRUE" (case sensitive)', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue('TRUE');
      mockIsInIframe.mockReturnValue(true);

      const { result } = renderHook(() => useHeader());

      expect(result.current.useSpecialIframeLogo).toBe(false);
    });
  });

  describe('hook return structure', () => {
    it('should return object with useSpecialIframeLogo property', () => {
      mockIblEnableSpecialLogoWhenIframed.mockReturnValue('false');
      mockIsInIframe.mockReturnValue(false);

      const { result } = renderHook(() => useHeader());

      expect(result.current).toHaveProperty('useSpecialIframeLogo');
      expect(typeof result.current.useSpecialIframeLogo).toBe('boolean');
    });
  });
});
