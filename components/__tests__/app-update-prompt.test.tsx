import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppUpdatePrompt } from '../app-update-prompt';

/**
 * The update prompt's contract: check once (throttled), prompt only for a
 * real, un-skipped update, and route the Update button per platform —
 * install-in-place on desktop (no `url`), store page on mobile (`url`).
 */

const { invoke, listen, openUrl, isTauri } = vi.hoisted(() => ({
  invoke: vi.fn(),
  openUrl: vi.fn(async (..._args: unknown[]) => {}),
  listen: vi.fn(async (..._args: unknown[]) => () => {}),
  isTauri: { current: true },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listen(...args),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: (...args: unknown[]) => openUrl(...args),
}));
vi.mock('@/types/tauri', () => ({
  isTauriApp: () => isTauri.current,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, string>) =>
    vars?.version ? `${key} ${vars.version}` : key,
}));

function backend(update: unknown) {
  invoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'check_app_update') return update;
    return undefined;
  });
}

describe('AppUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    isTauri.current = true;
  });

  it('renders nothing outside Tauri and never checks', async () => {
    isTauri.current = false;
    const { container } = render(<AppUpdatePrompt />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('stays hidden when the host reports no update', async () => {
    backend({ available: false, supported: true });
    const { container } = render(<AppUpdatePrompt />);
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('check_app_update'),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('prompts with the version when an update is available', async () => {
    backend({ available: true, supported: true, version: '0.96.0' });
    render(<AppUpdatePrompt />);
    expect(await screen.findByTestId('app-update-prompt')).toBeInTheDocument();
    expect(screen.getByText('description 0.96.0')).toBeInTheDocument();
  });

  it('throttles: no second check within 24 hours', async () => {
    localStorage.setItem('ibl_app_update_last_check', String(Date.now()));
    backend({ available: true, version: '0.96.0' });
    const { container } = render(<AppUpdatePrompt />);
    await Promise.resolve();
    expect(invoke).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('respects a skipped version, but prompts for a newer one', async () => {
    localStorage.setItem('ibl_app_update_skip_version', '0.96.0');
    backend({ available: true, version: '0.96.0' });
    const { container, unmount } = render(<AppUpdatePrompt />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();

    localStorage.removeItem('ibl_app_update_last_check');
    backend({ available: true, version: '0.97.0' });
    render(<AppUpdatePrompt />);
    expect(await screen.findByTestId('app-update-prompt')).toBeInTheDocument();
  });

  it('Skip This Version persists and dismisses', async () => {
    backend({ available: true, version: '0.96.0' });
    render(<AppUpdatePrompt />);
    await screen.findByTestId('app-update-prompt');
    await userEvent.click(screen.getByRole('button', { name: 'skip' }));
    expect(localStorage.getItem('ibl_app_update_skip_version')).toBe('0.96.0');
    expect(screen.queryByTestId('app-update-prompt')).toBeNull();
  });

  it('desktop: Update Now runs the in-place install command', async () => {
    backend({ available: true, supported: true, version: '0.96.0' });
    render(<AppUpdatePrompt />);
    await screen.findByTestId('app-update-prompt');
    await userEvent.click(screen.getByRole('button', { name: 'updateNow' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('install_app_update'),
    );
    // Progress subscription for the download bar.
    expect(listen).toHaveBeenCalledWith(
      'app-update:progress',
      expect.any(Function),
    );
  });

  it('mobile: Update Now opens the store page instead of installing', async () => {
    backend({
      available: true,
      version: '1.2.0',
      url: 'https://apps.apple.com/app/id1',
    });
    render(<AppUpdatePrompt />);
    await screen.findByTestId('app-update-prompt');
    await userEvent.click(screen.getByRole('button', { name: 'updateNow' }));
    // Via the opener plugin — never `open_external_url`, whose iOS arm is an
    // OAuth auth-session sheet that would swallow the App Store page.
    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith('https://apps.apple.com/app/id1'),
    );
    expect(invoke).not.toHaveBeenCalledWith(
      'open_external_url',
      expect.anything(),
    );
    expect(invoke).not.toHaveBeenCalledWith('install_app_update');
    // The store owns the rest — the prompt goes away.
    expect(screen.queryByTestId('app-update-prompt')).toBeNull();
  });

  it('mobile: a failed store hand-off keeps the prompt and shows why', async () => {
    // Before the fix the prompt dismissed BEFORE the opener resolved, so a
    // blocked/failed open lost the prompt for a day with no feedback.
    backend({
      available: true,
      version: '1.2.0',
      url: 'https://play.google.com/store/apps/details?id=ai.ibl.mentorai',
    });
    openUrl.mockRejectedValueOnce(new Error('no handler for URL'));
    render(<AppUpdatePrompt />);
    await screen.findByTestId('app-update-prompt');
    await userEvent.click(screen.getByRole('button', { name: 'updateNow' }));
    expect(await screen.findByText('no handler for URL')).toBeInTheDocument();
    expect(screen.getByTestId('app-update-prompt')).toBeInTheDocument();
  });

  it('Later dismisses without skipping the version', async () => {
    backend({ available: true, version: '0.96.0' });
    render(<AppUpdatePrompt />);
    await screen.findByTestId('app-update-prompt');
    await userEvent.click(screen.getByRole('button', { name: 'later' }));
    expect(screen.queryByTestId('app-update-prompt')).toBeNull();
    // Not a skip: the same version prompts again on the next check.
    expect(localStorage.getItem('ibl_app_update_skip_version')).toBeNull();
  });

  it('desktop: sized progress events drive the download bar', async () => {
    backend({ available: true, supported: true, version: '0.96.0' });
    let onProgress:
      | ((e: { payload: { downloaded: number; total?: number } }) => void)
      | undefined;
    listen.mockImplementation(async (_evt: unknown, cb: unknown) => {
      onProgress = cb as typeof onProgress;
      return () => {};
    });
    // Hold the install open so the bar stays mounted while events arrive.
    let finishInstall: () => void = () => {};
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'check_app_update')
        return { available: true, supported: true, version: '0.96.0' };
      if (cmd === 'install_app_update')
        return new Promise<void>((resolve) => {
          finishInstall = resolve;
        });
      return undefined;
    });
    render(<AppUpdatePrompt />);
    await screen.findByTestId('app-update-prompt');
    await userEvent.click(screen.getByRole('button', { name: 'updateNow' }));
    const bar = await screen.findByTestId('app-update-progress');
    await waitFor(() => expect(onProgress).toBeDefined());
    // Indeterminate until a sized event lands.
    expect(bar.firstElementChild).toHaveStyle({ width: '8%' });
    act(() => onProgress!({ payload: { downloaded: 50, total: 200 } }));
    expect(bar.firstElementChild).toHaveStyle({ width: '25%' });
    // Unsized events (total unknown) leave the bar where it was.
    act(() => onProgress!({ payload: { downloaded: 80 } }));
    expect(bar.firstElementChild).toHaveStyle({ width: '25%' });
    // Progress never overshoots 100% on a final oversize chunk.
    act(() => onProgress!({ payload: { downloaded: 250, total: 200 } }));
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' });
    act(() => finishInstall());
  });

  it('surfaces an install failure instead of dismissing', async () => {
    backend({ available: true, version: '0.96.0' });
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'check_app_update')
        return { available: true, version: '0.96.0' };
      if (cmd === 'install_app_update') throw new Error('download failed');
      return undefined;
    });
    render(<AppUpdatePrompt />);
    await screen.findByTestId('app-update-prompt');
    await userEvent.click(screen.getByRole('button', { name: 'updateNow' }));
    expect(await screen.findByText('download failed')).toBeInTheDocument();
    expect(screen.getByTestId('app-update-prompt')).toBeInTheDocument();
  });
});
