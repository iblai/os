import { createSlice, PayloadAction, Slice } from '@reduxjs/toolkit/react';

export type SelectedMentor = {
  slug: string;
  name: string;
  profileImage: string;
  unique_id: string;
  id?: string;
} | null;

export interface AnalyticsState {
  selectedMentor: SelectedMentor;
}

const initialState: AnalyticsState = {
  selectedMentor: null,
};

export const analyticsSlice: Slice<AnalyticsState> = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setSelectedMentor: (state, action: PayloadAction<SelectedMentor>) => {
      state.selectedMentor = action.payload;
    },
  },
});

export const analyticsActions = analyticsSlice.actions;

export const selectSelectedMentor = (state: { analytics: AnalyticsState }) =>
  state.analytics.selectedMentor;

export const analyticsReducer = analyticsSlice.reducer;
