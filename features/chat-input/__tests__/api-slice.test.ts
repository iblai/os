import { describe, it, expect, beforeEach } from 'vitest';
import {
  chatInputSlice,
  chatInputSliceActions,
  chatInputSliceSelectors,
  chatInputSliceReducer,
  ChatInputState,
} from '../api-slice';

describe('chatInputSlice', () => {
  let initialState: ChatInputState;

  beforeEach(() => {
    initialState = {
      textareaInput: '',
    };
  });

  describe('initial state', () => {
    it('should have empty textareaInput', () => {
      const state = chatInputSliceReducer(undefined, { type: 'unknown' });
      expect(state.textareaInput).toBe('');
    });
  });

  describe('setTextareaInput', () => {
    it('should set textarea input value', () => {
      const state = chatInputSliceReducer(
        initialState,
        chatInputSliceActions.setTextareaInput('Hello, world!'),
      );
      expect(state.textareaInput).toBe('Hello, world!');
    });

    it('should replace existing input', () => {
      const stateWithInput = { textareaInput: 'Old text' };
      const state = chatInputSliceReducer(
        stateWithInput,
        chatInputSliceActions.setTextareaInput('New text'),
      );
      expect(state.textareaInput).toBe('New text');
    });

    it('should handle empty string', () => {
      const stateWithInput = { textareaInput: 'Some text' };
      const state = chatInputSliceReducer(
        stateWithInput,
        chatInputSliceActions.setTextareaInput(''),
      );
      expect(state.textareaInput).toBe('');
    });

    it('should handle long text', () => {
      const longText = 'A'.repeat(10000);
      const state = chatInputSliceReducer(
        initialState,
        chatInputSliceActions.setTextareaInput(longText),
      );
      expect(state.textareaInput).toBe(longText);
    });

    it('should handle special characters', () => {
      const specialText = '!@#$%^&*()_+{}[]|\\:";\'<>?,./`~';
      const state = chatInputSliceReducer(
        initialState,
        chatInputSliceActions.setTextareaInput(specialText),
      );
      expect(state.textareaInput).toBe(specialText);
    });

    it('should handle multiline text', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      const state = chatInputSliceReducer(
        initialState,
        chatInputSliceActions.setTextareaInput(multilineText),
      );
      expect(state.textareaInput).toBe(multilineText);
    });

    it('should handle unicode characters', () => {
      const unicodeText = '你好世界 🌍 مرحبا';
      const state = chatInputSliceReducer(
        initialState,
        chatInputSliceActions.setTextareaInput(unicodeText),
      );
      expect(state.textareaInput).toBe(unicodeText);
    });
  });

  describe('clearTextareaInput', () => {
    it('should clear textarea input', () => {
      const stateWithInput = { textareaInput: 'Some text' };
      const state = chatInputSliceReducer(
        stateWithInput,
        chatInputSliceActions.clearTextareaInput(undefined),
      );
      expect(state.textareaInput).toBe('');
    });

    it('should work when already empty', () => {
      const state = chatInputSliceReducer(
        initialState,
        chatInputSliceActions.clearTextareaInput(undefined),
      );
      expect(state.textareaInput).toBe('');
    });

    it('should clear long text', () => {
      const stateWithLongText = { textareaInput: 'A'.repeat(10000) };
      const state = chatInputSliceReducer(
        stateWithLongText,
        chatInputSliceActions.clearTextareaInput(undefined),
      );
      expect(state.textareaInput).toBe('');
    });
  });

  describe('selectors', () => {
    describe('selectTextareaInput', () => {
      it('should select textarea input', () => {
        const rootState = { chatInput: { textareaInput: 'Test input' } };
        expect(chatInputSliceSelectors.selectTextareaInput(rootState)).toBe('Test input');
      });

      it('should return empty string when input is empty', () => {
        const rootState = { chatInput: { textareaInput: '' } };
        expect(chatInputSliceSelectors.selectTextareaInput(rootState)).toBe('');
      });
    });
  });

  describe('slice configuration', () => {
    it('should have correct slice name', () => {
      expect(chatInputSlice.name).toBe('chatInput');
    });

    it('should export actions', () => {
      expect(chatInputSliceActions.setTextareaInput).toBeDefined();
      expect(chatInputSliceActions.clearTextareaInput).toBeDefined();
    });

    it('should export reducer', () => {
      expect(typeof chatInputSliceReducer).toBe('function');
    });
  });
});
