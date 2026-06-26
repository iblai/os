'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onTrain: () => void;
  onDelete: () => void;
  isLoading?: boolean;
};

export function TrainOrDeleteModal({
  isOpen,
  onClose,
  onTrain,
  onDelete,
  isLoading,
}: Props) {
  const t = useTranslations('datasetsTabTrainOrDeleteModal');
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        aria-describedby="train-or-delete-description"
        className="gap-0"
      >
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">
            {t('dialogTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="my-5">
          <p
            id="train-or-delete-description"
            className="text-sm text-[#646464]"
          >
            {t('description')}
          </p>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onDelete} disabled={isLoading}>
            {t('deleteButton')}
          </Button>
          <Button
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
            onClick={onTrain}
            disabled={isLoading}
          >
            {isLoading ? t('trainingButton') : t('trainButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
