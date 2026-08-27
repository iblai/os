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

const { invoke, inTauri, username, email, authUrlEnv } = vi.hoisted(() => ({
  invoke: vi.fn(),
  inTauri: { current: true },
  username: { current: null as string | null },
  email: { current: null as string | null },
  authUrlEnv: { current: 'https://auth.test' },
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
    // Raw env read: '' when the deployment sets nothing (the backend then
    // says nothing about auth and its iblai.app defaults rule).
    getEnv: (key: string) =>
      key === 'NEXT_PUBLIC_AUTH_URL' ? authUrlEnv.current : '',
    config: {
      ...actual.config,
      dmUrl: () => 'https://dm.test/dm',
      platformBaseDomain: () => 'test.domain',
    },
  };
});

describe('useOpencodeLearner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue(undefined);
    inTauri.current = true;
    username.current = null;
    email.current = null;
    authUrlEnv.current = 'https://auth.test';
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
        // The ONE domain code mode derives its hosts from, and the sole
        // non-derivable host beside it.
        platformDomain: 'test.domain',
        authUrl: 'https://auth.test',
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
        platformDomain: 'test.domain',
        authUrl: 'https://auth.test',
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
        platformDomain: 'test.domain',
        authUrl: 'https://auth.test',
      }),
    );
  });

  it('sends an empty auth URL when the deployment sets none', async () => {
    // Raw passthrough: unset env must arrive as '', not a guessed host — the
    // backend treats '' as "say nothing, iblai.app defaults rule".
    authUrlEnv.current = '';
    username.current = 'myuser';
    renderHook(() => useOpencodeLearner());

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        'set_opencode_learner',
        expect.objectContaining({ authUrl: '' }),
      ),
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
