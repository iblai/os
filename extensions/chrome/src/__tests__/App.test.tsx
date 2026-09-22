import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { installChromeStub, type ChromeStub } from './chrome.stub';

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
