import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import {
  SESSION,
  installChromeStub,
  sessionRedirect,
  type ChromeStub,
} from './chrome.stub';
import { t } from '../i18n';

vi.mock('../mentor-chat', () => ({
  MentorChat: ({ onSignOut }: { onSignOut: () => void }) => (
    <div data-testid="mentor-chat">
      <button type="button" onClick={onSignOut}>
        {chrome.i18n.getMessage('signOut')}
      </button>
    </div>
  ),
}));

let chromeStub: ChromeStub;

beforeEach(() => {
  localStorage.clear();
  chromeStub = installChromeStub();
});

afterEach(() => {
  cleanup();
  // A test that fails before restoring them leaves every later test on fake
  // timers, which turns one failure into a file full of timeouts.
  vi.useRealTimers();
});

describe('App', () => {
  it('is the chat alone: nothing above it, and no tabs', async () => {
    localStorage.setItem('axd_token', 'x');
    render(<App />);
    await act(async () => {});
    expect(chromeStub.stub.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(screen.getByTestId('mentor-chat')).toBeInTheDocument();
    // Nothing renders above the chat — no settings row, no toolbar.
    expect(screen.getByTestId('mentor-chat').previousElementSibling).toBeNull();
    // Browsing is the composer's own pill now; a tablist would mean the old
    // two-surface panel came back.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  // The panel used to default to "signed out", so anyone already signed in saw
  // the blue Sign In button for a frame on every open.
  it('never flashes the sign-in button while the answer is pending', async () => {
    render(<App />);

    expect(screen.queryByRole('button', { name: t('signIn') })).toBeNull();
    expect(screen.queryByTestId('mentor-chat')).toBeNull();
    expect(screen.getByRole('status')).toHaveAccessibleName(t('signingIn'));

    await screen.findByTestId('mentor-chat');
    expect(screen.queryByRole('button', { name: t('signIn') })).toBeNull();
  });

  // A sign-in window can open behind the browser, or not open at all, and the
  // flow only settles when that window does. The panel used to animate for as
  // long as it stayed open, with nothing to press.
  it('offers the button when the sign-in window never comes back', async () => {
    vi.useFakeTimers();
    chromeStub.stub.identity.launchWebAuthFlow.mockReturnValueOnce(
      new Promise(() => {}),
    );

    render(<App />);
    expect(screen.queryByRole('button', { name: t('signIn') })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(8000);
    });

    expect(
      screen.getByRole('button', { name: t('signIn') }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('signInWindow'))).toBeInTheDocument();
    // Still pending, not failed: the window may yet be finished.
    expect(screen.queryByText(t('signInFailed'))).toBeNull();
  });

  // Clearing our own storage is not a sign-out: the auth app keeps its session
  // and the next flow returns the SAME account with no form shown, which is
  // what made signing out look like it had done nothing.
  it('asks for a different account on the sign-in after a sign-out', async () => {
    localStorage.setItem('axd_token', 'x');
    render(<App />);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: t('signOut') }));

    expect(localStorage.getItem('axd_token')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('signIn') }));
    await act(async () => {});

    const url =
      chromeStub.stub.identity.launchWebAuthFlow.mock.calls.at(-1)?.[0]?.url ??
      '';
    expect(url).toContain('enforce_logout=1');
    expect(url).toContain('logout=1');
  });

  // The first open must not drag a person through a login form they do not
  // need: only a sign-out asks for a different account.
  it('does not force a fresh login on an ordinary first sign-in', async () => {
    render(<App />);
    await screen.findByTestId('mentor-chat');

    const url =
      chromeStub.stub.identity.launchWebAuthFlow.mock.calls.at(-1)?.[0]?.url ??
      '';
    expect(url).not.toContain('enforce_logout');
  });

  it('shows the sign-in button once sign-in has actually failed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    chromeStub.stub.identity.launchWebAuthFlow.mockRejectedValueOnce(
      new Error('nope'),
    );

    render(<App />);

    expect(
      await screen.findByRole('button', { name: t('signIn') }),
    ).toBeInTheDocument();
    error.mockRestore();
  });

  // Two clicks used to start two auth flows, and whichever finished last wrote
  // the session — so a slow first attempt could land on top of the good one.
  it('runs one sign-in at a time, however many times the button is clicked', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    chromeStub.stub.identity.launchWebAuthFlow.mockRejectedValueOnce(
      new Error('nope'),
    );
    render(<App />);
    const button = await screen.findByRole('button', { name: t('signIn') });

    let release!: (value: string) => void;
    chromeStub.stub.identity.launchWebAuthFlow.mockImplementationOnce(
      () => new Promise<string>((resolve) => (release = resolve)),
    );

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(2);

    await act(async () => {
      release(sessionRedirect(SESSION));
    });
    error.mockRestore();
  });

  it('signs in on first open and then renders the chat', async () => {
    render(<App />);
    expect(screen.queryByTestId('mentor-chat')).toBeNull();
    await screen.findByTestId('mentor-chat');
    expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('axd_token')).toBe('axd');
  });

  it('reports a failed sign-in and retries from the button', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    chromeStub.stub.identity.launchWebAuthFlow.mockRejectedValueOnce(
      new Error('cancelled'),
    );
    render(<App />);
    await screen.findByText('Sign-in failed. Try again.');
    expect(screen.queryByTestId('mentor-chat')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    });
    await screen.findByTestId('mentor-chat');
    expect(chromeStub.stub.identity.launchWebAuthFlow).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  // The counter kept a stale flow out of the UI but not out of storage: the
  // session was written inside the flow, so a window the person walked away
  // from signed them back into the account they had just left — the panel
  // signed out, localStorage signed in, and the next open auto-signing in.
  it('drops the session from a flow abandoned by signing out', async () => {
    vi.useFakeTimers();
    let abandoned!: (url: string) => void;
    chromeStub.stub.identity.launchWebAuthFlow.mockImplementationOnce(
      () => new Promise<string>((resolve) => (abandoned = resolve)),
    );

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });

    // A second flow finishes and signs the person in, leaving the first one
    // still open behind it.
    fireEvent.click(screen.getByRole('button', { name: t('signIn') }));
    await act(async () => {});
    expect(screen.getByTestId('mentor-chat')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t('signOut') }));
    expect(localStorage.getItem('axd_token')).toBeNull();

    // The window they gave up on finally comes back, with a whole session.
    await act(async () => {
      abandoned(sessionRedirect(SESSION));
    });

    expect(localStorage.getItem('axd_token')).toBeNull();
    expect(
      screen.getByRole('button', { name: t('signIn') }),
    ).toBeInTheDocument();
  });

  // The request for a different account was spent by whichever flow settled
  // next, stale or not — so the click after a sign-out went back to the auth
  // app's own session and returned the same account with no window at all.
  it('still asks for a different account after an abandoned flow settles', async () => {
    vi.useFakeTimers();
    let abandoned!: (url: string) => void;
    chromeStub.stub.identity.launchWebAuthFlow.mockImplementationOnce(
      () => new Promise<string>((resolve) => (abandoned = resolve)),
    );

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.click(screen.getByRole('button', { name: t('signIn') }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: t('signOut') }));
    await act(async () => {
      abandoned(sessionRedirect(SESSION));
    });

    fireEvent.click(screen.getByRole('button', { name: t('signIn') }));
    await act(async () => {});

    const url =
      chromeStub.stub.identity.launchWebAuthFlow.mock.calls.at(-1)?.[0]?.url ??
      '';
    expect(url).toContain('logout=1');
  });

  // Signing out reused the pending screen, which explains a window that has
  // opened — so leaving the account answered with a note about a window
  // nobody had opened and nothing running.
  it('explains no window when nothing is running', async () => {
    localStorage.setItem('axd_token', 'x');
    render(<App />);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: t('signOut') }));

    expect(
      screen.getByRole('button', { name: t('signIn') }),
    ).toBeInTheDocument();
    expect(screen.queryByText(t('signInWindow'))).toBeNull();
    expect(screen.queryByText(t('signInFailed'))).toBeNull();
  });

  // The flow the person gave up on rejects when its window is finally closed,
  // long after they signed out. That answer belongs to nobody: reporting it
  // would put a failure on a screen they had already moved on from.
  it('ignores an abandoned flow that fails after a sign-out', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    let abandon!: (reason: Error) => void;
    chromeStub.stub.identity.launchWebAuthFlow.mockImplementationOnce(
      () => new Promise<string>((_, reject) => (abandon = reject)),
    );

    render(<App />);
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    fireEvent.click(screen.getByRole('button', { name: t('signIn') }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: t('signOut') }));

    await act(async () => {
      abandon(new Error('window closed'));
    });

    expect(
      screen.getByRole('button', { name: t('signIn') }),
    ).toBeInTheDocument();
    expect(screen.queryByText(t('signInFailed'))).toBeNull();
    error.mockRestore();
  });

  // A tenant switch mints its own session through `signIn(tenant)` in
  // mentor-frame, so this window closing is not the whole story: the panel is
  // signed in, and saying the sign-in failed would be wrong.
  it('reports no failure when a session arrived from elsewhere', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    chromeStub.stub.identity.launchWebAuthFlow.mockImplementationOnce(
      async () => {
        localStorage.setItem('axd_token', 'axd');
        localStorage.setItem('axd_token_expires', '2099-01-01T00:00:00Z');
        throw new Error('window closed');
      },
    );

    render(<App />);
    await act(async () => {});

    expect(screen.getByTestId('mentor-chat')).toBeInTheDocument();
    expect(screen.queryByText(t('signInFailed'))).toBeNull();
    error.mockRestore();
  });
});
