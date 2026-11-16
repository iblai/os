import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startBrowseBridge } from '../browse-bridge';
import { MentorChat } from '../mentor-chat';
import { switchToOrganization } from '../mentor-frame';
import {
  removeWidgetSpinner,
  startContextFeed,
  watchAndInstallSession,
  watchAuthExpired,
  watchTenantSwitch,
} from '../mentor-frame';
import { MENTOR_URL } from '../settings';
import { installChromeStub } from './chrome.stub';

vi.mock('../mentor-frame', () => ({
  watchAndInstallSession: vi.fn(),
  switchToOrganization: vi.fn(),
  watchTenantSwitch: vi.fn(),
  watchAuthExpired: vi.fn(),
  startContextFeed: vi.fn(),
  removeWidgetSpinner: vi.fn(),
}));
vi.mock('../browse-bridge', () => ({ startBrowseBridge: vi.fn() }));
// A stand-in for the picker: these tests are about what the panel does with a
// choice, not about how the list is drawn (see org-picker.test.tsx).
vi.mock('../org-picker', () => ({
  OrgPicker: ({
    current,
    onPick,
    onCancel,
  }: {
    current: string | null;
    onPick: (key: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="picker" data-current={current ?? ''}>
      <button type="button" onClick={() => onPick('globex')}>
        pick globex
      </button>
      <button type="button" onClick={onCancel}>
        cancel
      </button>
    </div>
  ),
}));
vi.mock('../auth', () => ({ org: () => 'acme' }));

const stopInstall = vi.fn();
const stopTenantSwitch = vi.fn();
const stopAuthExpired = vi.fn();
const stopFeed = vi.fn();
const stopBridge = vi.fn();

beforeEach(() => {
  installChromeStub();
  vi.mocked(watchAndInstallSession).mockClear();
  vi.mocked(watchTenantSwitch).mockClear();
  vi.mocked(removeWidgetSpinner).mockClear();
  vi.mocked(startContextFeed).mockClear();
  vi.mocked(startBrowseBridge).mockClear();
  vi.mocked(switchToOrganization).mockClear();
  vi.mocked(watchAndInstallSession).mockReturnValue(stopInstall);
  vi.mocked(watchTenantSwitch).mockReturnValue(stopTenantSwitch);
  vi.mocked(watchAuthExpired).mockReturnValue(stopAuthExpired);
  vi.mocked(startContextFeed).mockReturnValue(stopFeed);
  vi.mocked(startBrowseBridge).mockReturnValue(stopBridge);
  stopInstall.mockClear();
  stopTenantSwitch.mockClear();
  stopAuthExpired.mockClear();
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
    // The panel lists the organizations and mints the chosen one's session, so
    // agent-ai must not open a chooser of its own.
    expect(element.hasAttribute('hostownschooser')).toBe(true);
    expect(element.hasAttribute('allowmentorselection')).toBe(true);
    expect(removeWidgetSpinner).toHaveBeenCalledWith(element);
    expect(watchAndInstallSession).toHaveBeenCalledWith(element);
    // Second argument: what the glue calls to raise the panel's own picker.
    expect(watchTenantSwitch).toHaveBeenCalledWith(
      element,
      expect.any(Function),
    );
    expect(watchAuthExpired).toHaveBeenCalledWith(element);
    expect(startContextFeed).toHaveBeenCalledWith(element);
    expect(startBrowseBridge).toHaveBeenCalledWith(element);
    unmount();
    expect(stopInstall).toHaveBeenCalledTimes(1);
    expect(stopTenantSwitch).toHaveBeenCalledTimes(1);
    expect(stopAuthExpired).toHaveBeenCalledTimes(1);
    expect(stopFeed).toHaveBeenCalledTimes(1);
    expect(stopBridge).toHaveBeenCalledTimes(1);
  });

  // The app asks for an organization without naming one; the panel answers
  // with its own list rather than sending anyone to a browser tab.
  it('raises the picker when the app asks for an organization', async () => {
    render(<MentorChat />);
    expect(screen.queryByTestId('picker')).toBeNull();

    const raise = vi.mocked(watchTenantSwitch).mock.calls[0][1]!;
    act(() => raise());

    const picker = await screen.findByTestId('picker');
    // It is told which one the panel is in, so that row can be marked.
    expect(picker.getAttribute('data-current')).toBe('acme');
  });

  it('switches to the organization that was picked, and closes the picker', async () => {
    render(<MentorChat />);
    const element = document.querySelector('agent-ai')!;
    act(() => vi.mocked(watchTenantSwitch).mock.calls[0][1]!());
    const user = userEvent.setup();

    await user.click(await screen.findByText('pick globex'));

    expect(switchToOrganization).toHaveBeenCalledWith(element, 'globex');
    expect(screen.queryByTestId('picker')).toBeNull();
  });

  it('closes the picker without switching when it is dismissed', async () => {
    render(<MentorChat />);
    act(() => vi.mocked(watchTenantSwitch).mock.calls[0][1]!());
    const user = userEvent.setup();

    await user.click(await screen.findByText('cancel'));

    expect(screen.queryByTestId('picker')).toBeNull();
    expect(switchToOrganization).not.toHaveBeenCalled();
  });

  // The switch remounts the iframe; unmounting the element to show a list
  // would tear the chat down for a choice the person may well cancel.
  it('keeps the chat mounted while the picker is open', async () => {
    render(<MentorChat />);
    act(() => vi.mocked(watchTenantSwitch).mock.calls[0][1]!());

    await screen.findByTestId('picker');
    expect(document.querySelector('agent-ai')).toBeTruthy();
  });
});
