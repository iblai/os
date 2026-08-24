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

interface AddMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newMemoryContent: string;
  newMemoryCategory: string;
  onContentChange: (content: string) => void;
  onCategoryChange: (category: string) => void;
  onSave: () => void;
  onCancel: () => void;
  categories: string[];
  isSaving: boolean;
}

export function AddMemoryModal({
  open,
  onOpenChange,
  newMemoryContent,
  newMemoryCategory,
  onContentChange,
  onCategoryChange,
  onSave,
  onCancel,
  categories,
  isSaving,
}: AddMemoryModalProps) {
  const t = useTranslations('memoryTabAddMemoryModal');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-2xl sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-700">
            {t('dialogTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              {t('categoryLabel')}
            </label>
            <Select value={newMemoryCategory} onValueChange={onCategoryChange}>
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
              value={newMemoryContent}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={t('memoryPlaceholder')}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              {newMemoryContent.trim().length < 10
                ? t('characterCountMinimum', {
                    count: newMemoryContent.trim().length,
                  })
                : t('characterCount', {
                    count: newMemoryContent.trim().length,
                  })}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t('cancelButton')}
            </Button>
            <Button
              onClick={onSave}
              disabled={newMemoryContent.trim().length < 10 || isSaving}
              className="ibl-button-primary"
            >
              {isSaving ? t('savingButton') : t('saveButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
