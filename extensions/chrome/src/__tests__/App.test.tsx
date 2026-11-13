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
  MentorChat: () => <div data-testid="mentor-chat" />,
}));

let chromeStub: ChromeStub;

beforeEach(() => {
  localStorage.clear();
  chromeStub = installChromeStub();
});

afterEach(cleanup);

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
    expect(screen.getByText(t('signingIn'))).toBeInTheDocument();

    await screen.findByTestId('mentor-chat');
    expect(screen.queryByRole('button', { name: t('signIn') })).toBeNull();
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
});
