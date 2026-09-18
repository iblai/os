import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startBrowseBridge } from '../browse-bridge';
import { MentorChat } from '../mentor-chat';
import {
  removeWidgetSpinner,
  startContextFeed,
  watchAndInstallSession,
} from '../mentor-frame';
import { MENTOR_URL } from '../settings';
import { installChromeStub } from './chrome.stub';

vi.mock('../mentor-frame', () => ({
  watchAndInstallSession: vi.fn(),
  startContextFeed: vi.fn(),
  removeWidgetSpinner: vi.fn(),
}));
vi.mock('../browse-bridge', () => ({ startBrowseBridge: vi.fn() }));

const stopInstall = vi.fn();
const stopFeed = vi.fn();
const stopBridge = vi.fn();

beforeEach(() => {
  installChromeStub();
  vi.mocked(watchAndInstallSession).mockClear();
  vi.mocked(removeWidgetSpinner).mockClear();
  vi.mocked(startContextFeed).mockClear();
  vi.mocked(startBrowseBridge).mockClear();
  vi.mocked(watchAndInstallSession).mockReturnValue(stopInstall);
  vi.mocked(startContextFeed).mockReturnValue(stopFeed);
  vi.mocked(startBrowseBridge).mockReturnValue(stopBridge);
  stopInstall.mockClear();
  stopFeed.mockClear();
  stopBridge.mockClear();
});

afterEach(cleanup);

describe('MentorChat', () => {
  it('mounts the agent element and wires the frame glue and the browse bridge', () => {
    const { unmount } = render(<MentorChat />);
    const element = document.querySelector('agent-ai')!;
    expect(element.getAttribute('mentorurl')).toBe(MENTOR_URL);
    expect(element.getAttribute('authurl')).toBe('https://login.iblai.app');
    expect(element.getAttribute('lmsurl')).toBe('https://learn.iblai.app');
    expect(element.getAttribute('theme')).toBe('light');
    expect(element.getAttribute('component')).toBe('chat');
    expect(element.hasAttribute('authrelyonhost')).toBe(true);
    expect(removeWidgetSpinner).toHaveBeenCalledWith(element);
    expect(watchAndInstallSession).toHaveBeenCalledWith(element);
    expect(startContextFeed).toHaveBeenCalledWith(element);
    expect(startBrowseBridge).toHaveBeenCalledWith(element);
    unmount();
    expect(stopInstall).toHaveBeenCalledTimes(1);
    expect(stopFeed).toHaveBeenCalledTimes(1);
    expect(stopBridge).toHaveBeenCalledTimes(1);
  });
});
