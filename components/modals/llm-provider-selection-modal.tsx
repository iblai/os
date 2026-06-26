'use client';

import React from 'react';

import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from '@/components/ui/dialog';
import { LLMTab } from './edit-mentor-modal/tabs';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function LLMProviderSelectionModal({ isOpen, onClose }: Props) {
  const t = useTranslations('modalsLlmProviderSelectionModal');
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-full max-w-5xl gap-3 overflow-y-auto">
        <DialogDescription className="sr-only">
          {t('selectProviderDescription')}
        </DialogDescription>
        <DialogHeader className="mb-0">
          <DialogTitle className="ibl-dialog-title">{t('title')}</DialogTitle>
        </DialogHeader>
        <LLMTab showConfigurationHeader={false} />
      </DialogContent>
    </Dialog>
  );
}
