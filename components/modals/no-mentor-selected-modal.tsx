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

  const handleExplore = () => {
    onClose();
    navigateToExplore();
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
