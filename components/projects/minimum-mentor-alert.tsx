'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MinimumMentorAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MinimumMentorAlert({
  open,
  onOpenChange,
}: MinimumMentorAlertProps) {
  const t = useTranslations('projectsMinimumMentorAlert');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="space-y-1">
        <DialogHeader>
          <DialogTitle className="mb-4">{t('cannotRemoveAgent')}</DialogTitle>
          <DialogDescription>{t('minimumAgentWarning')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="ibl-button-primary"
          >
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
