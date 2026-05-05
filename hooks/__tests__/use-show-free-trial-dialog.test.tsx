import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';

// ---- Mocks with test-controlled state ----
let mockReduxState: any;
let mockCurrentTenant: any;
let mockUserTenants: any[];
let mockIsStripeActivated = true;

vi.mock('@/lib/utils', () => ({
  isStripeActivated: vi.fn(() => mockIsStripeActivated),
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (s: any) => any) => selector(mockReduxState),
}));

vi.mock('@/hooks/use-user', () => ({
  useCurrentTenant: () => ({ currentTenant: mockCurrentTenant }),
  useUserTenants: () => ({ userTenants: mockUserTenants }),
}));

vi.mock('@/features/utils', () => ({
  getUserName: () => 'user-name',
  getUserEmail: () => 'user@email.com',
}));

vi.mock('@/lib/config', () => ({
  config: {
    iblPlatform: () => 'mentor',
    mainTenantKey: () => 'main',
    mentorUrl: () => 'https://mentor.example.com',
  },
}));

// Dummy class for the subscription flow to avoid side effects
vi.mock('@/hooks/subscription/subscription-flow-v2', () => ({
  MentorSubscriptionFlowV2: class {
    constructor(public options: any) {}
  },
}));

const callbackSpy = vi.fn();
const bannerTriggerSpy = vi.fn();

vi.mock('@iblai/iblai-js/web-utils', () => ({
  SUBSCRIPTION_V2_TRIGGERS: {
    PRICING_MODAL: 'TRIGGER_PRICING_MODAL',
    TOP_UP_CREDIT: 'TRIGGER_TOP_UP_CREDIT',
    CONTACT_ADMIN: 'TRIGGER_CONTACT_ADMIN',
    BILLING_PAGE: 'TRIGGER_BILLING_PAGE',
  },
  useSubscriptionHandlerV2: () => ({
    bannerButtonTriggerCallback: (trigger: string) => {
      bannerTriggerSpy(trigger);
      return callbackSpy;
    },
  }),
}));

// The fallback dialog component
vi.mock('@/components/free-trial-dialog', () => ({
  FreeTrialDialog: () => <div data-testid="ibl-free-trial-dialog" />,
}));

// Simple harness to access hook values
function Harness({
  options,
  onReady,
}: {
  options?: any;
  onReady: (value: ReturnType<typeof useShowFreeTrialDialog>) => void;
}) {
  const api = useShowFreeTrialDialog(options);
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

beforeEach(() => {
  mockReduxState = {
    subscription: {
      subscriptionStatus: { creditExhausted: false, callToAction: undefined },
    },
    topBanner: { topBannerOptions: {} },
  };
  mockCurrentTenant = { key: 'tenant-123', org: 'org-123', is_admin: true };
  mockUserTenants = [];
  mockIsStripeActivated = true;
  callbackSpy.mockReset();
  bannerTriggerSpy.mockReset();
});

describe('useShowFreeTrialDialog', () => {
  it('triggers banner callback when credit is exhausted with explicit callToAction', () => {
    mockReduxState.subscription.subscriptionStatus = {
      creditExhausted: true,
      callToAction: 'TRIGGER_TOP_UP_CREDIT',
    };

    const actionFn = vi.fn();
    let hookApi: ReturnType<typeof useShowFreeTrialDialog> | null = null;

    render(<Harness onReady={(api) => (hookApi = api)} />);

    hookApi!.executeWithTrialCheck(actionFn);

    expect(bannerTriggerSpy).toHaveBeenCalledWith('TRIGGER_TOP_UP_CREDIT');
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(actionFn).not.toHaveBeenCalled();
  });

  it('uses default PRICING_MODAL trigger when triggered without callToAction (e.g., main non-admin)', () => {
    mockReduxState.subscription.subscriptionStatus = {
      creditExhausted: true,
      callToAction: undefined,
    } as any;
    // Make the second condition true: main tenant, admin action, non-admin user
    mockCurrentTenant = { key: 'main', org: 'org-main', is_admin: false };

    const actionFn = vi.fn();
    let hookApi: ReturnType<typeof useShowFreeTrialDialog> | null = null;

    render(<Harness onReady={(api) => (hookApi = api)} />);

    hookApi!.executeWithTrialCheck(actionFn, true);

    expect(bannerTriggerSpy).toHaveBeenCalledWith('TRIGGER_PRICING_MODAL');
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(actionFn).not.toHaveBeenCalled();
  });

  it('blocks non-admin user on main tenant for admin actions', () => {
    mockReduxState.subscription.subscriptionStatus = {
      creditExhausted: false,
      callToAction: undefined,
    };
    mockCurrentTenant = { key: 'main', org: 'org-main', is_admin: false };

    const actionFn = vi.fn();
    let hookApi: ReturnType<typeof useShowFreeTrialDialog> | null = null;

    render(<Harness onReady={(api) => (hookApi = api)} />);

    hookApi!.executeWithTrialCheck(actionFn, true);

    expect(bannerTriggerSpy).toHaveBeenCalledWith('TRIGGER_PRICING_MODAL');
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(actionFn).not.toHaveBeenCalled();
  });

  it('executes action when not blocked by credit or role', () => {
    mockReduxState.subscription.subscriptionStatus = {
      creditExhausted: false,
      callToAction: undefined,
    };
    mockCurrentTenant = { key: 'tenant-123', org: 'org-123', is_admin: true };

    const actionFn = vi.fn().mockReturnValue('ok');
    let hookApi: ReturnType<typeof useShowFreeTrialDialog> | null = null;

    render(<Harness onReady={(api) => (hookApi = api)} />);

    const result = hookApi!.executeWithTrialCheck(actionFn);

    expect(bannerTriggerSpy).not.toHaveBeenCalled();
    expect(callbackSpy).not.toHaveBeenCalled();
    expect(actionFn).toHaveBeenCalledTimes(1);
    expect(result).toBe('ok');
  });

  it('prefers custom modal component over fallback', () => {
    const CustomModal = () => <div data-testid="custom-modal" />;
    let hookApi: ReturnType<typeof useShowFreeTrialDialog> | null = null;

    render(
      <Harness
        options={{ modalComponent: CustomModal }}
        onReady={(api) => (hookApi = api)}
      />,
    );

    expect(hookApi!.FreeTrialDialog).toBe(CustomModal);
  });

  it('returns fallback dialog when enabled, otherwise null', () => {
    let apiWithFallback: ReturnType<typeof useShowFreeTrialDialog> | null =
      null;
    render(<Harness onReady={(api) => (apiWithFallback = api)} />);
    expect(apiWithFallback!.FreeTrialDialog).not.toBeNull();

    let apiWithoutFallback: ReturnType<typeof useShowFreeTrialDialog> | null =
      null;
    render(
      <Harness
        options={{ enableFallbackModal: false }}
        onReady={(api) => (apiWithoutFallback = api)}
      />,
    );
    expect(apiWithoutFallback!.FreeTrialDialog).toBeNull();
  });
});
