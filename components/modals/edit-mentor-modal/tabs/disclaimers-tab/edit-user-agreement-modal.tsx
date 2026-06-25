'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function EditUserAgreementModal({
  open,
  onOpenChange,
  content,
  onSave,
  onCancel,
  isSaving,
}: Props) {
  const t = useTranslations('disclaimersTabEditUserAgreementModal');
  const [value, setValue] = React.useState(content ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-2xl sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-700">{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              {t('contentLabel')}
            </label>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('contentPlaceholder')}
              className="mt-1 min-h-[200px]"
              rows={8}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t('cancelButton')}
            </Button>
            <Button
              onClick={() => onSave(value)}
              className="ibl-button-primary"
              disabled={value.trim() === '' || isSaving}
            >
              {isSaving ? t('savingButton') : t('saveButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
