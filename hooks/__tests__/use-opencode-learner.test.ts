import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOpencodeLearner } from '../use-opencode-learner';

/**
 * The learner sync must run at the app root, before any chat surface can send a
 * Code turn: the Rust proxy attributes model usage via the `learner_id` it holds,
 * so what matters is that the username reaches it on load, follows login/logout,
 * and never leaks an invoke outside the desktop app.
 */

const { invoke, inTauri, username } = vi.hoisted(() => ({
  invoke: vi.fn(),
  inTauri: { current: true },
  username: { current: null as string | null },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => inTauri.current,
}));
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => username.current,
}));

describe('useOpencodeLearner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue(undefined);
    inTauri.current = true;
    username.current = null;
  });

  it('tells the backend who is signed in', async () => {
    username.current = 'myuser';
    renderHook(() => useOpencodeLearner());

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_opencode_learner', {
        username: 'myuser',
      }),
    );
  });

  it('sends an empty learner while signed out, clearing any stale one', async () => {
    renderHook(() => useOpencodeLearner());

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_opencode_learner', {
        username: '',
      }),
    );
  });

  it('re-sends when the signed-in user changes', async () => {
    username.current = 'first';
    const { rerender } = renderHook(() => useOpencodeLearner());
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_opencode_learner', {
        username: 'first',
      }),
    );

    username.current = 'second';
    rerender();

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_opencode_learner', {
        username: 'second',
      }),
    );
  });

  it('does nothing outside the desktop app', async () => {
    inTauri.current = false;
    username.current = 'myuser';
    renderHook(() => useOpencodeLearner());

    // Give a would-be invoke a tick to happen, then insist it did not.
    await new Promise((r) => setTimeout(r, 0));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('logs and moves on when the backend rejects it', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    username.current = 'myuser';
    invoke.mockRejectedValue(new Error('ipc down'));
    renderHook(() => useOpencodeLearner());

    await waitFor(() =>
      expect(err).toHaveBeenCalledWith(
        '[opencode] failed to set learner',
        expect.any(Error),
      ),
    );
    err.mockRestore();
  });
});
