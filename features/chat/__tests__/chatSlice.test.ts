import { describe, it, expect } from 'vitest';
import {
  chatSlice,
  chatReducer,
  addMessage,
  clearMessages,
  enableChatActionsPopup,
  selectEnableChatActionsPopup,
  setAutoplayLastAiMessage,
  selectAutoplayLastAiMessage,
  type ChatState,
} from '../chatSlice';

describe('chat/chatSlice', () => {
  const initialState: ChatState = {
    messages: [],
    enableChatActionsPopup: false,
    autoplayLastAiMessage: false,
  };

  describe('reducer', () => {
    it('should return the initial state', () => {
      expect(chatReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('addMessage', () => {
    it('should add a user message to the messages array', () => {
      const message = {
        role: 'user' as const,
        content: 'Hello, how are you?',
      };

      const state = chatReducer(initialState, addMessage(message));

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toEqual(message);
    });

    it('should add an assistant message to the messages array', () => {
      const message = {
        role: 'assistant' as const,
        content: 'I am doing well, thank you!',
      };

      const state = chatReducer(initialState, addMessage(message));

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0]).toEqual(message);
    });

    it('should append messages to existing messages', () => {
      const existingState = {
        ...initialState,
        messages: [{ role: 'user' as const, content: 'First message' }],
      };

      const newMessage = {
        role: 'assistant' as const,
        content: 'Second message',
      };

      const state = chatReducer(existingState, addMessage(newMessage));

      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].content).toBe('First message');
      expect(state.messages[1].content).toBe('Second message');
    });

    it('should maintain message order', () => {
      let state = initialState;

      state = chatReducer(
        state,
        addMessage({ role: 'user', content: 'Message 1' }),
      );
      state = chatReducer(
        state,
        addMessage({ role: 'assistant', content: 'Message 2' }),
      );
      state = chatReducer(
        state,
        addMessage({ role: 'user', content: 'Message 3' }),
      );

      expect(state.messages).toHaveLength(3);
      expect(state.messages[0].content).toBe('Message 1');
      expect(state.messages[1].content).toBe('Message 2');
      expect(state.messages[2].content).toBe('Message 3');
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages', () => {
      const stateWithMessages = {
        ...initialState,
        messages: [
          { role: 'user' as const, content: 'Message 1' },
          { role: 'assistant' as const, content: 'Message 2' },
        ],
      };

      const state = chatReducer(stateWithMessages, clearMessages(undefined));

      expect(state.messages).toHaveLength(0);
      expect(state.messages).toEqual([]);
    });

    it('should not affect empty messages array', () => {
      const state = chatReducer(initialState, clearMessages(undefined));

      expect(state.messages).toHaveLength(0);
      expect(state.messages).toEqual([]);
    });

    it('should not affect enableChatActionsPopup', () => {
      const stateWithPopup = {
        messages: [{ role: 'user' as const, content: 'Test' }],
        enableChatActionsPopup: true,
        autoplayLastAiMessage: false,
      };

      const state = chatReducer(stateWithPopup, clearMessages(undefined));

      expect(state.enableChatActionsPopup).toBe(true);
    });
  });

  describe('enableChatActionsPopup', () => {
    it('should enable chat actions popup', () => {
      const state = chatReducer(initialState, enableChatActionsPopup(true));

      expect(state.enableChatActionsPopup).toBe(true);
    });

    it('should disable chat actions popup', () => {
      const stateWithPopup = {
        ...initialState,
        enableChatActionsPopup: true,
      };

      const state = chatReducer(stateWithPopup, enableChatActionsPopup(false));

      expect(state.enableChatActionsPopup).toBe(false);
    });

    it('should not affect messages array', () => {
      const stateWithMessages = {
        messages: [{ role: 'user' as const, content: 'Test message' }],
        enableChatActionsPopup: false,
        autoplayLastAiMessage: false,
      };

      const state = chatReducer(
        stateWithMessages,
        enableChatActionsPopup(true),
      );

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].content).toBe('Test message');
    });
  });

  describe('selectEnableChatActionsPopup', () => {
    it('should select enableChatActionsPopup from state', () => {
      const mockState = {
        chat: {
          messages: [],
          enableChatActionsPopup: true,
          autoplayLastAiMessage: false,
        },
      };

      const result = selectEnableChatActionsPopup(mockState);

      expect(result).toBe(true);
    });

    it('should select false when popup is disabled', () => {
      const mockState = {
        chat: {
          messages: [],
          enableChatActionsPopup: false,
          autoplayLastAiMessage: false,
        },
      };

      const result = selectEnableChatActionsPopup(mockState);

      expect(result).toBe(false);
    });
  });

  describe('setAutoplayLastAiMessage', () => {
    it('should enable autoplay', () => {
      const state = chatReducer(initialState, setAutoplayLastAiMessage(true));

      expect(state.autoplayLastAiMessage).toBe(true);
    });

    it('should disable autoplay', () => {
      const enabledState = {
        ...initialState,
        autoplayLastAiMessage: true,
      };

      const state = chatReducer(enabledState, setAutoplayLastAiMessage(false));

      expect(state.autoplayLastAiMessage).toBe(false);
    });
  });

  describe('selectAutoplayLastAiMessage', () => {
    it('should select autoplayLastAiMessage from state', () => {
      const mockState = {
        chat: {
          messages: [],
          enableChatActionsPopup: false,
          autoplayLastAiMessage: true,
        },
      };

      expect(selectAutoplayLastAiMessage(mockState)).toBe(true);
    });
  });

  describe('slice metadata', () => {
    it('should have correct slice name', () => {
      expect(chatSlice.name).toBe('chat');
    });

    it('should export all action creators', () => {
      expect(addMessage).toBeDefined();
      expect(clearMessages).toBeDefined();
      expect(enableChatActionsPopup).toBeDefined();
      expect(setAutoplayLastAiMessage).toBeDefined();
    });

    it('should export reducer', () => {
      expect(chatReducer).toBeDefined();
      expect(typeof chatReducer).toBe('function');
    });
  });
});
