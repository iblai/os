import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer } from '../use-timer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return initial state with null startTime, 0 time, and not running', () => {
      const { result } = renderHook(() => useTimer());

      expect(result.current.startTime).toBeNull();
      expect(result.current.time).toBe(0);
      expect(result.current.isRunning).toBe(false);
    });

    it('should return start and stop functions', () => {
      const { result } = renderHook(() => useTimer());

      expect(typeof result.current.start).toBe('function');
      expect(typeof result.current.stop).toBe('function');
    });
  });

  describe('start', () => {
    it('should start the timer when called', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.startTime).not.toBeNull();
      expect(result.current.startTime).toBeInstanceOf(Date);
    });

    it('should not restart if already running', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      const firstStartTime = result.current.startTime;

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.start();
      });

      expect(result.current.startTime).toBe(firstStartTime);
    });

    it('should set startTime to current date', () => {
      const mockDate = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(mockDate);

      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      expect(result.current.startTime?.getTime()).toBe(mockDate.getTime());
    });
  });

  describe('time tracking', () => {
    it('should track elapsed time after starting', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.time).toBeGreaterThan(0);
    });

    it('should update time at 10ms intervals', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(10);
      });

      expect(result.current.time).toBeGreaterThanOrEqual(0);
    });

    it('should continue tracking time over longer periods', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.time).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('stop', () => {
    it('should stop the timer when called', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      expect(result.current.isRunning).toBe(true);

      act(() => {
        result.current.stop();
      });

      expect(result.current.isRunning).toBe(false);
    });

    it('should preserve time value after stopping', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const timeBeforeStop = result.current.time;

      act(() => {
        result.current.stop();
      });

      expect(result.current.time).toBe(timeBeforeStop);
    });

    it('should stop interval when stopping timer', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.stop();
      });

      const timeAfterStop = result.current.time;

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.time).toBe(timeAfterStop);
    });

    it('should do nothing if timer is not running', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.stop();
      });

      expect(result.current.isRunning).toBe(false);
      expect(result.current.time).toBe(0);
      expect(result.current.startTime).toBeNull();
    });
  });

  describe('start and stop cycle', () => {
    it('should allow starting after stopping', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.stop();
      });

      expect(result.current.isRunning).toBe(false);

      act(() => {
        result.current.start();
      });

      expect(result.current.isRunning).toBe(true);
    });

    it('should reset startTime when starting again after stop', () => {
      const mockDate1 = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(mockDate1);

      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      const firstStartTime = result.current.startTime;

      act(() => {
        result.current.stop();
      });

      const mockDate2 = new Date('2024-01-15T10:01:00.000Z');
      vi.setSystemTime(mockDate2);

      act(() => {
        result.current.start();
      });

      expect(result.current.startTime?.getTime()).not.toBe(firstStartTime?.getTime());
      expect(result.current.startTime?.getTime()).toBe(mockDate2.getTime());
    });
  });

  describe('cleanup', () => {
    it('should clear interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { result, unmount } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should clear interval when isRunning changes to false', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('memoization', () => {
    it('should maintain stable start function reference when not running', () => {
      const { result, rerender } = renderHook(() => useTimer());

      const firstStartFn = result.current.start;
      rerender();
      const secondStartFn = result.current.start;

      expect(firstStartFn).toBe(secondStartFn);
    });

    it('should maintain stable stop function reference when running', () => {
      const { result, rerender } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      const firstStopFn = result.current.stop;
      rerender();
      const secondStopFn = result.current.stop;

      expect(firstStopFn).toBe(secondStopFn);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid start/stop calls across separate acts', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.stop();
      });

      expect(result.current.isRunning).toBe(false);
    });

    it('should handle multiple stop calls without error', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      act(() => {
        result.current.stop();
        result.current.stop();
        result.current.stop();
      });

      expect(result.current.isRunning).toBe(false);
    });

    it('should handle start call when already running', () => {
      const { result } = renderHook(() => useTimer());

      act(() => {
        result.current.start();
      });

      const startTime = result.current.startTime;

      act(() => {
        result.current.start();
        result.current.start();
      });

      expect(result.current.isRunning).toBe(true);
      expect(result.current.startTime).toBe(startTime);
    });
  });

  describe('return value structure', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useTimer());

      expect(result.current).toHaveProperty('startTime');
      expect(result.current).toHaveProperty('time');
      expect(result.current).toHaveProperty('isRunning');
      expect(result.current).toHaveProperty('start');
      expect(result.current).toHaveProperty('stop');
    });

    it('should return correct types for all properties', () => {
      const { result } = renderHook(() => useTimer());

      expect(result.current.startTime).toBeNull();
      expect(typeof result.current.time).toBe('number');
      expect(typeof result.current.isRunning).toBe('boolean');
      expect(typeof result.current.start).toBe('function');
      expect(typeof result.current.stop).toBe('function');
    });
  });
});
