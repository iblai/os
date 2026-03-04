import { describe, it, expect } from 'vitest';
import appReducer, { updateSessionId, appSlice, type AppState } from '../app-slice';

describe('appSlice', () => {
  describe('initial state', () => {
    it('should have empty sessionId', () => {
      const state = appReducer(undefined, { type: 'unknown' });
      expect(state.sessionId).toBe('');
    });

    it('should return the initial state when no action matches', () => {
      const state = appReducer(undefined, { type: 'unknown' });
      expect(state).toEqual({ sessionId: '' });
    });
  });

  describe('updateSessionId', () => {
    it('should update sessionId with the payload', () => {
      const initialState: AppState = { sessionId: '' };
      const newSessionId = 'test-session-123';

      const state = appReducer(initialState, updateSessionId(newSessionId));

      expect(state.sessionId).toBe(newSessionId);
    });

    it('should update sessionId when there is an existing value', () => {
      const initialState: AppState = { sessionId: 'old-session' };
      const newSessionId = 'new-session-456';

      const state = appReducer(initialState, updateSessionId(newSessionId));

      expect(state.sessionId).toBe(newSessionId);
    });

    it('should handle empty string payload', () => {
      const initialState: AppState = { sessionId: 'existing-session' };

      const state = appReducer(initialState, updateSessionId(''));

      expect(state.sessionId).toBe('');
    });

    it('should handle UUID-like session IDs', () => {
      const initialState: AppState = { sessionId: '' };
      const uuidSessionId = '550e8400-e29b-41d4-a716-446655440000';

      const state = appReducer(initialState, updateSessionId(uuidSessionId));

      expect(state.sessionId).toBe(uuidSessionId);
    });

    it('should handle special characters in session ID', () => {
      const initialState: AppState = { sessionId: '' };
      const specialSessionId = 'session_with-special.chars:123';

      const state = appReducer(initialState, updateSessionId(specialSessionId));

      expect(state.sessionId).toBe(specialSessionId);
    });

    it('should not mutate the original state', () => {
      const initialState: AppState = { sessionId: 'original' };
      const originalCopy = { ...initialState };

      appReducer(initialState, updateSessionId('new-session'));

      // Original state should remain unchanged (Immer handles immutability)
      expect(originalCopy.sessionId).toBe('original');
    });
  });

  describe('slice configuration', () => {
    it('should have the correct name', () => {
      expect(appSlice.name).toBe('app');
    });

    it('should export the updateSessionId action', () => {
      expect(updateSessionId).toBeDefined();
      expect(typeof updateSessionId).toBe('function');
    });

    it('should create action with correct type', () => {
      const action = updateSessionId('test-session');
      expect(action.type).toBe('app/updateSessionId');
      expect(action.payload).toBe('test-session');
    });
  });

  describe('reducer immutability', () => {
    it('should return a new state object', () => {
      const initialState: AppState = { sessionId: 'initial' };
      const newState = appReducer(initialState, updateSessionId('new'));

      expect(newState).not.toBe(initialState);
    });
  });
});
