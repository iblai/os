// features/user/userSlice.ts
import { createSlice, PayloadAction, Slice } from '@reduxjs/toolkit';

export type AppState = {
  sessionId: string;
};

const initialState: AppState = {
  sessionId: '',
};

export const appSlice: Slice<AppState> = createSlice({
  name: 'app',
  initialState,
  reducers: {
    updateSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload;
    },
  },
});

export const { updateSessionId } = appSlice.actions;

export default appSlice.reducer;
