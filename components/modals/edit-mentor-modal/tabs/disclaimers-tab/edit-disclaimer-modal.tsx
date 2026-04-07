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

interface EditDisclaimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disclaimer: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function EditDisclaimerModal({
  open,
  onOpenChange,
  disclaimer,
  onSave,
  onCancel,
  isSaving = false,
}: EditDisclaimerModalProps) {
  const [content, setContent] = React.useState(disclaimer ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-2xl sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-700">Edit Advisory</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              Advisory Content
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter advisory content..."
              className="mt-1 min-h-[200px]"
              rows={8}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => onSave(content)}
              className="ibl-button-primary"
              disabled={content.trim() === '' || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
