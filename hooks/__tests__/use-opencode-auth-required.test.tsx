import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import {
  useOpencodeAuthRequired,
  wasRecentAuthRequired,
} from '../use-opencode-auth-required';

/**
 * A Code turn on a signed-out Codex / Claude Code must raise ONE quiet toast
 * naming the fix — Codex signs in right from the toast, Claude Code gets the
 * terminal hint — and raise the flag that keeps the chat's generic error toast
 * quiet for the same failure.
 */

const { listen, fireEvent, invoke, toastInfo, toastPromise, inTauri } =
  vi.hoisted(() => {
    let handler: ((evt: { payload: unknown }) => void) | undefined;
    return {
      listen: vi.fn(
        async (_event: string, cb: (evt: { payload: unknown }) => void) => {
          handler = cb;
          return () => {
            handler = undefined;
          };
        },
      ),
      fireEvent: (payload: unknown) => handler?.({ payload }),
      invoke: vi.fn(async () => undefined),
      toastInfo: vi.fn(),
      toastPromise: vi.fn(),
      inTauri: { current: true },
    };
  });

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) =>
    (listen as (...a: unknown[]) => unknown)(...args),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...(args as [])),
}));
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => inTauri.current,
}));
vi.mock('sonner', () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
    promise: (...args: unknown[]) => toastPromise(...args),
  },
}));

type ToastOptions = {
  id?: string;
  action?: { label: string; onClick: () => void };
  description?: React.ReactNode;
};

// The module keeps a shared "recent sign-in failure" timestamp; step a mocked
// clock a minute per test so every test starts outside the window.
let now = 2_000_000_000;

describe('useOpencodeAuthRequired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inTauri.current = true;
    now += 60_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers Codex sign-in with ChatGPT right from the toast', async () => {
    renderHook(() => useOpencodeAuthRequired());
    await waitFor(() =>
      expect(listen).toHaveBeenCalledWith(
        'opencode:auth_required',
        expect.any(Function),
      ),
    );

    fireEvent({ generation_id: 'opencode-1', backend: 'codex' });

    expect(toastInfo).toHaveBeenCalledWith(
      'Codex isn’t signed in',
      expect.objectContaining({ id: 'code-agent-auth' }),
    );
    const options = toastInfo.mock.calls[0][1] as ToastOptions;
    expect(options.action?.label).toBe('Sign in with ChatGPT');

    options.action?.onClick();
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('code_agent_sign_in', {
        backend: 'codex',
      }),
    );
    expect(toastPromise).toHaveBeenCalledTimes(1);
    const messages = toastPromise.mock.calls[0][1] as {
      loading: string;
      success: string;
      error: (e: unknown) => string;
    };
    expect(messages.loading).toBe('Continue in your browser…');
    expect(messages.success).toBe('Signed in — send your message again.');
    expect(messages.error(new Error('timed out'))).toBe('timed out');
    expect(messages.error('plain')).toBe('plain');
  });

  it('points Claude Code users at the terminal, with no sign-in action', async () => {
    renderHook(() => useOpencodeAuthRequired());
    await waitFor(() => expect(listen).toHaveBeenCalled());

    fireEvent({ generation_id: 'opencode-2', backend: 'claude' });

    expect(toastInfo).toHaveBeenCalledWith(
      'Claude Code isn’t signed in',
      expect.objectContaining({ id: 'code-agent-auth' }),
    );
    const options = toastInfo.mock.calls[0][1] as ToastOptions;
    expect(options.action).toBeUndefined();
    const { container } = render(<>{options.description}</>);
    expect(container.textContent).toBe('Run claude in a terminal to sign in.');
    expect(container.querySelector('code')?.textContent).toBe('claude');
  });

  it('raises the suppression flag for the turn’s generic error toast, then lets it lapse', async () => {
    renderHook(() => useOpencodeAuthRequired());
    await waitFor(() => expect(listen).toHaveBeenCalled());
    expect(wasRecentAuthRequired()).toBe(false);

    fireEvent({ backend: 'codex' });
    expect(wasRecentAuthRequired()).toBe(true);

    now += 9_000;
    expect(wasRecentAuthRequired()).toBe(true);
    now += 2_000;
    expect(wasRecentAuthRequired()).toBe(false);
  });

  it('registers nothing outside the desktop app', async () => {
    inTauri.current = false;
    renderHook(() => useOpencodeAuthRequired());
    await new Promise((r) => setTimeout(r, 0));
    expect(listen).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useOpencodeAuthRequired());
    await waitFor(() => expect(listen).toHaveBeenCalled());
    unmount();
    fireEvent({ backend: 'codex' });
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('logs instead of throwing when the listener cannot be registered', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    listen.mockRejectedValueOnce(new Error('no event plugin'));
    renderHook(() => useOpencodeAuthRequired());
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(consoleError.mock.calls[0][0]).toContain(
      'auth-required listener failed',
    );
  });
});
