import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOpencodeLearner } from '../use-opencode-learner';

/**
 * The learner sync must run at the app root, before any chat surface can send a
 * Code turn: the Rust proxy attributes model usage via the `learner_id` it holds,
 * and the agent's identity lines and its platform-key minting both depend on the
 * email and DM host that ride along here. What matters is that all three reach
 * the backend on load, follow login/logout, and never leak an invoke outside the
 * desktop app.
 */

const { invoke, inTauri, username, email } = vi.hoisted(() => ({
  invoke: vi.fn(),
  inTauri: { current: true },
  username: { current: null as string | null },
  email: { current: null as string | null },
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
vi.mock('@/features/utils', () => ({
  getUserEmail: () => email.current,
}));
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    config: { ...actual.config, dmUrl: () => 'https://dm.test/dm' },
  };
});

describe('useOpencodeLearner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue(undefined);
    inTauri.current = true;
    username.current = null;
    email.current = null;
  });

  it('tells the backend who is signed in, and how to reach DM', async () => {
    username.current = 'myuser';
    email.current = 'myuser@example.com';
    renderHook(() => useOpencodeLearner());

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_opencode_learner', {
        username: 'myuser',
        email: 'myuser@example.com',
        // The backend only ever sees the completions host otherwise, which
        // does not serve the API that mints the agent's platform key.
        dmBase: 'https://dm.test/dm',
      }),
    );
  });

  it('sends an empty learner while signed out, clearing any stale one', async () => {
    // A stale email would outlive the session it belongs to, so it goes too.
    email.current = 'left@example.com';
    renderHook(() => useOpencodeLearner());

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_opencode_learner', {
        username: '',
        email: '',
        dmBase: 'https://dm.test/dm',
      }),
    );
  });

  it('sends an empty email when the signed-in user has none stored', async () => {
    username.current = 'myuser';
    renderHook(() => useOpencodeLearner());

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('set_opencode_learner', {
        username: 'myuser',
        email: '',
        dmBase: 'https://dm.test/dm',
      }),
    );
  });

  it('re-sends when the signed-in user changes', async () => {
    username.current = 'first';
    const { rerender } = renderHook(() => useOpencodeLearner());
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        'set_opencode_learner',
        expect.objectContaining({ username: 'first' }),
      ),
    );

    username.current = 'second';
    rerender();

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        'set_opencode_learner',
        expect.objectContaining({ username: 'second' }),
      ),
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
