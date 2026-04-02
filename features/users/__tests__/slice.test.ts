import { describe, it, expect } from 'vitest';
import { userReducer, userSliceActions, type InitialState } from '../slice';

describe('users slice', () => {
  const initialState: InitialState = {
    isInstructorMode: true,
  };

  describe('initial state', () => {
    it('should have isInstructorMode as true', () => {
      const state = userReducer(undefined, { type: '@@INIT' });
      expect(state.isInstructorMode).toBe(true);
    });
  });

  describe('setIsInstructorMode', () => {
    it('should set instructor mode to false', () => {
      const state = userReducer(
        initialState,
        userSliceActions.setIsInstructorMode(false),
      );
      expect(state.isInstructorMode).toBe(false);
    });

    it('should set instructor mode to true', () => {
      const stateWithFalse = { isInstructorMode: false };
      const state = userReducer(
        stateWithFalse,
        userSliceActions.setIsInstructorMode(true),
      );
      expect(state.isInstructorMode).toBe(true);
    });

    it('should toggle instructor mode', () => {
      let state = userReducer(
        initialState,
        userSliceActions.setIsInstructorMode(false),
      );
      expect(state.isInstructorMode).toBe(false);

      state = userReducer(state, userSliceActions.setIsInstructorMode(true));
      expect(state.isInstructorMode).toBe(true);
    });
  });
});
