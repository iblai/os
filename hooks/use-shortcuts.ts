import { useTranslations } from 'next-intl';

import { useNavigate } from '@/hooks/user-navigate';
import { useSidebar } from '@/components/ui/sidebar';
import { useAppDispatch } from '@/lib/hooks';
import { shortcutsModalUpdated } from '@/features/navigation/slice';

export function useShortcuts() {
  const t = useTranslations('useShortcuts');
  const { navigateToHome } = useNavigate();
  const { toggleSidebar } = useSidebar();
  const dispatch = useAppDispatch();

  const shortcuts = {
    startNewChat: {
      label: t('startNewChat'),
      keys: 'meta+shift+o',
      callback: navigateToHome,
    },
    focusInput: {
      label: t('focusInput'),
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
      label: t('toggleSidebar'),
      keys: 'meta+shift+s',
      callback: toggleSidebar,
    },
    openShortcutsModal: {
      label: t('openShortcuts'),
      keys: 'meta+y',
      callback: () => {
        dispatch(shortcutsModalUpdated(true));
      },
    },
  };

  return shortcuts;
}
