'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useDeleteModerationLogMutation } from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

interface DeleteModerationLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logId: string;
  onDeleteSuccess?: () => void;
}

export function DeleteModerationLogModal({
  isOpen,
  onClose,
  logId,
  onDeleteSuccess,
}: DeleteModerationLogModalProps) {
  const [deleteModerationLog, { isLoading }] = useDeleteModerationLogMutation();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const handleDelete = async () => {
    try {
      await deleteModerationLog({
        // @ts-ignore - passing string expected number
        id: logId,
        org: tenantKey,
        userId: username ?? '',
      }).unwrap();
      onClose();
      // wait for the modal to close
      // avoid race conditions
      await new Promise((resolve) => setTimeout(resolve, 10));
      toast.success('Moderation log deleted successfully');
      onDeleteSuccess?.();
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to delete moderation log');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Moderation Log</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this moderation log? This action
            cannot be undone and will permanently remove this record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onClose}
            disabled={isLoading}
            className="ibl-button-primary"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async (event) => {
              event.preventDefault();
              await handleDelete();
            }}
            disabled={isLoading}
            className="border-input bg-background text-accent-foreground hover:bg-accent hover:text-accent-foreground border"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
