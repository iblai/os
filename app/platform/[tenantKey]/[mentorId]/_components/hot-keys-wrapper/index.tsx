'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { useShortcuts } from '@/hooks/use-shortcuts';

export function HotKeysWrapper() {
  const shortcuts = useShortcuts();

  useHotkeys(shortcuts.startNewChat.keys, shortcuts.startNewChat.callback);
  useHotkeys(shortcuts.focusInput.keys, shortcuts.focusInput.callback);
  useHotkeys(shortcuts.toggleSidebar.keys, shortcuts.toggleSidebar.callback);
  useHotkeys(
    shortcuts.openShortcutsModal.keys,
    shortcuts.openShortcutsModal.callback,
  );

  return null;
}
