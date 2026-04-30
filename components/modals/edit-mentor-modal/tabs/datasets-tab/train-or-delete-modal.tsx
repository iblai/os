import React from 'react';

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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        aria-describedby="train-or-delete-description"
        className="gap-0"
      >
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">
            What would you like to do?
          </DialogTitle>
        </DialogHeader>
        <div className="my-5">
          <p
            id="train-or-delete-description"
            className="text-sm text-[#646464]"
          >
            This dataset is currently untrained. You can train it to make it
            available for your agent, or permanently delete it if it's no longer
            needed.
          </p>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onDelete} disabled={isLoading}>
            Delete
          </Button>
          <Button
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
            onClick={onTrain}
            disabled={isLoading}
          >
            {isLoading ? 'Training...' : 'Train'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
