import { TopBannerProps } from '@iblai/iblai-js/web-containers';
import { createSlice, type PayloadAction, Slice } from '@reduxjs/toolkit';

interface topBannerOptions extends TopBannerProps {
  enabled: boolean;
  onUpgrade?: string;
}

export interface TopTrialBannerState {
  topBannerOptions: topBannerOptions;
}

const initialState: TopTrialBannerState = {
  topBannerOptions: {
    bannerText: '',
    loading: false,
    enabled: false,
    parentContainerSelector: '',
  },
};

const topBannerSlice: Slice<TopTrialBannerState> = createSlice({
  name: 'topBanner',
  initialState,
  reducers: {
    setTopBannerOptions(state, action: PayloadAction<topBannerOptions>) {
      state.topBannerOptions = {
        ...state.topBannerOptions,
        ...action.payload,
      };
    },
  },
});

export const { setTopBannerOptions } = topBannerSlice.actions;

export default topBannerSlice;
