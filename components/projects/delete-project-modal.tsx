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
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useDeleteUserProjectMutation } from '@iblai/iblai-js/data-layer';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onSuccess?: () => void;
}

export function DeleteProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onSuccess,
}: DeleteProjectModalProps) {
  const router = useRouter();
  const [deleteProject, { isLoading }] = useDeleteUserProjectMutation();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const handleDelete = async () => {
    if (!username || !tenantKey) return;

    try {
      await deleteProject({
        tenantKey,
        username,
        id: parseInt(projectId),
      }).unwrap();

      onClose();

      // Wait for the modal to close to avoid race conditions
      await new Promise((resolve) => setTimeout(resolve, 10));

      toast.success('Project deleted successfully');

      onSuccess?.();

      // If we're currently viewing the deleted project, redirect to explore page
      const currentPath = window.location.pathname;
      if (currentPath.includes(`/projects/${projectId}`)) {
        router.push(`/platform/${tenantKey}/explore`);
      }
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to delete project');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="space-y-1">
        <DialogHeader>
          <DialogTitle className="mb-4">Delete Project</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{projectName}"? This action cannot be undone and will
            permanently remove the project and all associated data including chats, files, and
            settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="ibl-button-primary"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={async (event) => {
              event.preventDefault();
              await handleDelete();
            }}
            disabled={isLoading}
            className="border border-input bg-background text-accent-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {isLoading ? 'Deleting...' : 'Delete Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
