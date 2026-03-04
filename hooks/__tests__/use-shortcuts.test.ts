import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShortcuts } from '../use-shortcuts';

// Mock dependencies
const mockNavigateToHome = vi.fn();
const mockOpenMyMentorsModal = vi.fn();
const mockToggleSidebar = vi.fn();
const mockDispatch = vi.fn();

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToHome: mockNavigateToHome,
    openMyMentorsModal: mockOpenMyMentorsModal,
  }),
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({
    toggleSidebar: mockToggleSidebar,
  }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/features/navigation/slice', () => ({
  shortcutsModalUpdated: (value: boolean) => ({ type: 'SHORTCUTS_MODAL_UPDATED', payload: value }),
}));

describe('useShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shortcuts structure', () => {
    it('should return an object with all shortcuts', () => {
      const { result } = renderHook(() => useShortcuts());

      expect(result.current).toHaveProperty('startNewChat');
      expect(result.current).toHaveProperty('focusInput');
      expect(result.current).toHaveProperty('toggleSidebar');
      expect(result.current).toHaveProperty('openMyMentorsModal');
      expect(result.current).toHaveProperty('openShortcutsModal');
    });

    it('should have correct labels for all shortcuts', () => {
      const { result } = renderHook(() => useShortcuts());

      expect(result.current.startNewChat.label).toBe('Start New Chat');
      expect(result.current.focusInput.label).toBe('Focus Input');
      expect(result.current.toggleSidebar.label).toBe('Toggle Sidebar');
      expect(result.current.openMyMentorsModal.label).toBe('Open My Mentors');
      expect(result.current.openShortcutsModal.label).toBe('Open Shortcuts');
    });

    it('should have correct keys for all shortcuts', () => {
      const { result } = renderHook(() => useShortcuts());

      expect(result.current.startNewChat.keys).toBe('meta+shift+o');
      expect(result.current.focusInput.keys).toBe('shift+esc');
      expect(result.current.toggleSidebar.keys).toBe('meta+shift+s');
      expect(result.current.openMyMentorsModal.keys).toBe('meta+shift+e');
      expect(result.current.openShortcutsModal.keys).toBe('meta+y');
    });
  });

  describe('shortcut callbacks', () => {
    it('startNewChat should call navigateToHome', () => {
      const { result } = renderHook(() => useShortcuts());

      act(() => {
        result.current.startNewChat.callback();
      });

      expect(mockNavigateToHome).toHaveBeenCalledTimes(1);
    });

    it('toggleSidebar should call toggleSidebar', () => {
      const { result } = renderHook(() => useShortcuts());

      act(() => {
        result.current.toggleSidebar.callback();
      });

      expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('openMyMentorsModal should call openMyMentorsModal', () => {
      const { result } = renderHook(() => useShortcuts());

      act(() => {
        result.current.openMyMentorsModal.callback();
      });

      expect(mockOpenMyMentorsModal).toHaveBeenCalledTimes(1);
    });

    it('openShortcutsModal should dispatch shortcutsModalUpdated action', () => {
      const { result } = renderHook(() => useShortcuts());

      act(() => {
        result.current.openShortcutsModal.callback();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SHORTCUTS_MODAL_UPDATED',
        payload: true,
      });
    });
  });

  describe('focusInput callback', () => {
    afterEach(() => {
      // Clean up any created elements
      const textarea = document.querySelector('textarea[placeholder="Ask anything"]');
      if (textarea) {
        textarea.remove();
      }
    });

    it('should focus textarea when it exists', () => {
      // Create a textarea element with the expected placeholder
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Ask anything';
      document.body.appendChild(textarea);

      const focusSpy = vi.spyOn(textarea, 'focus');

      const { result } = renderHook(() => useShortcuts());

      act(() => {
        result.current.focusInput.callback();
      });

      expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('should not throw when textarea does not exist', () => {
      const { result } = renderHook(() => useShortcuts());

      // Should not throw when textarea is not found
      expect(() => {
        act(() => {
          result.current.focusInput.callback();
        });
      }).not.toThrow();
    });
  });
});
