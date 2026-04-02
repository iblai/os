import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubscriptionV2 } from '../use-subscription-v2';

// Mock dependencies
const mockExecuteWithTrialCheck = vi.fn();
const mockHandleSubscriptionCheck = vi.fn();

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useSubscriptionHandlerV2: vi.fn(() => ({
    handleSubscriptionCheck: mockHandleSubscriptionCheck,
    CREDIT_INTERVAL_CHECK_COUNTER: 60000,
  })),
}));

vi.mock('../subscription-flow-v2', () => ({
  MentorSubscriptionFlowV2: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/features/utils', () => ({
  getUserName: vi.fn(() => 'test-username'),
  getUserEmail: vi.fn(() => 'test@example.com'),
}));

vi.mock('@/lib/config', () => ({
  config: {
    iblPlatform: vi.fn(() => 'mentor'),
    mainTenantKey: vi.fn(() => 'main-tenant'),
    mentorUrl: vi.fn(() => 'https://mentor.example.com'),
  },
}));

vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: vi.fn(() => ({
    currentTenant: {
      key: 'tenant-key',
      org: 'tenant-org',
      is_admin: true,
    },
  })),
  useUserTenants: vi.fn(() => ({
    userTenants: [{ key: 'tenant-key', org: 'tenant-org' }],
  })),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: vi.fn(() => ({
    executeWithTrialCheck: mockExecuteWithTrialCheck,
  })),
}));

// Mock useAppDispatch and useAppSelector
const mockDispatch = vi.fn();
vi.mock('@/lib/hooks', () => ({
  useAppDispatch: vi.fn(() => mockDispatch),
  useAppSelector: vi.fn((selector: any) => {
    // Default mock state - return empty strings/false for conditions
    const mockState = {
      subscription: {
        error402Detected: '',
        subscriptionStatus: {
          creditExhausted: false,
        },
      },
      topBanner: {
        topBannerOptions: {},
      },
    };
    return selector(mockState);
  }),
}));

describe('useSubscriptionV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render without throwing an error', () => {
    expect(() => renderHook(() => useSubscriptionV2())).not.toThrow();
  });

  it('should create MentorSubscriptionFlowV2 with correct parameters', async () => {
    const { MentorSubscriptionFlowV2 } = await import(
      '../subscription-flow-v2'
    );

    renderHook(() => useSubscriptionV2());

    expect(MentorSubscriptionFlowV2).toHaveBeenCalledWith(
      expect.objectContaining({
        platformName: 'mentor',
        currentTenantKey: 'tenant-key',
        username: 'test-username',
        currentTenantOrg: 'tenant-org',
        isAdmin: true,
        mainTenantKey: 'main-tenant',
        userEmail: 'test@example.com',
        dispatch: mockDispatch,
        topBannerOptions: {},
        mentorUrl: 'https://mentor.example.com',
      }),
    );
  });

  it('should not call executeWithTrialCheck when error402Detected is empty', () => {
    renderHook(() => useSubscriptionV2());

    expect(mockExecuteWithTrialCheck).not.toHaveBeenCalled();
  });

  it('should not call executeWithTrialCheck when only error402Detected is set', async () => {
    const { useAppSelector } = await import('@/lib/hooks');
    (useAppSelector as any).mockImplementation((selector: any) => {
      const mockState = {
        subscription: {
          error402Detected: '2024-01-15T10:00:00.000Z',
          subscriptionStatus: {
            creditExhausted: false,
          },
        },
        topBanner: {
          topBannerOptions: {},
        },
      };
      return selector(mockState);
    });

    renderHook(() => useSubscriptionV2());

    expect(mockExecuteWithTrialCheck).not.toHaveBeenCalled();
  });

  it('should not call executeWithTrialCheck when only creditExhausted is true', async () => {
    const { useAppSelector } = await import('@/lib/hooks');
    (useAppSelector as any).mockImplementation((selector: any) => {
      const mockState = {
        subscription: {
          error402Detected: '',
          subscriptionStatus: {
            creditExhausted: true,
          },
        },
        topBanner: {
          topBannerOptions: {},
        },
      };
      return selector(mockState);
    });

    renderHook(() => useSubscriptionV2());

    expect(mockExecuteWithTrialCheck).not.toHaveBeenCalled();
  });

  it('should call executeWithTrialCheck when both error402Detected and creditExhausted are truthy', async () => {
    const { useAppSelector } = await import('@/lib/hooks');
    (useAppSelector as any).mockImplementation((selector: any) => {
      const mockState = {
        subscription: {
          error402Detected: '2024-01-15T10:00:00.000Z',
          subscriptionStatus: {
            creditExhausted: true,
          },
        },
        topBanner: {
          topBannerOptions: {},
        },
      };
      return selector(mockState);
    });

    // Capture and execute the callback passed to executeWithTrialCheck
    mockExecuteWithTrialCheck.mockImplementation((callback: () => void) => {
      callback(); // Execute the callback to cover the empty function
    });

    renderHook(() => useSubscriptionV2());

    expect(mockExecuteWithTrialCheck).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it('should handle undefined tenant gracefully', async () => {
    const { useCurrentTenant } = await import('@/hooks/use-user');
    (useCurrentTenant as any).mockReturnValue({
      currentTenant: undefined,
    });

    // Should not throw
    expect(() => renderHook(() => useSubscriptionV2())).not.toThrow();
  });

  it('should pass userTenants to subscription flow', async () => {
    const { MentorSubscriptionFlowV2 } = await import(
      '../subscription-flow-v2'
    );

    renderHook(() => useSubscriptionV2());

    expect(MentorSubscriptionFlowV2).toHaveBeenCalledWith(
      expect.objectContaining({
        userTenants: [{ key: 'tenant-key', org: 'tenant-org' }],
      }),
    );
  });

  it('should call useSubscriptionHandlerV2 with subscription flow', async () => {
    const { useSubscriptionHandlerV2 } = await import(
      '@iblai/iblai-js/web-utils'
    );

    renderHook(() => useSubscriptionV2());

    expect(useSubscriptionHandlerV2).toHaveBeenCalled();
  });

  it('should call handleSubscriptionCheck periodically via interval', async () => {
    vi.useFakeTimers();

    // Reset useAppSelector to default state (error402Detected is empty)
    const { useAppSelector } = await import('@/lib/hooks');
    (useAppSelector as any).mockImplementation((selector: any) => {
      const mockState = {
        subscription: {
          error402Detected: '',
          subscriptionStatus: {
            creditExhausted: false,
          },
        },
        topBanner: {
          topBannerOptions: {},
        },
      };
      return selector(mockState);
    });

    renderHook(() => useSubscriptionV2());

    // Initial render shouldn't call handleSubscriptionCheck (error402Detected is empty)
    expect(mockHandleSubscriptionCheck).not.toHaveBeenCalled();

    // Advance timers by the interval (60000ms)
    await vi.advanceTimersByTimeAsync(60000);

    // Now handleSubscriptionCheck should have been called by the interval
    expect(mockHandleSubscriptionCheck).toHaveBeenCalledTimes(1);

    // Advance again
    await vi.advanceTimersByTimeAsync(60000);

    expect(mockHandleSubscriptionCheck).toHaveBeenCalledTimes(2);
  });

  it('should cleanup interval on unmount', async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    // Reset useAppSelector to default state
    const { useAppSelector } = await import('@/lib/hooks');
    (useAppSelector as any).mockImplementation((selector: any) => {
      const mockState = {
        subscription: {
          error402Detected: '',
          subscriptionStatus: {
            creditExhausted: false,
          },
        },
        topBanner: {
          topBannerOptions: {},
        },
      };
      return selector(mockState);
    });

    const { unmount } = renderHook(() => useSubscriptionV2());

    // Unmount the hook
    unmount();

    // clearInterval should have been called
    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it('should call handleSubscriptionCheck immediately when error402Detected is set', async () => {
    const { useAppSelector } = await import('@/lib/hooks');
    (useAppSelector as any).mockImplementation((selector: any) => {
      const mockState = {
        subscription: {
          error402Detected: '2024-01-15T10:00:00.000Z',
          subscriptionStatus: {
            creditExhausted: false,
          },
        },
        topBanner: {
          topBannerOptions: {},
        },
      };
      return selector(mockState);
    });

    renderHook(() => useSubscriptionV2());

    // handleSubscriptionCheck should be called immediately when error402Detected is truthy
    expect(mockHandleSubscriptionCheck).toHaveBeenCalled();
  });
});
