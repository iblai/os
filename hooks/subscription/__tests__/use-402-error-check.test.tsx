import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { use402ErrorCheck } from '../use-402-error-check';
import subscriptionSlice from '@/features/subscription/subscription-slice';
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
  useParams: vi.fn(() => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' })),
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

// Mock useOS hook
let mockIsAppleDevice = false;
vi.mock('@/hooks/use-os', () => ({
  useOS: vi.fn(() => ({ isAppleDevice: mockIsAppleDevice })),
}));

describe('use402ErrorCheck', () => {
  type TestState = {
    subscription: ReturnType<typeof subscriptionSlice.reducer>;
  };

  let store: ReturnType<typeof configureStore<TestState>>;

  const createTestStore = () =>
    configureStore({
      reducer: {
        subscription: subscriptionSlice.reducer,
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
    it('should dispatch setError402Detected with ISO string timestamp for non-admin without pricing_table', async () => {
      mockIsAdmin = false;
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      vi.setSystemTime(mockDate);

      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error message' });
      });

      const state = store.getState();
      expect(state.subscription.error402Detected).toBe('2024-01-15T10:30:00.000Z');
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

      expect(toast.error).toHaveBeenCalledWith('Test error', expect.any(Object));
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

    it('should update timestamp on each call for non-admin users', async () => {
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      const mockDate1 = new Date('2024-01-15T10:00:00.000Z');
      vi.setSystemTime(mockDate1);

      await act(async () => {
        await result.current.handle402Error({ error: 'First error' });
      });

      const state1 = store.getState();
      expect(state1.subscription.error402Detected).toBe('2024-01-15T10:00:00.000Z');

      const mockDate2 = new Date('2024-01-15T11:00:00.000Z');
      vi.setSystemTime(mockDate2);

      await act(async () => {
        await result.current.handle402Error({ error: 'Second error' });
      });

      const state2 = store.getState();
      expect(state2.subscription.error402Detected).toBe('2024-01-15T11:00:00.000Z');
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
      expect(state.subscription.pricingModalData.pricingTableId).toBe('table_123');
      expect(state.subscription.pricingModalData.publishableKey).toBe('pk_test_123');
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
      expect(state.subscription.pricingModalData.pricingTableId).toBe('table_456');
      expect(state.subscription.pricingModalData.publishableKey).toBe('pk_test_456');
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
      expect(state.subscription.openAppleRestrictionModal).toBe(true);
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

      expect(toast.error).toHaveBeenCalledWith('Quota exceeded', expect.objectContaining({ closeButton: true }));
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
      expect(state.subscription.openAppleRestrictionModal).toBe(true);
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
      expect(state.subscription.openAppleRestrictionModal).toBe(true);
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
    it('should correctly integrate with subscription slice for non-admin', async () => {
      mockIsAdmin = false;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      // Initial state should have empty error402Detected
      const initialState = store.getState();
      expect(initialState.subscription.error402Detected).toBe('');

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error' });
      });

      // After calling handle402Error, state should be updated
      const updatedState = store.getState();
      expect(updatedState.subscription.error402Detected).not.toBe('');
      expect(typeof updatedState.subscription.error402Detected).toBe('string');
    });

    it('should not update error402Detected for admin users', async () => {
      mockIsAdmin = true;
      const { result } = renderHook(() => use402ErrorCheck(), { wrapper });

      // Initial state should have empty error402Detected
      const initialState = store.getState();
      expect(initialState.subscription.error402Detected).toBe('');

      await act(async () => {
        await result.current.handle402Error({ error: 'Test error' });
      });

      // Admin users get redirected, not error state updated
      const updatedState = store.getState();
      expect(updatedState.subscription.error402Detected).toBe('');
      expect(mockRouterPush).toHaveBeenCalled();
    });
  });
});
