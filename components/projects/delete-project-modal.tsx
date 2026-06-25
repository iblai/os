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
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('projectsDeleteProjectModal');
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

      toast.success(t('toastDeleteSuccess'));

      onSuccess?.();

      // If we're currently viewing the deleted project, redirect to explore page
      const currentPath = window.location.pathname;
      if (currentPath.includes(`/projects/${projectId}`)) {
        router.push(`/platform/${tenantKey}/explore`);
      }
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error(t('toastDeleteError'));
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="space-y-1">
        <DialogHeader>
          <DialogTitle className="mb-4">{t('dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('dialogDescription', { projectName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="ibl-button-primary"
          >
            {t('cancelButton')}
          </Button>
          <Button
            variant="outline"
            onClick={async (event) => {
              event.preventDefault();
              await handleDelete();
            }}
            disabled={isLoading}
            className="border-input bg-background text-accent-foreground hover:bg-accent hover:text-accent-foreground border"
          >
            {isLoading ? t('deletingButton') : t('deleteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
