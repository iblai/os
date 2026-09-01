import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useParams } from 'next/navigation';
import { useCopyToClipboard } from '../use-copy-to-clipboard';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({
    tenantKey: 'test-tenant',
    mentorId: 'test-mentor',
  })),
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
    it('should set error status when clipboard write and fallback both fail', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard write failed'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(result.current.status).toBe('error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('permissions-policy fallback', () => {
    // A cross-origin embedder that does not delegate `clipboard-write` makes
    // navigator.clipboard reject (or absent); execCommand is the escape hatch.
    let execCommand: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      execCommand = vi.fn(() => true);
      Object.defineProperty(document, 'execCommand', {
        writable: true,
        configurable: true,
        value: execCommand,
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      // @ts-expect-error - jsdom does not implement execCommand
      delete document.execCommand;
    });

    it('should fall back to execCommand when the clipboard API is blocked', async () => {
      mockWriteText.mockRejectedValueOnce(
        new DOMException('blocked', 'NotAllowedError'),
      );
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(result.current.status).toBe('success');
    });

    it('should fall back to execCommand when the clipboard API is absent', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        writable: true,
        configurable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(result.current.status).toBe('success');
    });

    it('should reset to idle after the timeout when the fallback succeeds', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });
      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.status).toBe('idle');
    });

    it('should report error when execCommand reports failure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      execCommand.mockReturnValue(false);
      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(result.current.status).toBe('error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should report error when execCommand throws', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      execCommand.mockImplementation(() => {
        throw new Error('execCommand unavailable');
      });
      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(result.current.status).toBe('error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not leave the staging textarea in the document', async () => {
      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(document.querySelectorAll('textarea')).toHaveLength(0);
    });

    it('should skip the clipboard API entirely when the permissions policy forbids it', async () => {
      // Calling writeText() anyway would make Chrome log a
      // "[Violation] Permissions policy violation" that no catch can suppress.
      Object.defineProperty(document, 'featurePolicy', {
        writable: true,
        configurable: true,
        value: { allowsFeature: vi.fn(() => false) },
      });

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(mockWriteText).not.toHaveBeenCalled();
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(result.current.status).toBe('success');

      // @ts-expect-error - jsdom does not implement featurePolicy
      delete document.featurePolicy;
    });

    it('should use the clipboard API when the permissions policy permits it', async () => {
      Object.defineProperty(document, 'featurePolicy', {
        writable: true,
        configurable: true,
        value: { allowsFeature: vi.fn(() => true) },
      });
      mockWriteText.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('native text');
      });

      expect(mockWriteText).toHaveBeenCalledWith('native text');
      expect(execCommand).not.toHaveBeenCalled();
      expect(result.current.status).toBe('success');

      // @ts-expect-error - jsdom does not implement featurePolicy
      delete document.featurePolicy;
    });

    it('should still try the clipboard API when the policy check throws', async () => {
      Object.defineProperty(document, 'featurePolicy', {
        writable: true,
        configurable: true,
        value: {
          allowsFeature: vi.fn(() => {
            throw new Error('unknown feature');
          }),
        },
      });
      mockWriteText.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('native text');
      });

      expect(mockWriteText).toHaveBeenCalledWith('native text');
      expect(result.current.status).toBe('success');

      // @ts-expect-error - jsdom does not implement featurePolicy
      delete document.featurePolicy;
    });

    it('should return focus to the element that had it', async () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      expect(document.activeElement).toBe(input);

      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(document.activeElement).toBe(input);

      document.body.removeChild(input);
    });

    it('should still copy when there is no focusable active element', async () => {
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => null,
      });

      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(result.current.status).toBe('success');

      // @ts-expect-error - restore jsdom's own accessor
      delete document.activeElement;
    });

    it('should restore a pre-existing selection', async () => {
      const paragraph = document.createElement('p');
      paragraph.textContent = 'selected content';
      document.body.appendChild(paragraph);

      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('fallback text');
      });

      expect(document.getSelection()?.rangeCount).toBe(1);
      expect(
        document.getSelection()?.getRangeAt(0).commonAncestorContainer,
      ).toBe(paragraph);

      document.body.removeChild(paragraph);
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
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
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

  describe('reset timer lifecycle', () => {
    it('should not let an earlier copy clear a later copy indicator', async () => {
      mockWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useCopyToClipboard(500));

      await act(async () => {
        await result.current.copy('first');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.status).toBe('success');

      await act(async () => {
        await result.current.copy('second');
      });

      // The first copy's deadline lands here; it must not clear the second.
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.status).toBe('success');

      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.status).toBe('idle');
    });

    it('should clear the pending reset timer on unmount', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result, unmount } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      clearTimeoutSpy.mockClear();
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should decay the error status back to idle', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockWriteText.mockRejectedValueOnce(new Error('blocked'));
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });
      expect(result.current.status).toBe('error');

      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(result.current.status).toBe('idle');

      consoleSpy.mockRestore();
    });
  });

  describe('route params', () => {
    it('should copy even when useParams returns null', async () => {
      vi.mocked(useParams).mockReturnValueOnce(
        null as unknown as ReturnType<typeof useParams>,
      );
      mockWriteText.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCopyToClipboard());

      await act(async () => {
        await result.current.copy('test text');
      });

      expect(mockWriteText).toHaveBeenCalledWith('test text');
      expect(result.current.status).toBe('success');
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
