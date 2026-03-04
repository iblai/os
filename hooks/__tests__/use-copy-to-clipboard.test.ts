import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '../use-copy-to-clipboard';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' })),
}));

describe('useCopyToClipboard', () => {
  const originalClipboard = navigator.clipboard;
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockWriteText.mockReset();

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      configurable: true,
      value: {
        writeText: mockWriteText,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    // Restore original clipboard
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      configurable: true,
      value: originalClipboard,
    });
  });

  describe('initial state', () => {
    it('should return idle status initially', () => {
      const { result } = renderHook(() => useCopyToClipboard());

      expect(result.current.status).toBe('idle');
      expect(typeof result.current.copy).toBe('function');
    });

    it('should accept custom timeout parameter', () => {
      const { result } = renderHook(() => useCopyToClipboard(1000));

      expect(result.current.status).toBe('idle');
    });
  });

  describe('successful copy', () => {
    it('should copy text to clipboard successfully', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(mockWriteText).toHaveBeenCalledWith('test text');
      expect(result.current.status).toBe('success');
    });

    it('should reset status to idle after default timeout (500ms)', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.status).toBe('idle');
    });

    it('should reset status to idle after custom timeout', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard(1000));

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should still be success since timeout is 1000ms
      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.status).toBe('idle');
    });

    it('should handle copying empty string', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('');
      });

      expect(mockWriteText).toHaveBeenCalledWith('');
      expect(result.current.status).toBe('success');
    });

    it('should handle copying special characters', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard());
      const specialText = '!@#$%^&*()_+{}[]|\\:";\'<>?,./`~';

      await act(async () => {
        await result.current.copy(specialText);
      });

      expect(mockWriteText).toHaveBeenCalledWith(specialText);
      expect(result.current.status).toBe('success');
    });

    it('should handle copying unicode characters', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard());
      const unicodeText = 'Hello World! ';

      await act(async () => {
        await result.current.copy(unicodeText);
      });

      expect(mockWriteText).toHaveBeenCalledWith(unicodeText);
      expect(result.current.status).toBe('success');
    });
  });

  describe('error handling', () => {
    it('should set error status when clipboard write fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard write failed'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.status).toBe('error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle clipboard not supported', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Remove clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        writable: true,
        configurable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      // Status should remain idle since we early return
      expect(result.current.status).toBe('idle');
      expect(consoleSpy).toHaveBeenCalledWith('Clipboard not supported');
      consoleSpy.mockRestore();
    });

    it('should handle null navigator.clipboard', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      Object.defineProperty(navigator, 'clipboard', {
        writable: true,
        configurable: true,
        value: null,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.status).toBe('idle');
      expect(consoleSpy).toHaveBeenCalledWith('Clipboard not supported');
      consoleSpy.mockRestore();
    });
  });

  describe('multiple copies', () => {
    it('should handle multiple consecutive copies', async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('first');
      });
      expect(result.current.status).toBe('success');

      await act(async () => {
        await result.current.copy('second');
      });
      expect(result.current.status).toBe('success');

      expect(mockWriteText).toHaveBeenCalledTimes(2);
      expect(mockWriteText).toHaveBeenNthCalledWith(1, 'first');
      expect(mockWriteText).toHaveBeenNthCalledWith(2, 'second');
    });

    it('should handle success followed by error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockWriteText.mockResolvedValueOnce(undefined);
      mockWriteText.mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('success text');
      });
      expect(result.current.status).toBe('success');

      await act(async () => {
        await result.current.copy('error text');
      });
      expect(result.current.status).toBe('error');

      consoleSpy.mockRestore();
    });
  });

  describe('timeout behavior', () => {
    it('should use default timeout of 500ms', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test');
      });

      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(499);
      });
      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.status).toBe('idle');
    });

    it('should handle zero timeout', async () => {
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard(0));

      await act(async () => {
        await result.current.copy('test');
      });

      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.status).toBe('idle');
    });
  });

  describe('memoization', () => {
    it('should maintain stable copy function reference when timeout does not change', () => {
      const { result, rerender } = renderHook(() => useCopyToClipboard(500));

      const firstCopyFn = result.current.copy;
      rerender();
      const secondCopyFn = result.current.copy;

      expect(firstCopyFn).toBe(secondCopyFn);
    });
  });
});
