import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { LOCAL_LLM_ENABLED_KEY } from '@/lib/local-llm-flags';
import { TAURI_COMMANDS } from '@/types/tauri';

vi.mock('../use-tauri');
vi.mock('../use-local-storage');
vi.mock('@/types/tauri', async () => ({
  ...(await vi.importActual<object>('@/types/tauri')),
  isTauriApp: vi.fn(() => true),
}));

/**
 * A fresh copy of the hook per test: the warm-up runs once per page load and
 * that is module state, so each test needs its own "launch".
 */
async function launch(invoke: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  const tauri = await import('../use-tauri');
  vi.mocked(tauri.useTauri).mockReturnValue({
    isAvailable: true,
    invoke,
    listen: vi.fn().mockResolvedValue(vi.fn()),
  });
  const storage = await import('../use-local-storage');
  vi.mocked(storage.useLocalStorage).mockImplementation(
    (_key: string, defaultValue: unknown) =>
      [defaultValue, vi.fn(), vi.fn()] as never,
  );
  return (await import('../use-model-download')).useModelDownload;
}

const warmUps = (invoke: ReturnType<typeof vi.fn>) =>
  invoke.mock.calls.filter(
    ([command]) => command === TAURI_COMMANDS.WARM_UP_LOCAL_CHAT,
  );

describe('useModelDownload starts local chat at launch', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // The reported bug: after a relaunch with Local Models on, the first local
  // chat failed until Local Models was turned off and on.
  it('starts it once in the background while Local Models is on, whatever model is picked', async () => {
    localStorage.setItem(LOCAL_LLM_ENABLED_KEY, 'true');
    const invoke = vi.fn().mockResolvedValue(null);
    const useModelDownload = await launch(invoke);

    // The nav bar and the header each mount the hook.
    renderHook(() => useModelDownload());
    renderHook(() => useModelDownload());

    await waitFor(() => expect(warmUps(invoke)).toHaveLength(1));
  });

  it('leaves it alone while Local Models is off', async () => {
    localStorage.setItem(LOCAL_LLM_ENABLED_KEY, 'false');
    const invoke = vi.fn().mockResolvedValue(null);
    const useModelDownload = await launch(invoke);

    renderHook(() => useModelDownload());

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(TAURI_COMMANDS.GET_OS_TYPE),
    );
    expect(warmUps(invoke)).toHaveLength(0);
  });

  it('keeps the app working when an older app version has no warm-up', async () => {
    localStorage.setItem(LOCAL_LLM_ENABLED_KEY, 'true');
    const invoke = vi.fn((command: string) =>
      command === TAURI_COMMANDS.WARM_UP_LOCAL_CHAT
        ? Promise.reject(new Error('command warm_up_local_chat not found'))
        : Promise.resolve(null),
    );
    const useModelDownload = await launch(invoke);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useModelDownload());

    await waitFor(() => expect(warmUps(invoke)).toHaveLength(1));
    expect(result.current.state).toBeDefined();
  });
});
