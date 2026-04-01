import { createSlice, PayloadAction, Slice } from '@reduxjs/toolkit';
import { SUBSCRIPTION_V2_TRIGGERS } from '@iblai/iblai-js/web-utils';
import { SUBSCRIPTION_USER_CAPABILITIES } from './constants';

// Local type definition until web-utils build is fixed
interface PricingModalData {
  referenceId: string;
  customerEmail: string;
  publishableKey: string;
  pricingTableId: string;
}

interface FreeTrialUsageOptions {
  count: number;
  limitReached: boolean;
  message: string;
}

interface SubscriptionStatus {
  creditExhausted: boolean;
  userCapability?: string;
  callToAction?: string;
}

interface SubscriptionState {
  openPricingModal: boolean;
  openAppleRestrictionModal: boolean;
  freeTrialUsageOptions: FreeTrialUsageOptions;
  pricingModalData: PricingModalData;
  subscriptionStatus: SubscriptionStatus;
  error402Detected: string;
}

const initialState: SubscriptionState = {
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

export const subscriptionSlice: Slice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    setOpenPricingModal(state, action: PayloadAction<boolean>) {
      state.openPricingModal = action.payload;
    },
    setOpenAppleRestrictionModal(state, action: PayloadAction<boolean>) {
      state.openAppleRestrictionModal = action.payload;
    },
    setFreeTrialUsageOptions(
      state,
      action: PayloadAction<FreeTrialUsageOptions>,
    ) {
      state.freeTrialUsageOptions = action.payload;
    },
    setPricingModalData(state, action: PayloadAction<PricingModalData>) {
      state.pricingModalData = action.payload;
    },
    setSubscriptionStatus(state, action: PayloadAction<SubscriptionStatus>) {
      state.subscriptionStatus = action.payload;
    },
    setError402Detected(state, action: PayloadAction<string>) {
      state.error402Detected = action.payload;
    },
  },
});

export const {
  setOpenPricingModal,
  setOpenAppleRestrictionModal,
  setFreeTrialUsageOptions,
  setPricingModalData,
  setSubscriptionStatus,
  setError402Detected,
} = subscriptionSlice.actions;

export default subscriptionSlice;
