import {
  setSubscriptionStatus,
  setPricingModalData,
  setOpenPricingModal,
} from '@/features/subscription/subscription-slice';
import { SUBSCRIPTION_V2_TRIGGERS } from '@iblai/iblai-js/web-utils';
import { setTopBannerOptions } from '@/features/top-banner/top-banner-slice';
import { toast } from 'sonner';
import { SubscriptionFlowConfigV2 as IblSubscriptionFlowConfig } from '@iblai/iblai-js/web-utils';
import { SubscriptionFlowV2 as IblSubscriptionFlow } from '@iblai/iblai-js/web-utils';
import { Dispatch, SetStateAction } from 'react';
import { StripeContextResponse } from '@iblai/iblai-js/data-layer';
import { SUBSCRIPTION_MESSAGES } from '@iblai/iblai-js/web-utils';
import { SUBSCRIPTION_USER_CAPABILITIES } from '@/features/subscription/constants';

interface Tenant {
  key: string;
  is_admin: boolean;
  org: string;
}

export interface SubscriptionFlowConfig extends IblSubscriptionFlowConfig {
  platformName: string;
  currentTenantKey: string;
  username: string;
  currentTenantOrg: string;
  userTenants: Tenant[];
  isAdmin: boolean;
  mainTenantKey: string;
  dispatch: Dispatch<SetStateAction<any>>;
  topBannerOptions: any;
  userEmail: string;
  mentorUrl: string;
}

/**
 * SubscriptionFlow class manages all subscription-related flows and user interactions
 * Handles free trial, usage limits, and subscription management
 */
export class MentorSubscriptionFlowV2 extends IblSubscriptionFlow {
  private dispatch: Dispatch<SetStateAction<any>>;
  private topBannerOptions: any;
  // Default banner configuration for subscription prompts
  private bannerOptions = {
    enabled: true,
    bannerText: SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.NO_APP,
    onUpgrade: SUBSCRIPTION_V2_TRIGGERS.PRICING_MODAL,
    parentContainerSelector: '.mentor-parent-container',
  };

  /**
   * Constructor for MentorSubscriptionFlowV2
   * @param {SubscriptionFlowConfig} config - Configuration object containing platform and user details
   */
  constructor(config: SubscriptionFlowConfig) {
    super(config);
    this.dispatch = config.dispatch;
    this.topBannerOptions = config.topBannerOptions;
  }

  /**
   * Gets the platform name
   * @returns {string} The platform name
   */
  public getPlatformName(): string {
    return this.platformName;
  }

  /**
   * Gets the current tenant key
   * @returns {string} The current tenant key
   */
  public getCurrentTenantKey(): string {
    return this.currentTenantKey;
  }

  /**
   * Gets the username
   * @returns {string} The username
   */
  public getUsername(): string {
    return this.username;
  }

  /**
   * Gets the current tenant organization
   * @returns {string} The current tenant organization
   */
  public getCurrentTenantOrg(): string {
    return this.currentTenantOrg;
  }

  /**
   * Gets the user's tenants
   * @returns {Tenant[]} Array of user's tenants
   */
  public getUserTenants(): Tenant[] {
    return this.userTenants;
  }

  /**
   * Checks if the user is an admin
   * @returns {boolean} True if user is admin, false otherwise
   */
  public isUserAdmin(): boolean {
    return this.isAdmin;
  }

  /**
   * Gets the main tenant key
   * @returns {string} The main tenant key
   */
  public getMainTenantKey(): string {
    return this.mainTenantKey;
  }

  /**
   * Handles the flow when user reaches their free usage limit
   * Updates banner with appropriate message based on remaining usage count
   * @param {boolean} hasCredits - Whether the user has remaining credits
   * @param {boolean} appExists - Whether the user has an active app
   */
  public handleFreeUsageCountFlow(hasCredits: boolean): void {
    if (!hasCredits) {
      this.dispatch(
        setSubscriptionStatus({
          creditExhausted: true,
          userCapability: SUBSCRIPTION_USER_CAPABILITIES.FREE_TRIAL,
          callToAction: SUBSCRIPTION_V2_TRIGGERS.PRICING_MODAL,
        }),
      );
    }
  }

  /**
   * Handles redirection to external URLs with optional toast notification
   * @param {string} redirectUrl - The URL to redirect to
   * @param {string} toastMessage - Optional toast message to display before redirect
   */
  public handleRedirectToURLFlow(redirectUrl: string, toastMessage?: string): void {
    if (toastMessage) {
      toast.info(toastMessage);
    }
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 500);
  }

  /**
   * Displays the pricing modal for subscription options
   * @param {StripeContextResponse} stripeContext - Stripe context data for pricing modal
   */
  public handlePricingPageDisplayFlow(
    stripeContext: StripeContextResponse,
    creditExhausted: boolean = true,
  ): void {
    const updatedBannerOptions = {
      ...this.topBannerOptions,
      loading: false,
    };
    this.dispatch(
      setPricingModalData({
        referenceId: stripeContext.client_reference_id || '',
        customerEmail: this.getUserEmail(),
        publishableKey: stripeContext.publishable_key,
        pricingTableId: stripeContext.pricing_table_id,
      }),
    );
    this.dispatch(setOpenPricingModal(true));
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    this.dispatch(
      setSubscriptionStatus({
        callToAction: SUBSCRIPTION_V2_TRIGGERS.PRICING_MODAL,
        creditExhausted: creditExhausted,
        userCapability: SUBSCRIPTION_USER_CAPABILITIES.FREE_TRIAL,
      }),
    );
  }

  /**
   * Handles the flow before displaying the pricing page
   * Sets loading state on the banner
   */
  public handleBeforePricingPageDisplayFlow(): void {
    const updatedBannerOptions = {
      ...this.topBannerOptions,
      loading: true,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
  }

  /**
   * Handles failure on payment flow
   * Shows error toast and resets banner loading state
   */
  public handleFailureOnPaymentFlow(): void {
    toast.error(SUBSCRIPTION_MESSAGES.TOAST_MESSAGES.PRICING_PAGE_LOAD_ERROR);
    const updatedBannerOptions = {
      ...this.topBannerOptions,
      loading: false,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
  }

  /**
   * Handles failure on top-up credit trigger flow
   * Shows error toast and resets banner loading state
   */
  public handleFailureOnTopUpCreditTriggerFlow(): void {
    toast.error(SUBSCRIPTION_MESSAGES.TOAST_MESSAGES.TOP_UP_CREDIT_TRIGGER_LOAD_ERROR);
    const updatedBannerOptions = {
      ...this.topBannerOptions,
      loading: false,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
  }

  /**
   * Handles the flow before top-up credit trigger
   * Sets loading state on the banner
   */
  public handleBeforeTopUpCreditTriggerFlow(): void {
    const updatedBannerOptions = {
      ...this.topBannerOptions,
      loading: true,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
  }

  /**
   * Handles redirection to billing page
   * @param {string} redirectUrl - The billing page URL to redirect to
   */
  public handleRedirectToBillingPageFlow(redirectUrl: string): void {
    this.handleRedirectToURLFlow(
      redirectUrl,
      SUBSCRIPTION_MESSAGES.TOAST_MESSAGES.REDIRECTING_BILLING_PAGE,
    );
  }

  /**
   * Handles paid plan credit exhausted flow
   * Updates banner with admin-specific message and top-up action
   */
  public handlePaidPlanCreditExhaustedFlow() {
    const updatedBannerOptions = {
      ...this.bannerOptions,
      bannerText: SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.ADMIN,
      onUpgrade: SUBSCRIPTION_V2_TRIGGERS.TOP_UP_CREDIT,
      buttonLabel: SUBSCRIPTION_MESSAGES.ACTION_BUTTONS.TOP_UP,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    this.dispatch(
      setSubscriptionStatus({
        creditExhausted: true,
        userCapability: SUBSCRIPTION_USER_CAPABILITIES.PAID_PACKAGE,
        callToAction: SUBSCRIPTION_V2_TRIGGERS.TOP_UP_CREDIT,
      }),
    );
  }

  /**
   * Handles credit exhausted flow for user on free package
   * @param {string} subscriptionId - The subscription ID for billing page
   */
  public handleCreditExhaustedWithUserOnFreePackageFlow({ subscriptionId, expiryDate }) {
    const updatedBannerOptions = {
      ...this.bannerOptions,
      bannerText: SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.FREE_PACKAGE({
        expiryDate,
      }),
      onUpgrade: SUBSCRIPTION_V2_TRIGGERS.BILLING_PAGE,
      buttonLabel: SUBSCRIPTION_MESSAGES.ACTION_BUTTONS.FREE_PACKAGE,
      subscriptionId: subscriptionId,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    this.dispatch(
      setSubscriptionStatus({
        creditExhausted: true,
        userCapability: SUBSCRIPTION_USER_CAPABILITIES.FREE_PACKAGE,
        callToAction: SUBSCRIPTION_V2_TRIGGERS.BILLING_PAGE,
      }),
    );
  }

  /**
   * Handles credit exhausted flow for user on free package
   * @param {string} subscriptionId - The subscription ID for billing page
   */
  public handleCreditExhaustedWithUserOnStarterPackageFlow({ subscriptionId, expiryDate }) {
    const updatedBannerOptions = {
      ...this.bannerOptions,
      bannerText: SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.STARTER_PACKAGE({
        expiryDate,
      }),
      onUpgrade: SUBSCRIPTION_V2_TRIGGERS.BILLING_PAGE,
      buttonLabel: SUBSCRIPTION_MESSAGES.ACTION_BUTTONS.STARTER_PACKAGE,
      subscriptionId: subscriptionId,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    this.dispatch(
      setSubscriptionStatus({
        creditExhausted: true,
        userCapability: SUBSCRIPTION_USER_CAPABILITIES.STARTER_PACKAGE,
        callToAction: SUBSCRIPTION_V2_TRIGGERS.BILLING_PAGE,
      }),
    );
  }

  public handleBeforeBillingPageTriggerFlow() {
    const updatedBannerOptions = {
      ...this.topBannerOptions,
      loading: true,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
  }

  /**
   * Handles credit exhausted flow for user on free package
   * @param {string} subscriptionId - The subscription ID for billing page
   */
  public handleCreditExhaustedWithUserOnProPackageFlow({ expiryDate }) {
    const updatedBannerOptions = {
      ...this.bannerOptions,
      bannerText: SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.PRO_PACKAGE({
        expiryDate,
      }),
      onUpgrade: SUBSCRIPTION_V2_TRIGGERS.TOP_UP_CREDIT,
      buttonLabel: SUBSCRIPTION_MESSAGES.ACTION_BUTTONS.PRO_PACKAGE,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    this.dispatch(
      setSubscriptionStatus({
        creditExhausted: true,
        userCapability: SUBSCRIPTION_USER_CAPABILITIES.PRO_PACKAGE,
        callToAction: SUBSCRIPTION_V2_TRIGGERS.TOP_UP_CREDIT,
      }),
    );
  }

  /**
   * Handles student on paid plan credit exhausted flow
   * Updates banner with student-specific message and contact admin action
   */
  public handleStudentOnPaidPlanCreditExhaustedFlow() {
    const updatedBannerOptions = {
      ...this.bannerOptions,
      bannerText: SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.STUDENT,
      onUpgrade: SUBSCRIPTION_V2_TRIGGERS.CONTACT_ADMIN,
      buttonLabel: SUBSCRIPTION_MESSAGES.ACTION_BUTTONS.CONTACT_ADMIN,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    this.dispatch(
      setSubscriptionStatus({
        creditExhausted: true,
        userCapability: SUBSCRIPTION_USER_CAPABILITIES.STUDENT_UNDER_PAID_PACKAGE,
        callToAction: SUBSCRIPTION_V2_TRIGGERS.CONTACT_ADMIN,
      }),
    );
  }

  /**
   * Opens contact admin flow by opening email client
   * @param {string} adminEmail - The admin's email address
   */
  public handleOpenContactAdminFlow(adminEmail: string): void {
    const subject = SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.STUDENT_UNDER_PAID_PACKAGE_EMAIL_SUBJECT(
      {
        currentTenantOrg: this.getCurrentTenantOrg(),
      },
    );
    const body = SUBSCRIPTION_MESSAGES.CREDIT_EXHAUSTED.STUDENT_UNDER_PAID_PACKAGE_EMAIL_BODY({
      currentTenantOrg: this.getCurrentTenantOrg(),
      userEmail: this.getUserEmail(),
    });

    const mailtoUrl = `mailto:${adminEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }

  /**
   * Handles failure on billing page trigger flow
   * Shows error toast message
   */
  public handleFailureOnBillingPageTriggerFlow(): void {
    toast.error(SUBSCRIPTION_MESSAGES.TOAST_MESSAGES.BILLING_PAGE_TRIGGER_LOAD_ERROR);
  }
}
