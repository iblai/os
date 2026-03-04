import { describe, it, expect } from 'vitest';
import { store, type RootState, type AppDispatch } from '../index';

describe('mentor store', () => {
  it('should create store instance', () => {
    expect(store).toBeDefined();
    expect(store.getState).toBeDefined();
    expect(store.dispatch).toBeDefined();
  });

  it('should have all required reducers', () => {
    const state = store.getState() as RootState;

    expect(state).toHaveProperty('modals');
    expect(state).toHaveProperty('user');
    expect(state).toHaveProperty('chat');
    expect(state).toHaveProperty('files');
    expect(state).toHaveProperty('chatSliceShared');
    expect(state).toHaveProperty('analytics');
    expect(state).toHaveProperty('chatInput');
    expect(state).toHaveProperty('app');
    expect(state).toHaveProperty('rbac');
    expect(state).toHaveProperty('topBanner');
    expect(state).toHaveProperty('subscription');
  });

  it('should have initial state for slices', () => {
    const state = store.getState() as RootState;

    expect(state.modals).toBeDefined();
    expect(state.user).toBeDefined();
    expect(state.chat).toBeDefined();
    expect(state.files).toBeDefined();
    expect(state.analytics).toBeDefined();
  });

  it('should export RootState type', () => {
    const state: RootState = store.getState();
    expect(state).toBeDefined();
  });

  it('should export AppDispatch type', () => {
    const dispatch: AppDispatch = store.dispatch;
    expect(dispatch).toBeDefined();
    expect(typeof dispatch).toBe('function');
  });

  it('should allow dispatching actions', () => {
    expect(() => {
      store.dispatch({ type: 'test/action' });
    }).not.toThrow();
  });
});
