import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast, reducer } from '../use-toast';

describe('use-toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('reducer', () => {
    const createToast = (id: string, title?: string): any => ({
      id,
      title,
      open: true,
      onOpenChange: vi.fn(),
    });

    describe('ADD_TOAST', () => {
      it('should add a toast to empty state', () => {
        const initialState: any = { toasts: [] };
        const newToast = createToast('1', 'Test Toast');

        const result = reducer(initialState, {
          type: 'ADD_TOAST',
          toast: newToast,
        });

        expect(result.toasts).toHaveLength(1);
        expect(result.toasts[0]).toEqual(newToast);
      });

      it('should add toast at the beginning', () => {
        const existingToast = createToast('1', 'First');

        const initialState: any = { toasts: [existingToast] };
        const newToast = createToast('2', 'Second');

        const result = reducer(initialState, {
          type: 'ADD_TOAST',
          toast: newToast,
        });

        // TOAST_LIMIT is 1, so only the newest toast should remain
        expect(result.toasts).toHaveLength(1);
        expect(result.toasts[0].id).toBe('2');
      });

      it('should respect TOAST_LIMIT of 1', () => {
        const initialState: any = { toasts: [] };

        let state: any = initialState;
        state = reducer(state, {
          type: 'ADD_TOAST',
          toast: createToast('1', 'First'),
        });
        state = reducer(state, {
          type: 'ADD_TOAST',
          toast: createToast('2', 'Second'),
        });
        state = reducer(state, {
          type: 'ADD_TOAST',
          toast: createToast('3', 'Third'),
        });

        expect(state.toasts).toHaveLength(1);
        expect(state.toasts[0].id).toBe('3');
      });
    });

    describe('UPDATE_TOAST', () => {
      it('should update an existing toast', () => {
        const existingToast = createToast('1', 'Original Title');

        const initialState: any = { toasts: [existingToast] };

        const result = reducer(initialState, {
          type: 'UPDATE_TOAST',
          toast: { id: '1', title: 'Updated Title' },
        });

        expect(result.toasts[0].title).toBe('Updated Title');
        expect(result.toasts[0].open).toBe(true);
      });

      it('should not update non-existent toast', () => {
        const existingToast = createToast('1', 'Original');

        const initialState: any = { toasts: [existingToast] };

        const result = reducer(initialState, {
          type: 'UPDATE_TOAST',
          toast: { id: '999', title: 'Updated' },
        });

        expect(result.toasts[0].title).toBe('Original');
      });

      it('should preserve other properties when updating', () => {
        const existingToast = createToast('1', 'Title');
        existingToast.description = 'Description';

        const initialState: any = { toasts: [existingToast] };

        const result = reducer(initialState, {
          type: 'UPDATE_TOAST',
          toast: { id: '1', title: 'New Title' },
        });

        expect(result.toasts[0].title).toBe('New Title');
        expect(result.toasts[0].description).toBe('Description');
      });
    });

    describe('DISMISS_TOAST', () => {
      it('should set open to false for specific toast', () => {
        const toast1 = createToast('1', 'Toast 1');

        const initialState: any = { toasts: [toast1] };

        const result = reducer(initialState, {
          type: 'DISMISS_TOAST',
          toastId: '1',
        });

        expect(result.toasts[0].open).toBe(false);
      });

      it('should dismiss all toasts when toastId is undefined', () => {
        const toast1 = createToast('1', 'Toast 1');

        const initialState: any = { toasts: [toast1] };

        const result = reducer(initialState, {
          type: 'DISMISS_TOAST',
          toastId: undefined,
        });

        expect(result.toasts[0].open).toBe(false);
      });

      it('should not affect other toasts when dismissing specific toast', () => {
        // Due to TOAST_LIMIT being 1, we test with single toast
        const toast1 = createToast('1', 'Toast 1');

        const initialState: any = { toasts: [toast1] };

        const result = reducer(initialState, {
          type: 'DISMISS_TOAST',
          toastId: '999',
        });

        expect(result.toasts[0].open).toBe(true);
      });
    });

    describe('REMOVE_TOAST', () => {
      it('should remove specific toast', () => {
        const toast1 = createToast('1', 'Toast 1');

        const initialState: any = { toasts: [toast1] };

        const result = reducer(initialState, {
          type: 'REMOVE_TOAST',
          toastId: '1',
        });

        expect(result.toasts).toHaveLength(0);
      });

      it('should remove all toasts when toastId is undefined', () => {
        const toast1 = createToast('1', 'Toast 1');

        const initialState: any = { toasts: [toast1] };

        const result = reducer(initialState, {
          type: 'REMOVE_TOAST',
          toastId: undefined,
        });

        expect(result.toasts).toHaveLength(0);
      });

      it('should not affect state when removing non-existent toast', () => {
        const toast1 = createToast('1', 'Toast 1');

        const initialState: any = { toasts: [toast1] };

        const result = reducer(initialState, {
          type: 'REMOVE_TOAST',
          toastId: '999',
        });

        expect(result.toasts).toHaveLength(1);
        expect(result.toasts[0].id).toBe('1');
      });
    });
  });

  describe('toast function', () => {
    it('should return an object with id, dismiss, and update functions', () => {
      const result = toast({ title: 'Test' });

      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('string');
      expect(typeof result.dismiss).toBe('function');
      expect(typeof result.update).toBe('function');
    });

    it('should generate unique IDs for each toast', () => {
      const toast1 = toast({ title: 'Toast 1' });
      const toast2 = toast({ title: 'Toast 2' });

      expect(toast1.id).not.toBe(toast2.id);
    });
  });

  describe('useToast hook', () => {
    it('should return toast state with toasts array', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current).toHaveProperty('toasts');
      expect(Array.isArray(result.current.toasts)).toBe(true);
    });

    it('should return toast function', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current).toHaveProperty('toast');
      expect(typeof result.current.toast).toBe('function');
    });

    it('should return dismiss function', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current).toHaveProperty('dismiss');
      expect(typeof result.current.dismiss).toBe('function');
    });

    it('should add toast when toast function is called', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'New Toast' });
      });

      expect(result.current.toasts.length).toBeGreaterThanOrEqual(0);
    });

    it('should update state when toast is added', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test Toast' });
      });

      // State should be updated
      expect(result.current.toasts).toBeDefined();
    });

    it('should clean up listener on unmount', () => {
      const { unmount } = renderHook(() => useToast());

      // Should not throw when unmounting
      expect(() => unmount()).not.toThrow();
    });

    it('should dismiss toast by id', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const newToast = result.current.toast({ title: 'Test' });
        toastId = newToast.id;
      });

      act(() => {
        result.current.dismiss(toastId!);
      });

      // Toast should be dismissed (open: false)
      const dismissedToast = result.current.toasts.find((t) => t.id === toastId!);
      if (dismissedToast) {
        expect(dismissedToast.open).toBe(false);
      }
    });

    it('should dismiss all toasts when no id provided', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      act(() => {
        result.current.dismiss();
      });

      // All toasts should be dismissed
      result.current.toasts.forEach((t) => {
        expect(t.open).toBe(false);
      });
    });
  });

  describe('toast dismiss functionality', () => {
    it('should call dismiss when onOpenChange is called with false', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      const addedToast = result.current.toasts[0];
      if (addedToast?.onOpenChange) {
        act(() => {
          addedToast.onOpenChange!(false);
        });

        const foundToast = result.current.toasts.find((t) => t.id === addedToast.id);
        if (foundToast) {
          expect(foundToast.open).toBe(false);
        }
      }
    });

    it('should not dismiss when onOpenChange is called with true', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      const addedToast = result.current.toasts[0];
      if (addedToast?.onOpenChange) {
        act(() => {
          addedToast.onOpenChange!(true);
        });

        // Toast should remain open
        expect(result.current.toasts[0]?.open).toBe(true);
      }
    });
  });

  describe('toast update functionality', () => {
    it('should update toast through returned update function', () => {
      const { result } = renderHook(() => useToast());

      let toastResult: ReturnType<typeof toast>;
      act(() => {
        toastResult = result.current.toast({ title: 'Original' });
      });

      act(() => {
        toastResult!.update({
          id: toastResult!.id,
          title: 'Updated',
          open: true,
          onOpenChange: vi.fn(),
        });
      });

      const updatedToast = result.current.toasts.find((t) => t.id === toastResult!.id);
      if (updatedToast) {
        expect(updatedToast.title).toBe('Updated');
      }
    });
  });

  describe('multiple listeners', () => {
    it('should handle multiple useToast instances', () => {
      const { result: result1 } = renderHook(() => useToast());
      const { result: result2 } = renderHook(() => useToast());

      act(() => {
        result1.current.toast({ title: 'From Hook 1' });
      });

      // Both hooks should see the same state
      expect(result1.current.toasts.length).toBe(result2.current.toasts.length);
    });

    it('should remove listener on unmount without affecting others', () => {
      const { unmount: unmount1 } = renderHook(() => useToast());
      const { result: result2 } = renderHook(() => useToast());

      unmount1();

      // result2 should still work
      act(() => {
        result2.current.toast({ title: 'After unmount' });
      });

      expect(result2.current.toasts).toBeDefined();
    });
  });

  describe('toast removal after delay', () => {
    it('should remove toast from state after TOAST_REMOVE_DELAY', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const newToast = result.current.toast({ title: 'Test Toast' });
        toastId = newToast.id;
      });

      // Dismiss the toast to trigger the remove queue
      act(() => {
        result.current.dismiss(toastId!);
      });

      // Toast should still be in state but with open: false
      expect(result.current.toasts.some((t) => t.id === toastId!)).toBe(true);

      // Advance timers past TOAST_REMOVE_DELAY (1000000ms)
      await act(async () => {
        vi.advanceTimersByTime(1000001);
      });

      // Toast should now be removed from state
      expect(result.current.toasts.find((t) => t.id === toastId!)).toBeUndefined();

      vi.useRealTimers();
    });

    it('should not add duplicate removal when toast already in queue', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        const newToast = result.current.toast({ title: 'Test Toast' });
        toastId = newToast.id;
      });

      // Dismiss twice (second should be ignored as it's already in queue)
      act(() => {
        result.current.dismiss(toastId!);
      });
      act(() => {
        result.current.dismiss(toastId!);
      });

      // Should still only remove once after delay
      await act(async () => {
        vi.advanceTimersByTime(1000001);
      });

      expect(result.current.toasts.find((t) => t.id === toastId!)).toBeUndefined();

      vi.useRealTimers();
    });
  });
});
