'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { useDeleteEvalRunMutation } from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  runName: string;
};

export function DeleteRunModal({
  isOpen,
  onClose,
  datasetName,
  runName,
}: Props) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const [deleteRun, { isLoading }] = useDeleteEvalRunMutation();

  async function handleDeleteRun() {
    try {
      await deleteRun({
        org: tenantKey,
        userId: username ?? '',
        datasetName,
        runName,
      }).unwrap();
      toast.success('Run deleted');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete run');
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="w-full max-w-md"
        aria-describedby="delete-eval-run-description"
      >
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">Delete Run</DialogTitle>
        </DialogHeader>
        <div className="my-5">
          <p
            id="delete-eval-run-description"
            className="text-sm text-[#646464]"
          >
            Are you sure you want to delete the run{' '}
            <span className="font-bold italic">{runName}</span>? This action
            cannot be undone.
          </p>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
            onClick={handleDeleteRun}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
