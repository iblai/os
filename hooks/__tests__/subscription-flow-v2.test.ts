import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Hoisted mocks (safe to use inside vi.mock factories) ----
const mocked = vi.hoisted(() => ({
  setSubscriptionStatus: vi.fn((payload: any) => ({ type: 'setSubscriptionStatus', payload })),
  setPricingModalData: vi.fn((payload: any) => ({ type: 'setPricingModalData', payload })),
  setOpenPricingModal: vi.fn((open: boolean) => ({ type: 'setOpenPricingModal', payload: open })),
  setTopBannerOptions: vi.fn((payload: any) => ({ type: 'setTopBannerOptions', payload })),
  infoSpy: vi.fn(),
  errorSpy: vi.fn(),
}));

// ---- Mocks must be declared before importing the class under test ----
vi.mock('@/features/subscription/subscription-slice', () => ({
  setSubscriptionStatus: mocked.setSubscriptionStatus,
  setPricingModalData: mocked.setPricingModalData,
  setOpenPricingModal: mocked.setOpenPricingModal,
}));

vi.mock('@/features/top-banner/top-banner-slice', () => ({
  setTopBannerOptions: mocked.setTopBannerOptions,
}));

vi.mock('sonner', () => ({
  toast: { info: mocked.infoSpy, error: mocked.errorSpy },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  // Minimal base class used by MentorSubscriptionFlowV2
  SubscriptionFlowV2: class {
    platformName: string;
    currentTenantKey: string;
    username: string;
    currentTenantOrg: string;
    userTenants: any[];
    isAdmin: boolean;
    mainTenantKey: string;
    private _userEmail: string;
    constructor(cfg: any) {
      this.platformName = cfg.platformName;
      this.currentTenantKey = cfg.currentTenantKey;
      this.username = cfg.username;
      this.currentTenantOrg = cfg.currentTenantOrg;
      this.userTenants = cfg.userTenants;
      this.isAdmin = cfg.isAdmin;
      this.mainTenantKey = cfg.mainTenantKey;
      this._userEmail = cfg.userEmail;
    }
    getUserEmail() {
      return this._userEmail;
    }
  },
  // Constants used in the flow
  SUBSCRIPTION_V2_TRIGGERS: {
    PRICING_MODAL: 'TRIGGER_PRICING_MODAL',
    TOP_UP_CREDIT: 'TRIGGER_TOP_UP_CREDIT',
    CONTACT_ADMIN: 'TRIGGER_CONTACT_ADMIN',
    BILLING_PAGE: 'TRIGGER_BILLING_PAGE',
  },
  SUBSCRIPTION_MESSAGES: {
    CREDIT_EXHAUSTED: {
      NO_APP: 'Upgrade to create your own mentors.',
      ADMIN: 'You’ve used all your credits.',
      PRO_PACKAGE: ({ expiryDate }: { expiryDate: string }) => `Pro exhausted until ${expiryDate}`,
      FREE_PACKAGE: ({ expiryDate }: { expiryDate: string }) =>
        `Free exhausted until ${expiryDate}`,
      STARTER_PACKAGE: ({ expiryDate }: { expiryDate: string }) =>
        `Starter exhausted until ${expiryDate}`,
      STUDENT: 'Your organization has run out of credits.',
      STUDENT_UNDER_PAID_PACKAGE_EMAIL_BODY: ({ currentTenantOrg, userEmail }: any) =>
        `Hey team, org=${currentTenantOrg} user=${userEmail}`,
      STUDENT_UNDER_PAID_PACKAGE_EMAIL_SUBJECT: ({ currentTenantOrg }: any) =>
        `Out of credits: ${currentTenantOrg}`,
      FREE_TRIAL_LIMIT: 'Upgrade to create your own mentors.',
    },
    ACTION_BUTTONS: {
      UPGRADE: 'Upgrade Plan 😎',
      TOP_UP: 'Add Credits 😎',
      FREE_PACKAGE: 'Upgrade Plan 😎',
      STARTER_PACKAGE: 'Upgrade Plan 😎',
      CONTACT_ADMIN: 'Contact Now 🫶',
      ADD_CREDITS: 'Add Credits 😎',
    },
    TOAST_MESSAGES: {
      PRICING_PAGE_LOAD_ERROR: 'Error loading pricing page data. Please try again later.',
      TOP_UP_CREDIT_TRIGGER_LOAD_ERROR:
        'Error loading top up credit trigger data. Please try again later.',
      REDIRECTING_BILLING_PAGE: 'Redirecting to billing page...',
      BILLING_PAGE_TRIGGER_LOAD_ERROR: 'Error loading billing page data. Please try again later.',
    },
  },
}));

vi.mock('@/features/subscription/constants', () => ({
  SUBSCRIPTION_USER_CAPABILITIES: {
    FREE_TRIAL: 'free-trial',
    PAID_PACKAGE: 'paid',
    FREE_PACKAGE: 'free',
    STARTER_PACKAGE: 'starter',
    PRO_PACKAGE: 'pro',
    STUDENT_UNDER_PAID_PACKAGE: 'student-paid',
  },
}));

import { MentorSubscriptionFlowV2 } from '@/hooks/subscription/subscription-flow-v2';

describe('MentorSubscriptionFlowV2', () => {
  const dispatch = vi.fn();
  const baseConfig = {
    platformName: 'mentor',
    currentTenantKey: 'tenant-1',
    username: 'user-name',
    currentTenantOrg: 'org-1',
    userTenants: [],
    isAdmin: true,
    mainTenantKey: 'main',
    dispatch,
    topBannerOptions: { foo: 'bar', loading: false },
    userEmail: 'user@example.com',
    mentorUrl: 'https://mentor.example.com',
  };

  beforeEach(() => {
    dispatch.mockReset();
    mocked.setSubscriptionStatus.mockClear();
    mocked.setPricingModalData.mockClear();
    mocked.setOpenPricingModal.mockClear();
    mocked.setTopBannerOptions.mockClear();
    mocked.infoSpy.mockReset();
    mocked.errorSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes getters from the base config', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    expect(flow.getPlatformName()).toBe('mentor');
    expect(flow.getCurrentTenantKey()).toBe('tenant-1');
    expect(flow.getUsername()).toBe('user-name');
    expect(flow.getCurrentTenantOrg()).toBe('org-1');
  });

  it('getUserTenants returns user tenants array', () => {
    const configWithTenants = {
      ...baseConfig,
      userTenants: [{ key: 'tenant-1' }, { key: 'tenant-2' }],
    };
    const flow = new MentorSubscriptionFlowV2(configWithTenants as any);
    expect(flow.getUserTenants()).toEqual([{ key: 'tenant-1' }, { key: 'tenant-2' }]);
  });

  it('isUserAdmin returns admin status', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    expect(flow.isUserAdmin()).toBe(true);

    const nonAdminConfig = { ...baseConfig, isAdmin: false };
    const nonAdminFlow = new MentorSubscriptionFlowV2(nonAdminConfig as any);
    expect(nonAdminFlow.isUserAdmin()).toBe(false);
  });

  it('getMainTenantKey returns main tenant key', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    expect(flow.getMainTenantKey()).toBe('main');
  });

  it('handleFreeUsageCountFlow dispatches FREE_TRIAL with PRICING_MODAL when no credits', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleFreeUsageCountFlow(false);
    expect(mocked.setSubscriptionStatus).toHaveBeenCalled();
    const payload = mocked.setSubscriptionStatus.mock.calls[0][0];
    expect(payload.creditExhausted).toBe(true);
    expect(payload.callToAction).toBe('TRIGGER_PRICING_MODAL');
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setSubscriptionStatus' }),
    );
  });

  it('handleRedirectToURLFlow shows toast and redirects after delay', () => {
    vi.useFakeTimers();
    const originalLocation = window.location;
    let currentHref = 'http://localhost:3000/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return currentHref;
        },
        set href(v: string) {
          currentHref = v;
        },
      },
    });
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    const target = 'https://billing.example.com';
    flow.handleRedirectToURLFlow(target, 'Redirecting...');
    expect(mocked.infoSpy).toHaveBeenCalledWith('Redirecting...');
    vi.advanceTimersByTime(500);
    expect(window.location.href).toBe(target);
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('handlePricingPageDisplayFlow dispatches modal data and opens modal', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    const ctx = {
      client_reference_id: 'ref-1',
      publishable_key: 'pk-123',
      pricing_table_id: 'tbl-1',
    } as any;
    flow.handlePricingPageDisplayFlow(ctx, true);

    expect(mocked.setPricingModalData).toHaveBeenCalledWith({
      referenceId: 'ref-1',
      customerEmail: 'user@example.com',
      publishableKey: 'pk-123',
      pricingTableId: 'tbl-1',
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'setPricingModalData' }));
    expect(mocked.setOpenPricingModal).toHaveBeenCalledWith(true);
    expect(mocked.setTopBannerOptions).toHaveBeenCalledWith({ foo: 'bar', loading: false });
    expect(mocked.setSubscriptionStatus).toHaveBeenCalled();
    const statusCalls = mocked.setSubscriptionStatus.mock.calls as any[];
    const statusPayload = statusCalls[statusCalls.length - 1][0];
    expect(statusPayload.callToAction).toBe('TRIGGER_PRICING_MODAL');
  });

  it('handleBeforePricingPageDisplayFlow sets banner loading true', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleBeforePricingPageDisplayFlow();
    expect(mocked.setTopBannerOptions).toHaveBeenCalledWith({ foo: 'bar', loading: true });
  });

  it('handleFailureOnPaymentFlow shows error and clears loading', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleFailureOnPaymentFlow();
    expect(mocked.errorSpy).toHaveBeenCalled();
    expect(mocked.setTopBannerOptions).toHaveBeenCalledWith({ foo: 'bar', loading: false });
  });

  it('handleFailureOnTopUpCreditTriggerFlow shows error and clears loading', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleFailureOnTopUpCreditTriggerFlow();
    expect(mocked.errorSpy).toHaveBeenCalled();
    expect(mocked.setTopBannerOptions).toHaveBeenCalledWith({ foo: 'bar', loading: false });
  });

  it('handleBeforeTopUpCreditTriggerFlow sets loading true', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleBeforeTopUpCreditTriggerFlow();
    expect(mocked.setTopBannerOptions).toHaveBeenCalledWith({ foo: 'bar', loading: true });
  });

  it('handleRedirectToBillingPageFlow delegates to URL redirect with toast', () => {
    vi.useFakeTimers();
    const originalLocation = window.location;
    let currentHref = 'http://localhost:3000/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return currentHref;
        },
        set href(v: string) {
          currentHref = v;
        },
      },
    });
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    const url = 'https://billing.example.com/org';
    flow.handleRedirectToBillingPageFlow(url);
    expect(mocked.infoSpy).toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(window.location.href).toBe(url);
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('handlePaidPlanCreditExhaustedFlow sets banner and status for TOP_UP_CREDIT', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handlePaidPlanCreditExhaustedFlow();
    expect(mocked.setTopBannerOptions).toHaveBeenCalled();
    const topBannerCalls = mocked.setTopBannerOptions.mock.calls as any[];
    const bannerPayload = topBannerCalls[0][0];
    expect(bannerPayload.onUpgrade).toBe('TRIGGER_TOP_UP_CREDIT');
    expect(mocked.setSubscriptionStatus).toHaveBeenCalled();
    const statusCalls2 = mocked.setSubscriptionStatus.mock.calls as any[];
    const statusPayload = statusCalls2[statusCalls2.length - 1][0];
    expect(statusPayload.callToAction).toBe('TRIGGER_TOP_UP_CREDIT');
  });

  it('handleCreditExhaustedWithUserOnFreePackageFlow sets billing page action', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleCreditExhaustedWithUserOnFreePackageFlow({
      subscriptionId: 'sub-1',
      expiryDate: '2025-01-01',
    } as any);
    const bannerCalls1 = mocked.setTopBannerOptions.mock.calls as any[];
    const bannerPayload = bannerCalls1[bannerCalls1.length - 1][0];
    expect(bannerPayload.onUpgrade).toBe('TRIGGER_BILLING_PAGE');
    const statusCalls3 = mocked.setSubscriptionStatus.mock.calls as any[];
    const statusPayload = statusCalls3[statusCalls3.length - 1][0];
    expect(statusPayload.callToAction).toBe('TRIGGER_BILLING_PAGE');
  });

  it('handleCreditExhaustedWithUserOnStarterPackageFlow sets billing page action', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleCreditExhaustedWithUserOnStarterPackageFlow({
      subscriptionId: 'sub-2',
      expiryDate: '2025-02-01',
    } as any);
    const bannerCalls2 = mocked.setTopBannerOptions.mock.calls as any[];
    const bannerPayload = bannerCalls2[bannerCalls2.length - 1][0];
    expect(bannerPayload.onUpgrade).toBe('TRIGGER_BILLING_PAGE');
    const statusCalls4 = mocked.setSubscriptionStatus.mock.calls as any[];
    const statusPayload = statusCalls4[statusCalls4.length - 1][0];
    expect(statusPayload.callToAction).toBe('TRIGGER_BILLING_PAGE');
  });

  it('handleBeforeBillingPageTriggerFlow sets banner loading true', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleBeforeBillingPageTriggerFlow();
    expect(mocked.setTopBannerOptions).toHaveBeenCalledWith({ foo: 'bar', loading: true });
  });

  it('handleCreditExhaustedWithUserOnProPackageFlow sets top-up action', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleCreditExhaustedWithUserOnProPackageFlow({ expiryDate: '2025-03-01' } as any);
    const bannerCalls3 = mocked.setTopBannerOptions.mock.calls as any[];
    const bannerPayload = bannerCalls3[bannerCalls3.length - 1][0];
    expect(bannerPayload.onUpgrade).toBe('TRIGGER_TOP_UP_CREDIT');
    const statusCalls5 = mocked.setSubscriptionStatus.mock.calls as any[];
    const statusPayload = statusCalls5[statusCalls5.length - 1][0];
    expect(statusPayload.callToAction).toBe('TRIGGER_TOP_UP_CREDIT');
  });

  it('handleStudentOnPaidPlanCreditExhaustedFlow sets contact admin action', () => {
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleStudentOnPaidPlanCreditExhaustedFlow();
    const topBannerCalls4 = mocked.setTopBannerOptions.mock.calls as any[];
    const bannerPayload = topBannerCalls4[topBannerCalls4.length - 1][0];
    expect(bannerPayload.onUpgrade).toBe('TRIGGER_CONTACT_ADMIN');
    const statusCalls6 = mocked.setSubscriptionStatus.mock.calls as any[];
    const statusPayload = statusCalls6[statusCalls6.length - 1][0];
    expect(statusPayload.callToAction).toBe('TRIGGER_CONTACT_ADMIN');
  });

  it('handleOpenContactAdminFlow opens mailto with subject and body', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as any);
    const flow = new MentorSubscriptionFlowV2(baseConfig as any);
    flow.handleOpenContactAdminFlow('admin@org.com');
    expect(openSpy).toHaveBeenCalled();
    const calls = openSpy.mock.calls as any[];
    expect(calls.length).toBeGreaterThan(0);
    const url = String(calls[calls.length - 1]?.[0] ?? '');
    expect(url.startsWith('mailto:admin@org.com?subject=')).toBe(true);
    expect(url.includes(encodeURIComponent('Out of credits: org-1'))).toBe(true);
    expect(url.includes(encodeURIComponent('org=org-1'))).toBe(true);
    expect(url.includes(encodeURIComponent('user=user@example.com'))).toBe(true);
    openSpy.mockRestore();
  });
});
