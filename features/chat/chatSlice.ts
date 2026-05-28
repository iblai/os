import { createSlice, Slice, type PayloadAction } from '@reduxjs/toolkit';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatState {
  messages: Message[];
  enableChatActionsPopup: boolean;
  autoplayLastAiMessage: boolean;
}

const initialState: ChatState = {
  messages: [],
  enableChatActionsPopup: false,
  autoplayLastAiMessage: false,
};

export const chatSlice: Slice<ChatState> = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    enableChatActionsPopup: (state, action: PayloadAction<boolean>) => {
      state.enableChatActionsPopup = action.payload;
    },
    setAutoplayLastAiMessage: (state, action: PayloadAction<boolean>) => {
      state.autoplayLastAiMessage = action.payload;
    },
  },
});

export const {
  addMessage,
  clearMessages,
  enableChatActionsPopup,
  setAutoplayLastAiMessage,
} = chatSlice.actions;

export const chatReducer = chatSlice.reducer;

export const selectEnableChatActionsPopup = (state) =>
  state.chat.enableChatActionsPopup;

export const selectAutoplayLastAiMessage = (state) =>
  state.chat.autoplayLastAiMessage;
