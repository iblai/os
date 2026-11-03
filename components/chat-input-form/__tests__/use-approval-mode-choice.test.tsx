import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetApprovalModeForTests,
  useApprovalMode,
} from '../code-approvals-button';
import { useApprovalModeChoice } from '../use-approval-mode-choice';

/**
 * The one path every Code control takes to change the approval mode: the
 * composer's approvals button, the Code popover and the permission card's
 * Switch to Automatic.
 */

const { invoke, metadataQuery, platformMetadata, saveMetadata, toastError } =
  vi.hoisted(() => ({
    invoke: vi.fn(),
    metadataQuery: vi.fn(),
    /** The profile's metadata; `undefined` = still loading. */
    platformMetadata: { current: undefined as unknown },
    saveMetadata: vi.fn(),
    toastError: vi.fn(),
  }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserPlatformMetadataQuery: (...args: unknown[]) => {
    metadataQuery(...args);
    return { data: platformMetadata.current };
  },
  useUpdateUserPlatformMetadataMutation: () => [saveMetadata],
}));
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

const SAVE_FAILED =
  'The approval setting could not be saved. Code still uses the previous setting.';

/** The desktop's commands; a handler that throws rejects like a failing Rust command. */
function desktop(handlers: Record<string, (args?: unknown) => unknown> = {}) {
  invoke.mockImplementation(async (cmd: string, args?: unknown) =>
    handlers[cmd] ? handlers[cmd](args) : undefined,
  );
}

const renderChoice = (active?: boolean) =>
  renderHook(() => ({
    ...useApprovalModeChoice(active),
    mode: useApprovalMode(),
  }));

describe('useApprovalModeChoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('tenant', 'acme');
    platformMetadata.current = undefined;
    saveMetadata.mockReturnValue({ unwrap: async () => ({}) });
    resetApprovalModeForTests();
    desktop();
  });

  it('shows the pick, saves it on this machine, then on the profile with the rest of its Code settings', async () => {
    platformMetadata.current = {
      metadata: { code_mode: { permission_mode: 'manual', other: 'kept' } },
    };
    const { result } = renderChoice();

    await act(() => result.current.chooseMode('auto'));

    expect(result.current.mode).toBe('auto');
    expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
      mode: 'auto',
    });
    expect(saveMetadata).toHaveBeenCalledWith({
      tenantKey: 'acme',
      metadata: { code_mode: { permission_mode: 'auto', other: 'kept' } },
    });
    expect(invoke.mock.invocationCallOrder[0]).toBeLessThan(
      saveMetadata.mock.invocationCallOrder[0],
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it('puts the mode back, says so, asks the desktop again and leaves the profile alone when this machine cannot save', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    desktop({
      set_opencode_permission_mode: () => {
        throw new Error('config locked');
      },
      get_opencode_permission_mode: () => 'auto',
    });
    const { result } = renderChoice();

    await act(() => result.current.chooseMode('manual'));

    expect(toastError).toHaveBeenCalledWith(SAVE_FAILED);
    expect(err).toHaveBeenCalledWith(
      '[coding-mode] could not apply permission mode',
      expect.any(Error),
    );
    expect(invoke).toHaveBeenCalledWith('get_opencode_permission_mode');
    await waitFor(() => expect(result.current.mode).toBe('auto'));
    expect(saveMetadata).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('quiet, for the permission card: answers whether it saved, never toasts, and leaves the profile write running', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let finishProfile!: () => void;
    saveMetadata.mockReturnValue({
      unwrap: () =>
        new Promise<void>((resolve) => {
          finishProfile = resolve;
        }),
    });
    const { result } = renderChoice();

    let saved: unknown;
    await act(async () => {
      saved = await result.current.chooseMode('auto', { quiet: true });
    });
    expect(saved).toBe(true);
    expect(result.current.mode).toBe('auto');
    expect(saveMetadata).toHaveBeenCalledTimes(1);
    await act(async () => finishProfile());

    desktop({
      set_opencode_permission_mode: () => {
        throw new Error('settings unreadable');
      },
      get_opencode_permission_mode: () => 'manual',
    });
    await act(async () => {
      saved = await result.current.chooseMode('auto', { quiet: true });
    });
    expect(saved).toBe(false);
    expect(err).toHaveBeenCalledWith(
      '[coding-mode] could not apply permission mode',
      expect.any(Error),
    );
    expect(toastError).not.toHaveBeenCalled();
    expect(saveMetadata).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('keeps the pick and only logs it when the profile cannot be saved', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    saveMetadata.mockReturnValue({
      unwrap: async () => {
        throw new Error('offline');
      },
    });
    const { result } = renderChoice();

    await act(() => result.current.chooseMode('auto'));

    expect(result.current.mode).toBe('auto');
    expect(err).toHaveBeenCalledWith(
      '[coding-mode] could not save permission mode to the profile',
      expect.any(Error),
    );
    expect(toastError).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('saves on this machine only when no one is signed in to a tenant', async () => {
    localStorage.removeItem('tenant');
    const { result } = renderChoice();
    expect(metadataQuery).toHaveBeenCalledWith(
      { tenantKey: '' },
      { skip: true },
    );

    await act(() => result.current.chooseMode('auto'));

    expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
      mode: 'auto',
    });
    expect(saveMetadata).not.toHaveBeenCalled();
  });

  it('fetches nothing where Code cannot run', () => {
    renderChoice(false);

    expect(metadataQuery).toHaveBeenCalledWith(
      { tenantKey: 'acme' },
      { skip: true },
    );
  });

  it.each([
    ['while the profile is still loading', undefined, undefined],
    ['from a profile with no metadata', { metadata: null }, {}],
    ['from a malformed entry', { metadata: { code_mode: 'manual' } }, {}],
    [
      'from a profile that holds them',
      { metadata: { code_mode: { permission_mode: 'manual' } } },
      { permission_mode: 'manual' },
    ],
  ])('reads the profile’s Code settings %s', (_, data, expected) => {
    platformMetadata.current = data;

    const { result } = renderChoice();

    expect(result.current.profileCodeMode).toEqual(expected);
  });
});
