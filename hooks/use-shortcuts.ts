import { useNavigate } from '@/hooks/user-navigate';
import { useSidebar } from '@/components/ui/sidebar';
import { useAppDispatch } from '@/lib/hooks';
import { shortcutsModalUpdated } from '@/features/navigation/slice';

export function useShortcuts() {
  const { navigateToHome } = useNavigate();
  const { toggleSidebar } = useSidebar();
  const dispatch = useAppDispatch();

  const shortcuts = {
    startNewChat: {
      label: 'Start New Chat',
      keys: 'meta+shift+o',
      callback: navigateToHome,
    },
    focusInput: {
      label: 'Focus Input',
      keys: 'shift+esc',
      callback: () => {
        const textarea = document.querySelector(
          'textarea[placeholder="Ask anything"]',
        ) as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
        }
      },
    },
    toggleSidebar: {
      label: 'Toggle Sidebar',
      keys: 'meta+shift+s',
      callback: toggleSidebar,
    },
    openShortcutsModal: {
      label: 'Open Shortcuts',
      keys: 'meta+y',
      callback: () => {
        dispatch(shortcutsModalUpdated(true));
      },
    },
  };

  return shortcuts;
}
