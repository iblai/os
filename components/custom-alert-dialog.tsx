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
import { useCustomAlertDialog } from '@/hooks/use-custom-alert-dialog';
import { useTranslations } from 'next-intl';

interface CustomAlertDialogProps {
  message: string;
  validateTrigger: string;
  cancelTrigger?: string;
  title?: string;
  isOpen: boolean;
}

export function CustomAlertDialog({
  message,
  validateTrigger,
  cancelTrigger = '',
  title,
  isOpen,
}: CustomAlertDialogProps) {
  const t = useTranslations('componentsCustomAlertDialog');
  const { triggerHandler } = useCustomAlertDialog();
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t('areYouSure')}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => triggerHandler(cancelTrigger)}>
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => triggerHandler(validateTrigger)}>
            {t('continue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
