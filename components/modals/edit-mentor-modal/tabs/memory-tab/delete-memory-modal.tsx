'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface DeleteMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function DeleteMemoryModal({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteMemoryModalProps) {
  const t = useTranslations('memoryTabDeleteMemoryModal');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md sm:mx-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {t('confirmationMessage')}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t('cancelButton')}
          </Button>
          <Button
            className="ibl-button-primary"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t('deletingButton') : t('deleteButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
