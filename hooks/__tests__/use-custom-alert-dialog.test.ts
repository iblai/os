import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomAlertDialog } from '../use-custom-alert-dialog';

// Mock dispatch
const mockDispatch = vi.fn();
vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

// Mock navigation slice
vi.mock('@/features/navigation/slice', () => ({
  initCustomAlertDialog: (payload: Record<string, unknown>) => ({
    type: 'INIT_CUSTOM_ALERT_DIALOG',
    payload,
  }),
}));

// Mock user slice
vi.mock('@/features/users/slice', () => ({
  userSliceActions: {
    setIsInstructorMode: (value: boolean) => ({
      type: 'SET_IS_INSTRUCTOR_MODE',
      payload: value,
    }),
  },
}));

// Mock useAppSelector
const mockIsInstructorMode = vi.fn();
vi.mock('@/lib/hooks', () => ({
  useAppSelector: (selector: (state: { user: { isInstructorMode: boolean } }) => boolean) => {
    const mockState = { user: { isInstructorMode: mockIsInstructorMode() } };
    return selector(mockState);
  },
}));

// Mock useNavigate
const mockNavigateToHome = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    navigateToHome: mockNavigateToHome,
  }),
}));

describe('useCustomAlertDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInstructorMode.mockReturnValue(false);
  });

  describe('openCustomAlertDialog', () => {
    it('should dispatch initCustomAlertDialog with correct payload', () => {
      const { result } = renderHook(() => useCustomAlertDialog());

      act(() => {
        result.current.openCustomAlertDialog(
          'Test message',
          'TEST_VALIDATE',
          'Test Title',
          'TEST_CANCEL',
        );
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INIT_CUSTOM_ALERT_DIALOG',
        payload: {
          message: 'Test message',
          validateTrigger: 'TEST_VALIDATE',
          cancelTrigger: 'TEST_CANCEL',
          title: 'Test Title',
          isOpen: true,
        },
      });
    });

    it('should handle undefined cancelTrigger', () => {
      const { result } = renderHook(() => useCustomAlertDialog());

      act(() => {
        result.current.openCustomAlertDialog('Test message', 'TEST_VALIDATE', 'Test Title');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INIT_CUSTOM_ALERT_DIALOG',
        payload: {
          message: 'Test message',
          validateTrigger: 'TEST_VALIDATE',
          cancelTrigger: undefined,
          title: 'Test Title',
          isOpen: true,
        },
      });
    });
  });

  describe('closeCustomAlertDialog', () => {
    it('should dispatch initCustomAlertDialog with empty payload', () => {
      const { result } = renderHook(() => useCustomAlertDialog());

      act(() => {
        result.current.closeCustomAlertDialog();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INIT_CUSTOM_ALERT_DIALOG',
        payload: {
          message: '',
          validateTrigger: '',
          cancelTrigger: '',
          title: '',
          isOpen: false,
        },
      });
    });
  });

  describe('triggerHandler', () => {
    it('should handle SWITCH_TO_LEARNER trigger when in instructor mode', () => {
      mockIsInstructorMode.mockReturnValue(true);

      const { result } = renderHook(() => useCustomAlertDialog());

      act(() => {
        result.current.triggerHandler('SWITCH_TO_LEARNER');
      });

      // Should toggle instructor mode (true -> false)
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_IS_INSTRUCTOR_MODE',
        payload: false,
      });

      // Should close dialog
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INIT_CUSTOM_ALERT_DIALOG',
        payload: expect.objectContaining({ isOpen: false }),
      });

      // Should navigate home
      expect(mockNavigateToHome).toHaveBeenCalled();
    });

    it('should handle SWITCH_TO_LEARNER trigger when in learner mode', () => {
      mockIsInstructorMode.mockReturnValue(false);

      const { result } = renderHook(() => useCustomAlertDialog());

      act(() => {
        result.current.triggerHandler('SWITCH_TO_LEARNER');
      });

      // Should toggle instructor mode (false -> true)
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_IS_INSTRUCTOR_MODE',
        payload: true,
      });
    });

    it('should close dialog for unknown triggers', () => {
      const { result } = renderHook(() => useCustomAlertDialog());

      act(() => {
        result.current.triggerHandler('UNKNOWN_TRIGGER');
      });

      // Should only close dialog
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INIT_CUSTOM_ALERT_DIALOG',
        payload: expect.objectContaining({ isOpen: false }),
      });

      // Should not dispatch instructor mode
      expect(mockDispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SET_IS_INSTRUCTOR_MODE' }),
      );

      // Should not navigate
      expect(mockNavigateToHome).not.toHaveBeenCalled();
    });

    it('should close dialog for empty trigger', () => {
      const { result } = renderHook(() => useCustomAlertDialog());

      act(() => {
        result.current.triggerHandler('');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'INIT_CUSTOM_ALERT_DIALOG',
        payload: expect.objectContaining({ isOpen: false }),
      });
    });
  });

  describe('hook return values', () => {
    it('should return all expected functions', () => {
      const { result } = renderHook(() => useCustomAlertDialog());

      expect(result.current).toHaveProperty('openCustomAlertDialog');
      expect(result.current).toHaveProperty('closeCustomAlertDialog');
      expect(result.current).toHaveProperty('triggerHandler');
      expect(typeof result.current.openCustomAlertDialog).toBe('function');
      expect(typeof result.current.closeCustomAlertDialog).toBe('function');
      expect(typeof result.current.triggerHandler).toBe('function');
    });
  });
});
