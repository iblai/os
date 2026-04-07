import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDeleteTrainingDocumentMutation } from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { toast } from 'sonner';
import { useUsername } from '@/hooks/use-user';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  dataset: Dataset;
};

export type Dataset = {
  id: string;
};

export function DeleteDatasetModal({ isOpen, onClose, dataset }: Props) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const [deleteTrainingDocument, { isLoading }] =
    useDeleteTrainingDocumentMutation();

  const handleDeleteTrainingDocument = async () => {
    try {
      await deleteTrainingDocument({
        documentId: dataset.id,
        org: tenantKey,
        // @ts-ignore
        userId: username ?? '',
      }).unwrap();
      toast.success('Training document deleted successfully');
    } catch (error) {
      toast.error('Failed to delete training document');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby="delete-dataset-description">
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">Delete Dataset</DialogTitle>
        </DialogHeader>
        <div className="my-5">
          <p className="text-sm text-[#646464]">
            You have successfully untrained a dataset, do you want to delete it?
            This action cannot be undone.
          </p>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
            onClick={handleDeleteTrainingDocument}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
