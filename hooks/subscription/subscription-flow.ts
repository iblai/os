import { setOpenPricingModal } from '@/features/subscription/subscription-slice';
import { TRIGGERS } from '@/features/top-banner/constants';
import { setTopBannerOptions } from '@/features/top-banner/top-banner-slice';
import type { FreeUsageCount } from '@iblai/iblai-api';
import { toast } from 'sonner';
import { SubscriptionFlowConfig as IblSubscriptionFlowConfig } from '@iblai/iblai-js/web-utils';
import { SubscriptionFlow as IblSubscriptionFlow } from '@iblai/iblai-js/web-utils';
import { Dispatch, SetStateAction } from 'react';

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
}

/**
 * SubscriptionFlow class manages all subscription-related flows and user interactions
 * Handles free trial, usage limits, and subscription management
 */
export class mentorSubscriptionFlow extends IblSubscriptionFlow {
  private dispatch: Dispatch<SetStateAction<any>>;
  private topBannerOptions: any;

  // Default banner configuration for subscription prompts
  private bannerOptions = {
    enabled: true,
    bannerText:
      'Upgrade to create your own mentors. No credit card required 😎',
    onUpgrade: TRIGGERS.PRICING_MODAL,
    parentContainerSelector: '.mentor-parent-container',
  };

  constructor(config: SubscriptionFlowConfig) {
    super(config);
    this.dispatch = config.dispatch;
    this.topBannerOptions = config.topBannerOptions;
  }

  // Getter methods for class properties
  public getPlatformName(): string {
    return this.platformName;
  }

  public getCurrentTenantKey(): string {
    return this.currentTenantKey;
  }

  public getUsername(): string {
    return this.username;
  }

  public getCurrentTenantOrg(): string {
    return this.currentTenantOrg;
  }

  public getUserTenants(): Tenant[] {
    return this.userTenants;
  }

  public isUserAdmin(): boolean {
    return this.isAdmin;
  }

  /**
   * Handles the flow when user reaches their free usage limit
   * Updates banner with appropriate message based on remaining usage count
   */
  public handleFreeUsageCountFlow(freeUsageCount: FreeUsageCount): void {
    if (!freeUsageCount) return;
    const freeTrialLimitMessage =
      'You have reached your free trial limit. Please upgrade to continue and create your own mentors. No credit card required 😎';
    const tooltipText =
      freeUsageCount.count < 1
        ? freeTrialLimitMessage
        : `You have ${freeUsageCount.count} free chat left.`;
    const updatedBannerOptions = {
      ...this.bannerOptions,
      tooltipText,
      ...(freeUsageCount.count < 1 && { bannerText: freeTrialLimitMessage }),
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
  }

  /**
   * Handles the flow when user's free trial period has ended
   * Updates banner and clears any existing trial interval
   */
  public handleTrialEndedFlow(freeTrialIntervalID?: number): void {
    const tooltipText = `Your free trial has ended. Please upgrade to continue using mentorAI 😎.`;
    const updatedBannerOptions = {
      ...this.bannerOptions,
      tooltipText,
      bannerText: tooltipText,
      onUpgrade: TRIGGERS.SUBSCRIBE_USER,
    };
    toast.error(tooltipText);
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    if (freeTrialIntervalID) {
      clearInterval(freeTrialIntervalID);
    }
  }

  /**
   * Handles the flow for ongoing subscription period
   * Updates banner with remaining trial time and subscription options
   */
  public handleSubscriptionOnGoingFlow(timeRemainingInString: string): void {
    const tooltipValue = `You're on a free trial for the next ${timeRemainingInString}. Upgrade to a paid plan 💪`;
    const updatedBannerOptions = {
      ...this.bannerOptions,
      tooltipText: tooltipValue,
      bannerText: tooltipValue,
      enabled: true,
      buttonLabel: 'Subscribe',
      onUpgrade: TRIGGERS.SUBSCRIBE_USER,
    };
    this.dispatch(setTopBannerOptions(updatedBannerOptions));
    toast.info(tooltipValue);
  }

  /**
   * Handles redirection to external URLs with optional toast notification
   */
  public handleRedirectToURLFlow(
    redirectUrl: string,
    toastMessage?: string,
  ): void {
    if (toastMessage) {
      toast.info(toastMessage);
    }
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 500);
  }

  /**
   * Displays the pricing modal for subscription options
   */
  public handlePricingPageDisplayFlow(): void {
    this.dispatch(setOpenPricingModal(true));
  }

  /**
   * Handles the pre-subscription state
   * Updates banner to show loading state
   */
  public handleBeforeSubscribeUserTriggerFlow(): void {
    this.dispatch(
      setTopBannerOptions({ ...this.topBannerOptions, loading: true }),
    );
  }

  /**
   * Handles successful subscription completion
   * Shows success message and disables subscription banner
   */
  public handleSuccessfullySubscribedFlow(message?: string): void {
    toast.success(message || 'Subscription renewed successfully.');
    this.dispatch(
      setTopBannerOptions({ ...this.topBannerOptions, enabled: false }),
    );
  }

  public getMainTenantKey(): string {
    return this.mainTenantKey;
  }
}
