import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { use402ErrorCheck } from '../use-402-error-check';
import subscriptionSlice from '@/features/subscription/subscription-slice';
import topBannerSlice from '@/features/top-banner/top-banner-slice';
import { appleRestrictionReducer } from '@iblai/iblai-js/web-utils';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock next/navigation
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({
    tenantKey: 'test-tenant',
    mentorId: 'test-mentor',
  })),
  useRouter: vi.fn(() => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn().mockReturnValue(null),
    toString: vi.fn().mockReturnValue(''),
  })),
  usePathname: vi.fn(() => '/platform/test-tenant/test-mentor'),
}));

// Mock useIsAdmin hook
let mockIsAdmin = false;
vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: vi.fn(() => mockIsAdmin),
}));

// Mock useOS hook (sourced from @iblai/iblai-js/web-utils alongside
// setOpenAppleRestrictionModal); use importOriginal so we keep the real
// action creator and reducer.
let mockIsAppleDevice = false;
vi.mock('@iblai/iblai-js/web-utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@iblai/iblai-js/web-utils')>();
  return {
    ...actual,
    useOS: vi.fn(() => ({ isAppleDevice: mockIsAppleDevice })),
  };
});

describe('use402ErrorCheck', () => {
  type TestState = {
    subscription: ReturnType<typeof subscriptionSlice.reducer>;
    topBanner: ReturnType<typeof topBannerSlice.reducer>;
    appleRestriction: ReturnType<typeof appleRestrictionReducer>;
  };

  let store: ReturnType<typeof configureStore<TestState>>;

  const createTestStore = () =>
    configureStore({
      reducer: {
        subscription: subscriptionSlice.reducer,
        topBanner: topBannerSlice.reducer,
        appleRestriction: appleRestrictionReducer,
      },
    });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    store = createTestStore();
    mockIsAdmin = false;
    mockIsAppleDevice = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hook initialization', () => {
    it('should return handle402Error function', () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      expect(result.current.handle402Error).toBeDefined();
      expect(typeof result.current.handle402Error).toBe('function');
    });
  });

  describe('handle402Error', () => {
    it('should dispatch setTopBannerOptions for non-admin without pricing_table', async () => {
      mockIsAdmin = false;

      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error message' });
      });

      const state = store.getState();
      expect(state.topBanner.topBannerOptions.enabled).toBe(true);
      expect(state.topBanner.topBannerOptions.bannerText).toBeTruthy();
      expect(state.topBanner.topBannerOptions.parentContainerSelector).toBe(
        '.mentor-parent-container',
      );
    });

    it('should redirect to billing tab when user is admin', async () => {
      mockIsAdmin = true;

      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Credit limit exceeded' });
      });

      expect(mockRouterPush).toHaveBeenCalledWith(
        '/platform/test-tenant/test-mentor?profileTab=billing',
      );
      // Should not dispatch setError402Detected for admin
      const state = store.getState();
      expect(state.subscription.error402Detected).toBe('');
    });

    it('should show error toast with the error field (takes precedence over message)', async () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({
          error: 'Credit limit exceeded',
          message: 'Your credit limit has been exceeded',
        });
      });

      // Note: error field takes precedence over message field
      expect(toast.error).toHaveBeenCalledWith('Credit limit exceeded', {
        closeButton: true,
      });
    });

    it('should show error field value when provided', async () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Credit limit exceeded' });
      });

      expect(toast.error).toHaveBeenCalledWith('Credit limit exceeded', {
        closeButton: true,
      });
    });

    it('should show toast with closeButton option', async () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Some error' });
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          closeButton: true,
        }),
      );
    });

    it('should handle different error values', async () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      const errors = [
        'Payment required',
        'Subscription expired',
        'Rate limit exceeded',
        'Insufficient credits',
      ];

      for (const error of errors) {
        vi.clearAllMocks();

        await act(async () => {
          await result.current.handle402Error({ error });
        });

        expect(toast.error).toHaveBeenCalledWith(error, expect.any(Object));
      }
    });

    it('should use error field when message is undefined', async () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error' });
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Test error',
        expect.any(Object),
      );
    });

    it('should handle empty object', async () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({} as any);
      });

      expect(toast.error).toHaveBeenCalled();
    });

    it('should return undefined', async () => {
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.handle402Error({ error: 'Test' });
      });

      expect(returnValue).toBeUndefined();
    });

    it('should re-enable the top banner on each call for non-admin users', async () => {
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'First error' });
      });

      const state1 = store.getState();
      expect(state1.topBanner.topBannerOptions.enabled).toBe(true);

      await act(async () => {
        await result.current.handle402Error({ error: 'Second error' });
      });

      const state2 = store.getState();
      expect(state2.topBanner.topBannerOptions.enabled).toBe(true);
    });

    it('should open pricing modal when non-admin and pricing_table data is available', async () => {
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({
          error: 'Insufficient credits',
          pricing_table: {
            pricing_table_id: 'table_123',
            pricing_table_js: 'https://js.stripe.com/v3/pricing-table.js',
            publishable_key: 'pk_test_123',
            client_reference_id: 'ref_123',
          },
        });
      });

      const state = store.getState();
      // Should set pricing modal data and open it
      expect(state.subscription.pricingModalData.pricingTableId).toBe(
        'table_123',
      );
      expect(state.subscription.pricingModalData.publishableKey).toBe(
        'pk_test_123',
      );
      expect(state.subscription.pricingModalData.referenceId).toBe('ref_123');
      expect(state.subscription.openPricingModal).toBe(true);
      // Should NOT set error402Detected when pricing modal is shown
      expect(state.subscription.error402Detected).toBe('');
    });

    it('should use empty string for client_reference_id when not provided', async () => {
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({
          error: 'Insufficient credits',
          pricing_table: {
            pricing_table_id: 'table_456',
            pricing_table_js: 'https://js.stripe.com/v3/pricing-table.js',
            publishable_key: 'pk_test_456',
            // No client_reference_id provided
          },
        });
      });

      const state = store.getState();
      // Should set pricing modal data with empty referenceId
      expect(state.subscription.pricingModalData.pricingTableId).toBe(
        'table_456',
      );
      expect(state.subscription.pricingModalData.publishableKey).toBe(
        'pk_test_456',
      );
      expect(state.subscription.pricingModalData.referenceId).toBe('');
      expect(state.subscription.openPricingModal).toBe(true);
    });

    it('should dispatch setOpenAppleRestrictionModal when on an Apple device', async () => {
      mockIsAppleDevice = true;
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error' });
      });

      const state = store.getState();
      expect(state.appleRestriction.openAppleRestrictionModal).toBe(true);
      // Should NOT fall through to admin redirect or error dispatch
      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(state.subscription.error402Detected).toBe('');
    });

    it('should show toast even on Apple device before opening Apple modal', async () => {
      mockIsAppleDevice = true;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Quota exceeded' });
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Quota exceeded',
        expect.objectContaining({ closeButton: true }),
      );
    });

    it('should prioritise Apple modal over admin billing redirect when on Apple device', async () => {
      mockIsAppleDevice = true;
      mockIsAdmin = true;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error' });
      });

      // Apple check runs before admin check
      expect(mockRouterPush).not.toHaveBeenCalled();
      const state = store.getState();
      expect(state.appleRestriction.openAppleRestrictionModal).toBe(true);
    });

    it('should prioritise Apple modal over pricing modal when on Apple device', async () => {
      mockIsAppleDevice = true;
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({
          error: 'Insufficient credits',
          pricing_table: {
            pricing_table_id: 'table_123',
            pricing_table_js: 'https://js.stripe.com/v3/pricing-table.js',
            publishable_key: 'pk_test_123',
          },
        });
      });

      const state = store.getState();
      expect(state.appleRestriction.openAppleRestrictionModal).toBe(true);
      expect(state.subscription.openPricingModal).toBe(false);
    });

    it('should not redirect admin to billing if they have pricing_table data', async () => {
      mockIsAdmin = true;

      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({
          error: 'Insufficient credits',
          pricing_table: {
            pricing_table_id: 'table_123',
            pricing_table_js: 'https://js.stripe.com/v3/pricing-table.js',
            publishable_key: 'pk_test_123',
          },
        });
      });

      // Admin should still be redirected to billing, regardless of pricing_table
      expect(mockRouterPush).toHaveBeenCalledWith(
        '/platform/test-tenant/test-mentor?profileTab=billing',
      );
    });
  });

  describe('integration with Redux store', () => {
    it('should correctly integrate with top banner slice for non-admin', async () => {
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      // Initial state should have the top banner disabled
      const initialState = store.getState();
      expect(initialState.topBanner.topBannerOptions.enabled).toBe(false);

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error' });
      });

      // After calling handle402Error, the top banner should be enabled
      const updatedState = store.getState();
      expect(updatedState.topBanner.topBannerOptions.enabled).toBe(true);
      expect(typeof updatedState.topBanner.topBannerOptions.bannerText).toBe(
        'string',
      );
    });

    it('should not enable top banner for admin users', async () => {
      mockIsAdmin = true;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      const initialState = store.getState();
      expect(initialState.topBanner.topBannerOptions.enabled).toBe(false);

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error' });
      });

      // Admin users get redirected, not the banner shown
      const updatedState = store.getState();
      expect(updatedState.topBanner.topBannerOptions.enabled).toBe(false);
      expect(mockRouterPush).toHaveBeenCalled();
    });
  });
});
