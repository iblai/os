import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDeleteApiKeyMutation } from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { toast } from 'sonner';
type Props = {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey;
};

export type ApiKey = {
  name: string;
};

export function DeleteApiModal({ isOpen, onClose, apiKey }: Props) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();

  const [deleteApiKey, { isLoading }] = useDeleteApiKeyMutation();

  async function handleDeleteApiKey() {
    try {
      await deleteApiKey({
        name: apiKey.name,
        platformKey: tenantKey,
      }).unwrap();
      toast.success('API Key deleted successfully');
      onClose();
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to delete API Key');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby="delete-api-key-description">
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">Delete API Key</DialogTitle>
        </DialogHeader>
        <div className="my-5">
          <p className="text-sm text-[#646464]">
            Are you sure you want to delete the API Key with the name{' '}
            <span className="font-bold italic">{apiKey.name}</span>? This action cannot be undone.
          </p>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
            onClick={handleDeleteApiKey}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
