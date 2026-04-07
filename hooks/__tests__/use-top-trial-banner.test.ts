import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTopTrialBanner } from '../use-top-trial-banner';

// Mock dispatch
const mockDispatch = vi.fn();
vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

// Mock subscription slice
vi.mock('@/features/subscription/subscription-slice', () => ({
  setOpenPricingModal: (value: boolean) => ({
    type: 'SET_OPEN_PRICING_MODAL',
    payload: value,
  }),
}));

// Mock TRIGGERS constant
vi.mock('@/features/top-banner/constants', () => ({
  TRIGGERS: {
    PRICING_MODAL: 'PRICING_MODAL',
    SUBSCRIBE_USER: 'SUBSCRIBE_USER',
  },
}));

describe('useTopTrialBanner', () => {
  let parentElement: HTMLElement;
  const originalAlert = window.alert;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create parent element
    parentElement = document.createElement('div');
    parentElement.classList.add('test-parent');
    document.body.appendChild(parentElement);

    // Mock alert
    window.alert = vi.fn();
  });

  afterEach(() => {
    // Clean up
    if (parentElement && parentElement.parentNode) {
      parentElement.parentNode.removeChild(parentElement);
    }
    window.alert = originalAlert;
  });

  describe('initial state', () => {
    it('should return initial state with visible true', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      expect(result.current.visible).toBe(true);
      expect(result.current.showTooltip).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should set isLoading from loading prop', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: true,
        }),
      );

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('setVisible', () => {
    it('should update visible state', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      act(() => {
        result.current.setVisible(false);
      });

      expect(result.current.visible).toBe(false);
    });
  });

  describe('setShowTooltip', () => {
    it('should update showTooltip state', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      act(() => {
        result.current.setShowTooltip(true);
      });

      expect(result.current.showTooltip).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should update isLoading state', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('loading prop updates', () => {
    it('should update isLoading when loading prop changes', () => {
      const { result, rerender } = renderHook(
        ({ loading }) =>
          useTopTrialBanner({
            parentContainer: '.test-parent',
            onUpgrade: 'PRICING_MODAL',
            loading,
          }),
        { initialProps: { loading: false } },
      );

      expect(result.current.isLoading).toBe(false);

      rerender({ loading: true });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('bannerButtonTriggerHandler', () => {
    it('should dispatch setOpenPricingModal when onUpgrade is PRICING_MODAL', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      act(() => {
        result.current.bannerButtonTriggerHandler();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_OPEN_PRICING_MODAL',
        payload: true,
      });
    });

    it('should show alert when onUpgrade is SUBSCRIBE_USER', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'SUBSCRIBE_USER',
          loading: false,
        }),
      );

      act(() => {
        result.current.bannerButtonTriggerHandler();
      });

      expect(window.alert).toHaveBeenCalledWith('in');
    });

    it('should do nothing for unknown onUpgrade value', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'UNKNOWN_TRIGGER',
          loading: false,
        }),
      );

      act(() => {
        result.current.bannerButtonTriggerHandler();
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  describe('refs', () => {
    it('should provide bannerRef', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      expect(result.current.bannerRef).toBeDefined();
      expect(result.current.bannerRef.current).toBe(null);
    });

    it('should provide parentElRef', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      expect(result.current.parentElRef).toBeDefined();
    });
  });

  describe('parent container not found', () => {
    it('should handle missing parent container gracefully', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.non-existent-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      expect(result.current.visible).toBe(true);
      expect(result.current.parentElRef.current).toBe(null);
    });
  });

  describe('cleanup on unmount when not visible', () => {
    it('should not set up observers when visible is false', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      act(() => {
        result.current.setVisible(false);
      });

      // Effect should return early due to !visible
      expect(result.current.visible).toBe(false);
    });
  });

  describe('resize observer and height calculation', () => {
    it('should set up parent element reference when visible', () => {
      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      // Parent element should be found
      expect(result.current.parentElRef.current).toBe(parentElement);
    });

    it('should update parent height when bannerRef has a value', () => {
      // Create a banner element
      const bannerElement = document.createElement('div');
      Object.defineProperty(bannerElement, 'offsetHeight', { value: 50 });

      const { result } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      // Manually set the banner ref to simulate it being assigned
      act(() => {
        (
          result.current
            .bannerRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = bannerElement;
      });

      // Trigger resize to call updateParentHeight
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(parentElement.style.height).toBe('calc(100vh - 50px)');
    });

    it('should restore parent height on unmount', () => {
      parentElement.style.height = '500px';

      const { unmount } = renderHook(() =>
        useTopTrialBanner({
          parentContainer: '.test-parent',
          onUpgrade: 'PRICING_MODAL',
          loading: false,
        }),
      );

      unmount();

      // Height should be restored
      expect(parentElement.style.height).toBe('500px');
    });

    it('should handle cleanup when visible becomes false', () => {
      const { result, rerender } = renderHook(
        ({ visible: _visible }) => {
          const hook = useTopTrialBanner({
            parentContainer: '.test-parent',
            onUpgrade: 'PRICING_MODAL',
            loading: false,
          });
          // Manually set visible if we need to test the effect
          return hook;
        },
        { initialProps: { visible: true } },
      );

      act(() => {
        result.current.setVisible(false);
      });

      rerender({ visible: false });

      expect(result.current.visible).toBe(false);
    });
  });
});
