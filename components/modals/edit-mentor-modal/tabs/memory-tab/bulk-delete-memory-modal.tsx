'use client';

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
  const isDeleteAll = selectedCategory === 'All';

  const getConfirmationText = () => {
    if (isDeleteAll) {
      return 'Are you sure you want to delete all memories? This action cannot be undone.';
    }

    return `Are you sure you want to delete all memories in the ${selectedCategory} category? This action cannot be undone.`;
  };

  const getTitle = () => {
    if (isDeleteAll) {
      return 'Delete All Memories';
    }

    return `Delete All ${selectedCategory} Memories`;
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
            Cancel
          </Button>
          <Button
            className="ibl-button-primary"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
