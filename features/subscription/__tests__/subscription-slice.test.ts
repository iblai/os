import { describe, it, expect } from 'vitest';
import subscriptionSlice, {
  setOpenPricingModal,
  setOpenAppleRestrictionModal,
  setFreeTrialUsageOptions,
  setPricingModalData,
  setSubscriptionStatus,
  setError402Detected,
} from '../subscription-slice';
import { SUBSCRIPTION_USER_CAPABILITIES } from '../constants';
import { SUBSCRIPTION_V2_TRIGGERS } from '@iblai/iblai-js/web-utils';

describe('subscription/subscription-slice', () => {
  const initialState = {
    openPricingModal: false,
    openAppleRestrictionModal: false,
    freeTrialUsageOptions: {
      count: 0,
      limitReached: false,
      message: '',
    },
    pricingModalData: {
      referenceId: '',
      customerEmail: '',
      publishableKey: '',
      pricingTableId: '',
    },
    subscriptionStatus: {
      creditExhausted: false,
      userCapability: SUBSCRIPTION_USER_CAPABILITIES.FREE_TRIAL,
      callToAction: SUBSCRIPTION_V2_TRIGGERS.PRICING_MODAL,
    },
    error402Detected: '',
  };

  describe('reducer', () => {
    it('should return the initial state', () => {
      expect(subscriptionSlice.reducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('setOpenAppleRestrictionModal', () => {
    it('should set openAppleRestrictionModal to true', () => {
      const state = subscriptionSlice.reducer(initialState, setOpenAppleRestrictionModal(true));

      expect(state.openAppleRestrictionModal).toBe(true);
    });

    it('should set openAppleRestrictionModal to false', () => {
      const modifiedState = { ...initialState, openAppleRestrictionModal: true };
      const state = subscriptionSlice.reducer(modifiedState, setOpenAppleRestrictionModal(false));

      expect(state.openAppleRestrictionModal).toBe(false);
    });
  });

  describe('setOpenPricingModal', () => {
    it('should set openPricingModal to true', () => {
      const state = subscriptionSlice.reducer(initialState, setOpenPricingModal(true));

      expect(state.openPricingModal).toBe(true);
    });

    it('should set openPricingModal to false', () => {
      const modifiedState = { ...initialState, openPricingModal: true };
      const state = subscriptionSlice.reducer(modifiedState, setOpenPricingModal(false));

      expect(state.openPricingModal).toBe(false);
    });
  });

  describe('setFreeTrialUsageOptions', () => {
    it('should update free trial usage options', () => {
      const usageOptions = {
        count: 5,
        limitReached: true,
        message: 'Limit reached',
      };

      const state = subscriptionSlice.reducer(initialState, setFreeTrialUsageOptions(usageOptions));

      expect(state.freeTrialUsageOptions).toEqual(usageOptions);
    });

    it('should override all usage option fields', () => {
      const newOptions = {
        count: 10,
        limitReached: false,
        message: 'New message',
      };

      const state = subscriptionSlice.reducer(initialState, setFreeTrialUsageOptions(newOptions));

      expect(state.freeTrialUsageOptions.count).toBe(10);
      expect(state.freeTrialUsageOptions.limitReached).toBe(false);
      expect(state.freeTrialUsageOptions.message).toBe('New message');
    });
  });

  describe('setPricingModalData', () => {
    it('should update pricing modal data', () => {
      const modalData = {
        referenceId: 'ref-123',
        customerEmail: 'test@example.com',
        publishableKey: 'pk_test_123',
        pricingTableId: 'table-123',
      };

      const state = subscriptionSlice.reducer(initialState, setPricingModalData(modalData));

      expect(state.pricingModalData).toEqual(modalData);
    });

    it('should override all modal data fields', () => {
      const newData = {
        referenceId: 'new-ref',
        customerEmail: 'new@example.com',
        publishableKey: 'pk_new',
        pricingTableId: 'new-table',
      };

      const state = subscriptionSlice.reducer(initialState, setPricingModalData(newData));

      expect(state.pricingModalData.referenceId).toBe('new-ref');
      expect(state.pricingModalData.customerEmail).toBe('new@example.com');
      expect(state.pricingModalData.publishableKey).toBe('pk_new');
      expect(state.pricingModalData.pricingTableId).toBe('new-table');
    });
  });

  describe('setSubscriptionStatus', () => {
    it('should update subscription status', () => {
      const status = {
        creditExhausted: true,
        userCapability: SUBSCRIPTION_USER_CAPABILITIES.PAID_PACKAGE,
        callToAction: SUBSCRIPTION_V2_TRIGGERS.TOP_UP_CREDIT,
      };

      const state = subscriptionSlice.reducer(initialState, setSubscriptionStatus(status));

      expect(state.subscriptionStatus).toEqual(status);
    });

    it('should handle partial status updates', () => {
      const status = {
        creditExhausted: true,
      };

      const state = subscriptionSlice.reducer(initialState, setSubscriptionStatus(status as any));

      expect(state.subscriptionStatus.creditExhausted).toBe(true);
    });
  });

  describe('setError402Detected', () => {
    it('should set error 402 detected message', () => {
      const errorMessage = 'Payment required';

      const state = subscriptionSlice.reducer(initialState, setError402Detected(errorMessage));

      expect(state.error402Detected).toBe(errorMessage);
    });

    it('should clear error 402 detected message', () => {
      const modifiedState = { ...initialState, error402Detected: 'Previous error' };
      const state = subscriptionSlice.reducer(modifiedState, setError402Detected(''));

      expect(state.error402Detected).toBe('');
    });
  });

  describe('slice metadata', () => {
    it('should have correct slice name', () => {
      expect(subscriptionSlice.name).toBe('subscription');
    });

    it('should export all action creators', () => {
      expect(setOpenPricingModal).toBeDefined();
      expect(setOpenAppleRestrictionModal).toBeDefined();
      expect(setFreeTrialUsageOptions).toBeDefined();
      expect(setPricingModalData).toBeDefined();
      expect(setSubscriptionStatus).toBeDefined();
      expect(setError402Detected).toBeDefined();
    });
  });
});
