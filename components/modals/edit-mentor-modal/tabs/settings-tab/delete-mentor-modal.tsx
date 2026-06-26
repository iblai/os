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
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useDeleteMentorMutation } from '@iblai/iblai-js/data-layer';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { urlRoutes } from '@/url-routes';
import { useTranslations } from 'next-intl';

interface DeleteMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteMentorModal({ isOpen, onClose }: DeleteMentorModalProps) {
  const t = useTranslations('settingsTabDeleteMentorModal');
  const router = useRouter();
  const [deleteMentor, { isLoading }] = useDeleteMentorMutation();
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId, closeEditMentorModal } = useNavigate();

  const activeMentorId = getMentorId() ?? mentorId;

  const handleDelete = async () => {
    try {
      await deleteMentor({
        name: activeMentorId,
        org: tenantKey,
        // @ts-ignore
        userId: username ?? '',
      }).unwrap();
      onClose();
      // wait for the modal to close
      // avoid race conditions
      await new Promise((resolve) => setTimeout(resolve, 10));
      closeEditMentorModal();
      toast.success(t('deleteSuccess'));

      if (activeMentorId === mentorId) {
        router.replace(urlRoutes.platform.explore(tenantKey));
        return;
      }

      if (activeMentorId === getMentorId()) {
        return;
      }
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error(t('deleteError'));
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onClose}
            disabled={isLoading}
            className="ibl-button-primary"
          >
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async (event) => {
              event.preventDefault();
              await handleDelete();
            }}
            disabled={isLoading}
            className="border-input bg-background text-accent-foreground hover:bg-accent hover:text-accent-foreground border"
          >
            {isLoading ? t('deleting') : t('delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
