import { createSlice, Slice, type PayloadAction } from '@reduxjs/toolkit/react';

export interface ChatInputState {
  textareaInput: string;
}

const initialState: ChatInputState = {
  textareaInput: '',
};

export const chatInputSlice: Slice<ChatInputState> = createSlice({
  name: 'chatInput',

  initialState,

  reducers: {
    setTextareaInput: (state, action: PayloadAction<string>) => {
      state.textareaInput = action.payload;
    },

    clearTextareaInput: (state) => {
      state.textareaInput = '';
    },
  },
});

export const chatInputSliceSelectors = {
  selectTextareaInput: (state: { chatInput: ChatInputState }) =>
    state.chatInput.textareaInput,
};

export const chatInputSliceActions = chatInputSlice.actions;

export const chatInputSliceReducer = chatInputSlice.reducer;
