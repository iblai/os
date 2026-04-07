'use client';

import React from 'react';

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
  const [value, setValue] = React.useState(content ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-2xl sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-700">
            Edit User Agreement
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              User Agreement Content
            </label>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter user agreement content..."
              className="mt-1 min-h-[200px]"
              rows={8}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => onSave(value)}
              className="ibl-button-primary"
              disabled={value.trim() === '' || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
