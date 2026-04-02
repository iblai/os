import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { useRef } from 'react';
import { useResponsive } from '../use-responsive';

describe('useResponsive', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe('without container ref', () => {
    it('should detect small screen (< 640px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('sm');
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isLaptop).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should detect medium screen (640-899px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 700,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('md');
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isLaptop).toBe(false);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should detect large screen (900-1199px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1000,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('lg');
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isLaptop).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('should detect extra large screen (>= 1200px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('xl');
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isLaptop).toBe(false);
      expect(result.current.isDesktop).toBe(true);
    });

    it('should return containerWidth equal to window.innerWidth', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.containerWidth).toBe(1024);
    });
  });

  describe('with container ref', () => {
    it('should use container width instead of window width', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400,
      });

      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ width: 500 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        return useResponsive(ref);
      });

      expect(result.current.containerWidth).toBe(500);
      expect(result.current.screenSize).toBe('sm');
      expect(result.current.isMobile).toBe(true);
    });

    it('should detect medium screen based on container width', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ width: 700 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        return useResponsive(ref);
      });

      expect(result.current.screenSize).toBe('md');
      expect(result.current.isTablet).toBe(true);
    });

    it('should detect large screen based on container width', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn().mockReturnValue({ width: 1000 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        return useResponsive(ref);
      });

      expect(result.current.screenSize).toBe('lg');
      expect(result.current.isLaptop).toBe(true);
    });

    it('should handle null container ref', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(
          null,
        ) as React.RefObject<HTMLElement>;
        return useResponsive(ref);
      });

      // Falls back to window.innerWidth when ref.current is null
      expect(result.current.containerWidth).toBe(1024);
    });
  });

  describe('resize handling', () => {
    it('should add resize event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useResponsive());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function),
      );
      addEventListenerSpy.mockRestore();
    });

    it('should remove resize event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useResponsive());
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function),
      );
      removeEventListenerSpy.mockRestore();
    });

    it('should update screenSize on window resize', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('xl');

      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 500,
        });
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.screenSize).toBe('sm');
    });
  });

  describe('breakpoint boundaries', () => {
    it('should return sm at exactly 639px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 639,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('sm');
    });

    it('should return md at exactly 640px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('md');
    });

    it('should return md at exactly 899px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 899,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('md');
    });

    it('should return lg at exactly 900px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 900,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('lg');
    });

    it('should return lg at exactly 1199px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1199,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('lg');
    });

    it('should return xl at exactly 1200px', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      const { result } = renderHook(() => useResponsive());

      expect(result.current.screenSize).toBe('xl');
    });
  });
});
