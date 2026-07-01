'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface EditMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editContent: string;
  editCategory: string;
  onContentChange: (content: string) => void;
  onCategoryChange: (category: string) => void;
  onSave: () => void;
  onCancel: () => void;
  categories: string[];
  isSaving: boolean;
}

export function EditMemoryModal({
  open,
  onOpenChange,
  editContent,
  editCategory,
  onContentChange,
  onCategoryChange,
  onSave,
  onCancel,
  categories,
  isSaving,
}: EditMemoryModalProps) {
  const t = useTranslations('memoryTabEditMemoryModal');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-2xl sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-700">{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              {t('categoryLabel')}
            </label>
            <Select value={editCategory} onValueChange={onCategoryChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t('categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((cat) => cat !== 'All')
                  .map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">
              {t('memoryLabel')}
            </label>
            <Textarea
              value={editContent}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={t('memoryPlaceholder')}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              {editContent.trim().length < 10
                ? t('charCountMinimum', { count: editContent.trim().length })
                : t('charCount', { count: editContent.trim().length })}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t('cancelButton')}
            </Button>
            <Button
              onClick={onSave}
              className="ibl-button-primary"
              disabled={editContent.trim().length < 10 || isSaving}
            >
              {isSaving ? t('savingButton') : t('saveButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
