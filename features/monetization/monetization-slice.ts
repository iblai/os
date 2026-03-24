import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Slice } from "@reduxjs/toolkit/react";
import type { AccessCheckResponse } from "@iblai/iblai-js/data-layer";

interface MonetizationState {
  displayMonetizationCheckoutModal: boolean;
  accessCheckResponse: AccessCheckResponse | null;
}

const initialState: MonetizationState = {
  displayMonetizationCheckoutModal: false,
  accessCheckResponse: null,
};

export const monetizationSlice: Slice = createSlice({
  name: "monetization",
  initialState,
  reducers: {
    setDisplayMonetizationCheckoutModal(state, action: PayloadAction<boolean>) {
      state.displayMonetizationCheckoutModal = action.payload;
      if (!action.payload) {
        state.accessCheckResponse = null;
      }
    },
    setAccessCheckResponse(
      state,
      action: PayloadAction<AccessCheckResponse | null>,
    ) {
      state.accessCheckResponse = action.payload;
    },
    showMonetizationCheckoutModal(
      state,
      action: PayloadAction<AccessCheckResponse>,
    ) {
      state.displayMonetizationCheckoutModal = true;
      state.accessCheckResponse = action.payload;
    },
  },
});

export const {
  setDisplayMonetizationCheckoutModal,
  setAccessCheckResponse,
  showMonetizationCheckoutModal,
} = monetizationSlice.actions;

export default monetizationSlice;
