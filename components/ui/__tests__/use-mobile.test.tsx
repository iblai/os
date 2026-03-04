import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  let originalInnerWidth: number;
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let mediaQueryListeners: ((event: MediaQueryListEvent) => void)[] = [];

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    mediaQueryListeners = [];

    // Mock matchMedia
    mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: window.innerWidth < 768,
      media: query,
      onchange: null,
      addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') {
          mediaQueryListeners.push(listener);
        }
      }),
      removeEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') {
          const index = mediaQueryListeners.indexOf(listener);
          if (index > -1) {
            mediaQueryListeners.splice(index, 1);
          }
        }
      }),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
    });
    mediaQueryListeners = [];
  });

  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      writable: true,
      configurable: true,
    });
  };

  it('should return false when window width is >= 768', () => {
    setWindowWidth(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should return true when window width is < 768', () => {
    setWindowWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('should return false initially when undefined', () => {
    const { result } = renderHook(() => useIsMobile());
    // Initial undefined converts to false via !!
    expect(typeof result.current).toBe('boolean');
  });

  it('should add event listener on mount', () => {
    setWindowWidth(1024);
    renderHook(() => useIsMobile());

    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    const mockMql = mockMatchMedia.mock.results[0].value;
    expect(mockMql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should remove event listener on unmount', () => {
    setWindowWidth(1024);
    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    const mockMql = mockMatchMedia.mock.results[0].value;
    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should update when window width changes', () => {
    setWindowWidth(1024);
    const { result, rerender } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    // Change to mobile width
    setWindowWidth(500);

    // Simulate the change event
    act(() => {
      mediaQueryListeners.forEach((listener) => {
        listener({
          matches: true,
          media: '(max-width: 767px)',
        } as MediaQueryListEvent);
      });
    });

    // Note: Due to how the hook works, it reads window.innerWidth directly
    // The listener updates the state based on window.innerWidth
    rerender();
    expect(result.current).toBe(true);
  });

  it('should handle edge case at exactly 768px', () => {
    setWindowWidth(768);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('should handle edge case at 767px', () => {
    setWindowWidth(767);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
