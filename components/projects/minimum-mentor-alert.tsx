'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MinimumMentorAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MinimumMentorAlert({ open, onOpenChange }: MinimumMentorAlertProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='space-y-1'>
        <DialogHeader>
          <DialogTitle className='mb-4'>Cannot Remove Mentor</DialogTitle>
          <DialogDescription>
            A project must have at least one mentor. Please add another mentor before removing
            this one.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="ibl-button-primary"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}