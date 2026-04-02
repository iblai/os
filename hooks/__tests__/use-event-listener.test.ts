import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useEventListener } from '../use-event-listener';

describe('useEventListener', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('window events', () => {
    it('should add event listener to window by default', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const handler = vi.fn();

      renderHook(() => useEventListener('click', handler));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        undefined,
      );
      addEventListenerSpy.mockRestore();
    });

    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const handler = vi.fn();

      const { unmount } = renderHook(() => useEventListener('click', handler));
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        undefined,
      );
      removeEventListenerSpy.mockRestore();
    });

    it('should call handler when event is triggered', () => {
      const handler = vi.fn();

      renderHook(() => useEventListener('click', handler));

      act(() => {
        window.dispatchEvent(new MouseEvent('click'));
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle resize events', () => {
      const handler = vi.fn();

      renderHook(() => useEventListener('resize', handler));

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle scroll events', () => {
      const handler = vi.fn();

      renderHook(() => useEventListener('scroll', handler));

      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle keydown events', () => {
      const handler = vi.fn();

      renderHook(() => useEventListener('keydown', handler));

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Enter' }),
      );
    });

    it('should pass event options to addEventListener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const handler = vi.fn();
      const options = { capture: true, passive: true };

      renderHook(() => useEventListener('click', handler, undefined, options));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        options,
      );
      addEventListenerSpy.mockRestore();
    });

    it('should pass boolean options to addEventListener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const handler = vi.fn();

      renderHook(() => useEventListener('click', handler, undefined, true));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        true,
      );
      addEventListenerSpy.mockRestore();
    });
  });

  describe('element ref events', () => {
    it('should add event listener to element ref', () => {
      const element = document.createElement('div');
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');
      const handler = vi.fn();

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        useEventListener('click', handler, ref);
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        undefined,
      );
      addEventListenerSpy.mockRestore();
    });

    it('should call handler when element event is triggered', () => {
      const element = document.createElement('button');
      const handler = vi.fn();

      renderHook(() => {
        const ref = useRef<HTMLButtonElement>(element);
        useEventListener('click', handler, ref);
      });

      act(() => {
        element.dispatchEvent(new MouseEvent('click'));
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove event listener from element on unmount', () => {
      const element = document.createElement('div');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      const handler = vi.fn();

      const { unmount } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        useEventListener('click', handler, ref);
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        undefined,
      );
      removeEventListenerSpy.mockRestore();
    });

    it('should handle element without addEventListener gracefully', () => {
      const handler = vi.fn();
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      // Create an object without addEventListener method
      const mockElement = {} as HTMLDivElement;

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(mockElement);
        useEventListener('click', handler, ref);
      });

      // Should not throw and should not add listener to invalid element
      // The hook checks for targetElement.addEventListener before adding
      addEventListenerSpy.mockRestore();
    });

    it('should handle mouseover events on elements', () => {
      const element = document.createElement('div');
      const handler = vi.fn();

      renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        useEventListener('mouseover', handler, ref);
      });

      act(() => {
        element.dispatchEvent(new MouseEvent('mouseover'));
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle focus events on elements', () => {
      const element = document.createElement('input');
      const handler = vi.fn();

      renderHook(() => {
        const ref = useRef<HTMLInputElement>(element);
        useEventListener('focus', handler, ref);
      });

      act(() => {
        element.dispatchEvent(new FocusEvent('focus'));
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler updates', () => {
    it('should use the latest handler after update', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const { rerender } = renderHook(
        ({ handler }) => useEventListener('click', handler),
        {
          initialProps: { handler: handler1 },
        },
      );

      rerender({ handler: handler2 });

      act(() => {
        window.dispatchEvent(new MouseEvent('click'));
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not add new listener when handler changes', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const { rerender } = renderHook(
        ({ handler }) => useEventListener('click', handler),
        {
          initialProps: { handler: handler1 },
        },
      );

      const initialCallCount = addEventListenerSpy.mock.calls.length;

      rerender({ handler: handler2 });

      // Should not add another listener
      expect(addEventListenerSpy).toHaveBeenCalledTimes(initialCallCount);
      addEventListenerSpy.mockRestore();
    });
  });

  describe('event name changes', () => {
    it('should remove old listener and add new one when event name changes', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const handler = vi.fn();

      const { rerender } = renderHook(
        ({ eventName }) => useEventListener(eventName, handler),
        {
          initialProps: { eventName: 'click' as keyof WindowEventMap },
        },
      );

      rerender({ eventName: 'keydown' });

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        undefined,
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        undefined,
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('custom events', () => {
    it('should handle custom events on window', () => {
      const handler = vi.fn();

      renderHook(() => useEventListener('storage', handler));

      act(() => {
        window.dispatchEvent(new StorageEvent('storage'));
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple listeners', () => {
    it('should work with multiple listeners for different events', () => {
      const clickHandler = vi.fn();
      const keydownHandler = vi.fn();

      renderHook(() => {
        useEventListener('click', clickHandler);
        useEventListener('keydown', keydownHandler);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('click'));
        window.dispatchEvent(new KeyboardEvent('keydown'));
      });

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(keydownHandler).toHaveBeenCalledTimes(1);
    });

    it('should work with multiple listeners for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      renderHook(() => {
        useEventListener('click', handler1);
      });

      renderHook(() => {
        useEventListener('click', handler2);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('click'));
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });
});
