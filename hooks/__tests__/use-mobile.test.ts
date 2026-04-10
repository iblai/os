import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useIsMobile } from '../use-mobile';

describe('use-mobile', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  describe('useIsMobile', () => {
    it('should return false for desktop width', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should return true for mobile width', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should return false for exactly 768px (breakpoint)', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should return true for 767px (just below breakpoint)', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 767,
      });

      const { result } = renderHook(() => useIsMobile());

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should add event listener to matchMedia', () => {
      const mockAddEventListener = vi.fn();
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
      })) as any;

      renderHook(() => useIsMobile());

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should remove event listener on unmount', () => {
      const mockRemoveEventListener = vi.fn();
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: mockRemoveEventListener,
      })) as any;

      const { unmount } = renderHook(() => useIsMobile());
      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should update when media query change event fires', async () => {
      let changeHandler: (() => void) | undefined;
      const mockAddEventListener = vi.fn(
        (event: string, handler: () => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
        },
      );

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024, // Start with desktop width
      });

      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
      })) as any;

      const { result } = renderHook(() => useIsMobile());

      // Initially should be false (desktop)
      await waitFor(() => {
        expect(result.current).toBe(false);
      });

      // Simulate window resize to mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      // Trigger the change handler inside act
      act(() => {
        if (changeHandler) {
          changeHandler();
        }
      });

      // Should now be true (mobile)
      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });
  });
});
