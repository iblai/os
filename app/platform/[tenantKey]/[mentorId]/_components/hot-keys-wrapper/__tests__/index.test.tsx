import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const useHotkeysMock = vi.fn();
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: (keys: string, callback: () => void) =>
    useHotkeysMock(keys, callback),
}));

const startNewChatCallback = vi.fn();
const focusInputCallback = vi.fn();
const toggleSidebarCallback = vi.fn();
const openShortcutsModalCallback = vi.fn();

vi.mock('@/hooks/use-shortcuts', () => ({
  useShortcuts: () => ({
    startNewChat: { keys: 'mod+shift+o', callback: startNewChatCallback },
    focusInput: { keys: 'mod+/', callback: focusInputCallback },
    toggleSidebar: { keys: 'mod+b', callback: toggleSidebarCallback },
    openShortcutsModal: {
      keys: 'mod+/',
      callback: openShortcutsModalCallback,
    },
  }),
}));

import { HotKeysWrapper } from '../index';

describe('HotKeysWrapper', () => {
  beforeEach(() => {
    useHotkeysMock.mockClear();
  });

  it('renders nothing visible to the DOM', () => {
    const { container } = render(<HotKeysWrapper />);
    expect(container.firstChild).toBeNull();
  });

  it('registers a hotkey for each shortcut returned by useShortcuts', () => {
    render(<HotKeysWrapper />);

    expect(useHotkeysMock).toHaveBeenCalledTimes(4);
    expect(useHotkeysMock).toHaveBeenCalledWith(
      'mod+shift+o',
      startNewChatCallback,
    );
    expect(useHotkeysMock).toHaveBeenCalledWith('mod+/', focusInputCallback);
    expect(useHotkeysMock).toHaveBeenCalledWith('mod+b', toggleSidebarCallback);
    expect(useHotkeysMock).toHaveBeenCalledWith(
      'mod+/',
      openShortcutsModalCallback,
    );
  });
});
