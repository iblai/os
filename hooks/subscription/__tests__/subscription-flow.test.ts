import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';
import {
  mentorSubscriptionFlow,
  SubscriptionFlowConfig,
} from '../subscription-flow';
import { setOpenPricingModal } from '@/features/subscription/subscription-slice';
import { setTopBannerOptions } from '@/features/top-banner/top-banner-slice';
import { TRIGGERS } from '@/features/top-banner/constants';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock Redux actions
vi.mock('@/features/subscription/subscription-slice', () => ({
  setOpenPricingModal: vi.fn((value) => ({
    type: 'SET_OPEN_PRICING_MODAL',
    payload: value,
  })),
}));

vi.mock('@/features/top-banner/top-banner-slice', () => ({
  setTopBannerOptions: vi.fn((options) => ({
    type: 'SET_TOP_BANNER_OPTIONS',
    payload: options,
  })),
}));

vi.mock('@/features/top-banner/constants', () => ({
  TRIGGERS: {
    PRICING_MODAL: 'TRIGGER_PRICING_MODAL',
    SUBSCRIBE_USER: 'TRIGGER_SUBSCRIBE_USER',
  },
}));

describe('mentorSubscriptionFlow', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  let subscriptionFlow: mentorSubscriptionFlow;
  let defaultConfig: SubscriptionFlowConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch = vi.fn();

    defaultConfig = {
      platformName: 'mentor-ai',
      currentTenantKey: 'test-tenant',
      username: 'test-user',
      currentTenantOrg: 'test-org',
      userTenants: [{ key: 'test-tenant', is_admin: true, org: 'test-org' }],
      isAdmin: true,
      mainTenantKey: 'main',
      dispatch: mockDispatch,
      topBannerOptions: { enabled: false },
    };

    subscriptionFlow = new mentorSubscriptionFlow(defaultConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Getters', () => {
    it('initializes with provided config', () => {
      expect(subscriptionFlow.getPlatformName()).toBe('mentor-ai');
      expect(subscriptionFlow.getCurrentTenantKey()).toBe('test-tenant');
      expect(subscriptionFlow.getUsername()).toBe('test-user');
      expect(subscriptionFlow.getCurrentTenantOrg()).toBe('test-org');
      expect(subscriptionFlow.isUserAdmin()).toBe(true);
      expect(subscriptionFlow.getMainTenantKey()).toBe('main');
    });

    it('returns user tenants array', () => {
      const tenants = subscriptionFlow.getUserTenants();
      expect(tenants).toHaveLength(1);
      expect(tenants[0].key).toBe('test-tenant');
    });
  });

  describe('handleFreeUsageCountFlow', () => {
    it('does nothing when freeUsageCount is null/undefined', () => {
      // @ts-expect-error - Testing null case
      subscriptionFlow.handleFreeUsageCountFlow(null);
      expect(mockDispatch).not.toHaveBeenCalled();

      // @ts-expect-error - Testing undefined case
      subscriptionFlow.handleFreeUsageCountFlow(undefined);
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('updates banner with remaining count when count > 0', () => {
      subscriptionFlow.handleFreeUsageCountFlow({ count: 5 });

      expect(mockDispatch).toHaveBeenCalled();
      expect(setTopBannerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          tooltipText: 'You have 5 free chat left.',
          enabled: true,
        }),
      );
    });

    it('updates banner with limit message when count < 1', () => {
      subscriptionFlow.handleFreeUsageCountFlow({ count: 0 });

      expect(mockDispatch).toHaveBeenCalled();
      expect(setTopBannerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          tooltipText:
            'You have reached your free trial limit. Please upgrade to continue and create your own mentors. No credit card required 😎',
          bannerText:
            'You have reached your free trial limit. Please upgrade to continue and create your own mentors. No credit card required 😎',
        }),
      );
    });
  });

  describe('handleTrialEndedFlow', () => {
    it('shows error toast and updates banner', () => {
      subscriptionFlow.handleTrialEndedFlow();

      expect(toast.error).toHaveBeenCalledWith(
        'Your free trial has ended. Please upgrade to continue using Agentic OS 😎.',
      );
      expect(mockDispatch).toHaveBeenCalled();
      expect(setTopBannerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          onUpgrade: TRIGGERS.SUBSCRIBE_USER,
          enabled: true,
        }),
      );
    });

    it('clears interval when provided', () => {
      vi.useFakeTimers();
      const intervalId = setInterval(() => {}, 1000) as unknown as number;

      subscriptionFlow.handleTrialEndedFlow(intervalId);

      expect(toast.error).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('handleSubscriptionOnGoingFlow', () => {
    it('shows info toast and updates banner with time remaining', () => {
      subscriptionFlow.handleSubscriptionOnGoingFlow('3 days');

      expect(toast.info).toHaveBeenCalledWith(
        "You're on a free trial for the next 3 days. Upgrade to a paid plan 💪",
      );
      expect(mockDispatch).toHaveBeenCalled();
      expect(setTopBannerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          tooltipText:
            "You're on a free trial for the next 3 days. Upgrade to a paid plan 💪",
          bannerText:
            "You're on a free trial for the next 3 days. Upgrade to a paid plan 💪",
          buttonLabel: 'Subscribe',
          onUpgrade: TRIGGERS.SUBSCRIBE_USER,
        }),
      );
    });
  });

  describe('handleRedirectToURLFlow', () => {
    let originalHref: string;
    const mockLocation = {
      href: '',
    };

    beforeEach(() => {
      vi.useFakeTimers();
      originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
        configurable: true,
      });
      mockLocation.href = '';
    });

    afterEach(() => {
      vi.useRealTimers();
      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true,
        configurable: true,
      });
    });

    it('redirects to URL after delay', () => {
      subscriptionFlow.handleRedirectToURLFlow('https://example.com/upgrade');

      expect(mockLocation.href).toBe('');

      vi.advanceTimersByTime(500);

      expect(mockLocation.href).toBe('https://example.com/upgrade');
    });

    it('shows toast message when provided', () => {
      subscriptionFlow.handleRedirectToURLFlow(
        'https://example.com/upgrade',
        'Redirecting to upgrade page',
      );

      expect(toast.info).toHaveBeenCalledWith('Redirecting to upgrade page');
    });

    it('does not show toast when no message provided', () => {
      subscriptionFlow.handleRedirectToURLFlow('https://example.com/upgrade');

      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  describe('handlePricingPageDisplayFlow', () => {
    it('dispatches setOpenPricingModal with true', () => {
      subscriptionFlow.handlePricingPageDisplayFlow();

      expect(mockDispatch).toHaveBeenCalled();
      expect(setOpenPricingModal).toHaveBeenCalledWith(true);
    });
  });

  describe('handleBeforeSubscribeUserTriggerFlow', () => {
    it('dispatches banner options with loading true', () => {
      subscriptionFlow.handleBeforeSubscribeUserTriggerFlow();

      expect(mockDispatch).toHaveBeenCalled();
      expect(setTopBannerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          loading: true,
        }),
      );
    });
  });

  describe('handleSuccessfullySubscribedFlow', () => {
    it('shows success toast with default message', () => {
      subscriptionFlow.handleSuccessfullySubscribedFlow();

      expect(toast.success).toHaveBeenCalledWith(
        'Subscription renewed successfully.',
      );
    });

    it('shows success toast with custom message', () => {
      subscriptionFlow.handleSuccessfullySubscribedFlow('Welcome to premium!');

      expect(toast.success).toHaveBeenCalledWith('Welcome to premium!');
    });

    it('disables banner after successful subscription', () => {
      subscriptionFlow.handleSuccessfullySubscribedFlow();

      expect(mockDispatch).toHaveBeenCalled();
      expect(setTopBannerOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      );
    });
  });
});
