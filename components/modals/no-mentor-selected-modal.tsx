'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from '@/hooks/user-navigate';
import { useTranslations } from 'next-intl';

interface NoMentorSelectedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NoMentorSelectedModal({
  isOpen,
  onClose,
}: NoMentorSelectedModalProps) {
  const t = useTranslations('modalsNoMentorSelectedModal');
  const { navigateToExplore } = useNavigate();

  const handleExplore = (event: React.MouseEvent) => {
    // Prevent Radix's default "close on action" behaviour. That auto-close
    // fires onOpenChange -> closeModal -> router.push(currentPath), a competing
    // navigation that runs last and clobbers the explore push below (leaving the
    // user on the current page). Navigating to the tenant-scoped explore page
    // (/platform/<tenantKey>/explore) is a route change with no ?modal= param,
    // so it closes this modal on its own — a single navigation, no race.
    event.preventDefault();
    navigateToExplore(true);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} className="ibl-button-primary">
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleExplore}
            className="border-input bg-background text-accent-foreground hover:bg-accent hover:text-accent-foreground border"
          >
            {t('exploreAgents')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
