import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render } from '@testing-library/react';
import { useEventCallback } from '../use-event-callback';

describe('useEventCallback', () => {
  describe('basic functionality', () => {
    it('should return a callable function', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useEventCallback(callback));

      expect(typeof result.current).toBe('function');
    });

    it('should call the provided callback when invoked', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useEventCallback(callback));

      act(() => {
        result.current();
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the callback', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useEventCallback(callback));

      act(() => {
        result.current('arg1', 'arg2', 123);
      });

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should return the value from the callback', () => {
      const callback = vi.fn().mockReturnValue('return value');
      const { result } = renderHook(() => useEventCallback(callback));

      let returnValue: string | undefined;
      act(() => {
        returnValue = result.current();
      });

      expect(returnValue).toBe('return value');
    });
  });

  describe('reference stability', () => {
    it('should maintain stable function reference across re-renders', () => {
      const callback = vi.fn();
      const { result, rerender } = renderHook(() => useEventCallback(callback));

      const firstRef = result.current;
      rerender();
      const secondRef = result.current;

      expect(firstRef).toBe(secondRef);
    });

    it('should maintain stable reference even when callback changes', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const { result, rerender } = renderHook(({ cb }) => useEventCallback(cb), {
        initialProps: { cb: callback1 },
      });

      const firstRef = result.current;
      rerender({ cb: callback2 });
      const secondRef = result.current;

      expect(firstRef).toBe(secondRef);
    });
  });

  describe('callback update behavior', () => {
    it('should use the latest callback after update', () => {
      const callback1 = vi.fn().mockReturnValue('first');
      const callback2 = vi.fn().mockReturnValue('second');
      const { result, rerender } = renderHook(({ cb }) => useEventCallback(cb), {
        initialProps: { cb: callback1 },
      });

      rerender({ cb: callback2 });

      let returnValue: string | undefined;
      act(() => {
        returnValue = result.current();
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(returnValue).toBe('second');
    });

    it('should handle multiple callback updates', () => {
      const callback1 = vi.fn().mockReturnValue(1);
      const callback2 = vi.fn().mockReturnValue(2);
      const callback3 = vi.fn().mockReturnValue(3);
      const { result, rerender } = renderHook(({ cb }) => useEventCallback(cb), {
        initialProps: { cb: callback1 },
      });

      rerender({ cb: callback2 });
      rerender({ cb: callback3 });

      let returnValue: number | undefined;
      act(() => {
        returnValue = result.current();
      });

      expect(callback3).toHaveBeenCalledTimes(1);
      expect(returnValue).toBe(3);
    });
  });

  describe('undefined callback handling', () => {
    it('should return a function even when undefined callback is provided', () => {
      // The hook always returns a stable function reference that safely handles undefined
      const { result } = renderHook(() => useEventCallback(undefined));

      // The returned function wrapper always exists for reference stability
      expect(typeof result.current).toBe('function');
    });

    it('should safely handle calling when callback is undefined', () => {
      const { result } = renderHook(() => useEventCallback(undefined));

      // Calling should not throw - it gracefully handles undefined via optional chaining
      act(() => {
        const returnValue = result.current?.();
        expect(returnValue).toBeUndefined();
      });
    });

    it('should handle transition from defined to undefined callback', () => {
      const callback = vi.fn();
      const { result, rerender } = renderHook(({ cb }) => useEventCallback(cb), {
        initialProps: { cb: callback as ((...args: unknown[]) => unknown) | undefined },
      });

      expect(result.current).toBeDefined();

      rerender({ cb: undefined });

      // The function reference remains stable but calling it should be safe
      expect(typeof result.current).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle callbacks with complex return types', () => {
      const complexReturn = { nested: { value: [1, 2, 3] } };
      const callback = vi.fn().mockReturnValue(complexReturn);
      const { result } = renderHook(() => useEventCallback(callback));

      let returnValue: typeof complexReturn | undefined;
      act(() => {
        returnValue = result.current();
      });

      expect(returnValue).toEqual(complexReturn);
    });

    it('should handle async callbacks', async () => {
      const asyncCallback = vi.fn().mockResolvedValue('async result');
      const { result } = renderHook(() => useEventCallback(asyncCallback));

      let returnValue: Promise<string> | undefined;
      act(() => {
        returnValue = result.current();
      });

      expect(asyncCallback).toHaveBeenCalledTimes(1);
      await expect(returnValue).resolves.toBe('async result');
    });

    it('should handle callbacks that throw errors', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const { result } = renderHook(() => useEventCallback(errorCallback));

      expect(() => {
        act(() => {
          result.current();
        });
      }).toThrow('Test error');
    });

    it('should handle callbacks with many arguments', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useEventCallback(callback));

      act(() => {
        result.current(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
      });

      expect(callback).toHaveBeenCalledWith(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    });

    it('should handle callbacks with typed arguments', () => {
      const callback = vi.fn((a: string, b: number) => `${a}-${b}`);
      const { result } = renderHook(() => useEventCallback(callback));

      let returnValue: string | undefined;
      act(() => {
        returnValue = result.current('test', 42);
      });

      expect(returnValue).toBe('test-42');
    });
  });

  describe('concurrent usage', () => {
    it('should work correctly when multiple hooks use different callbacks', () => {
      const callback1 = vi.fn().mockReturnValue('hook1');
      const callback2 = vi.fn().mockReturnValue('hook2');

      const { result: result1 } = renderHook(() => useEventCallback(callback1));
      const { result: result2 } = renderHook(() => useEventCallback(callback2));

      let returnValue1: string | undefined;
      let returnValue2: string | undefined;

      act(() => {
        returnValue1 = result1.current();
        returnValue2 = result2.current();
      });

      expect(returnValue1).toBe('hook1');
      expect(returnValue2).toBe('hook2');
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('render phase protection', () => {
    it('should have initial ref that throws error to prevent calling during render', () => {
      // This tests the safety mechanism - the initial ref value throws an error
      // if someone tries to call the callback during the render phase
      // before useLayoutEffect has a chance to set the actual callback
      //
      // Note: In normal usage through renderHook, the layout effect runs
      // before we can access the callback, so this is just documenting
      // the safety mechanism exists
      const callback = vi.fn();
      const { result } = renderHook(() => useEventCallback(callback));

      // After render is complete and effects have run, calling should work
      act(() => {
        result.current();
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should throw error when callback is called during render phase', () => {
      // This component calls the event callback during render, before
      // useLayoutEffect has a chance to set the actual callback
      let thrownError: Error | null = null;

      function TestComponent(): React.ReactElement | null {
        const eventCallback = useEventCallback(() => 'test');
        // Calling the callback during render (before layout effect runs)
        // should trigger the error
        try {
          eventCallback();
        } catch (e) {
          thrownError = e as Error;
        }
        return null;
      }

      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // The render should complete but the error should have been caught
      render(React.createElement(TestComponent));

      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toBe('Cannot call an event handler while rendering.');

      consoleSpy.mockRestore();
    });
  });
});
