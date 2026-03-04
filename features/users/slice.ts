import { createSlice, PayloadAction, Slice } from '@reduxjs/toolkit/react';

export interface InitialState {
  isInstructorMode: boolean;
}

const initialState: InitialState = {
  isInstructorMode: true,
};

export const userSlice: Slice<InitialState> = createSlice({
  name: 'userSlice',
  initialState,
  reducers: {
    setIsInstructorMode: (state, action: PayloadAction<boolean>) => {
      state.isInstructorMode = action.payload;
    },
  },
});

export const userSliceActions = userSlice.actions;

export const userReducer = userSlice.reducer;
