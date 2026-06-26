'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BulkDeleteMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
  selectedCategory: string;
}

export function BulkDeleteMemoryModal({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isDeleting,
  selectedCategory,
}: BulkDeleteMemoryModalProps) {
  const t = useTranslations('memoryTabBulkDeleteMemoryModal');
  const isDeleteAll = selectedCategory === 'All';

  const getConfirmationText = () => {
    if (isDeleteAll) {
      return t('confirmationTextAll');
    }

    return t('confirmationTextCategory', { category: selectedCategory });
  };

  const getTitle = () => {
    if (isDeleteAll) {
      return t('titleAll');
    }

    return t('titleCategory', { category: selectedCategory });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md sm:mx-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{getConfirmationText()}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
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
