import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTauri } from '../call-tauri';

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('callTauri', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('hands the command and its arguments to the host and returns the answer', async () => {
    mockInvoke.mockResolvedValue('ok');

    await expect(
      callTauri('open_privacy_settings', { pane: 'accessibility' }),
    ).resolves.toBe('ok');
    expect(mockInvoke).toHaveBeenCalledWith('open_privacy_settings', {
      pane: 'accessibility',
    });
  });

  it('passes a command without arguments through untouched', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await callTauri('relaunch_app');

    expect(mockInvoke).toHaveBeenCalledWith('relaunch_app', undefined);
  });

  it('surfaces the host refusal to the caller', async () => {
    mockInvoke.mockRejectedValue(new Error('unknown privacy pane: camera'));

    await expect(
      callTauri('open_privacy_settings', { pane: 'camera' }),
    ).rejects.toThrow('unknown privacy pane: camera');
  });
});
