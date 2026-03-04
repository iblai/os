import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubscription } from '../use-subscription';

// Mock the dependencies
const mockHandleSubscriptionCheck = vi.fn();
const mockHandleIntervalSubscriptionCheck = vi.fn();

vi.mock('@iblai/iblai-js/web-utils', () => ({
  useSubscriptionHandler: vi.fn(() => ({
    handleSubscriptionCheck: mockHandleSubscriptionCheck,
    handleIntervalSubscriptionCheck: mockHandleIntervalSubscriptionCheck,
    trialCounterStarted: false,
  })),
}));

vi.mock('../subscription-flow', () => ({
  mentorSubscriptionFlow: vi.fn().mockImplementation(() => ({
    getCurrentTenantOrg: vi.fn(() => 'test-org'),
    getUsername: vi.fn(() => 'test-user'),
  })),
}));

vi.mock('@/features/utils', () => ({
  getUserName: vi.fn(() => 'test-username'),
}));

vi.mock('@/lib/config', () => ({
  config: {
    iblPlatform: vi.fn(() => 'mentor'),
  },
}));

vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: vi.fn(() => ({
    currentTenant: {
      key: 'tenant-key',
      org: 'tenant-org',
      is_admin: false,
    },
  })),
  useUserTenants: vi.fn(() => ({
    userTenants: [{ key: 'tenant-key', org: 'tenant-org' }],
  })),
}));

// Mock useAppDispatch and useAppSelector
vi.mock('@/lib/hooks', () => ({
  useAppDispatch: vi.fn(() => vi.fn()),
  useAppSelector: vi.fn(() => ({
    topBannerOptions: {},
  })),
}));

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not call handleSubscriptionCheck on mount (currently disabled)', () => {
    renderHook(() => useSubscription());

    // handleSubscriptionCheck is currently commented out in the implementation
    expect(mockHandleSubscriptionCheck).not.toHaveBeenCalled();
  });

  it('should call handleIntervalSubscriptionCheck when trialCounterStarted changes', () => {
    renderHook(() => useSubscription());

    expect(mockHandleIntervalSubscriptionCheck).toHaveBeenCalled();
  });

  it('should create mentorSubscriptionFlow with correct parameters', async () => {
    const { mentorSubscriptionFlow } = await import('../subscription-flow');

    renderHook(() => useSubscription());

    expect(mentorSubscriptionFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        platformName: 'mentor',
        currentTenantKey: 'tenant-key',
        username: 'test-username',
        currentTenantOrg: 'tenant-org',
        isAdmin: false,
        mainTenantKey: 'tenant-key',
      }),
    );
  });

  it('should handle undefined tenant gracefully', async () => {
    const { useCurrentTenant } = await import('@/hooks/use-user');
    (useCurrentTenant as any).mockReturnValue({
      currentTenant: undefined,
    });

    // Should not throw
    expect(() => renderHook(() => useSubscription())).not.toThrow();
  });
});
