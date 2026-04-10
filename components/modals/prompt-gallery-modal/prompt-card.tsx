import {
  Edit,
  MessageSquare,
  Play,
  Copy,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useDeletePromptMutation } from '@iblai/iblai-js/data-layer';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { cn, parsePrompt } from '@/lib/utils';
import { SelectedPrompt } from '../edit-prompt-modal';
import { useUserIsStudent } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import Markdown from '@/components/markdown';

type Props = {
  prompt: SelectedPrompt;
  onEdit: (prompt: SelectedPrompt) => void;
  title: string;
  onSelect?: (promptText: string) => void;
};

export function PromptCard({ prompt, onEdit, onSelect, title }: Props) {
  const { copy, status } = useCopyToClipboard(700);
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const [deletePrompt, { isLoading: isDeleting }] = useDeletePromptMutation();
  const userIsStudent = useUserIsStudent();
  const { executeWithTrialCheck, FreeTrialDialog, closeModal, isModalOpen } =
    useShowFreeTrialDialog();

  const handleEdit = () => {
    onEdit(prompt);
  };

  const handleDelete = async () => {
    try {
      await deletePrompt({ id: prompt.id as number, org: tenantKey }).unwrap();
      toast.success('Prompt deleted successfully');
    } catch (error) {
      toast.error('Failed to delete prompt');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const DeleteIcon = isDeleting ? Loader2 : Trash2;

  const handleRun = () => {
    if (onSelect) {
      onSelect(prompt.prompt);
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-0 bg-[#F8F8F8] transition-shadow hover:shadow-md">
        <CardContent className="h-full p-4">
          <div className="mb-5 flex flex-1 items-start gap-2">
            <MessageSquare className="mt-1 h-4 w-4 flex-shrink-0 text-gray-400" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-600">{title}</h3>
              <Markdown className="mt-1 line-clamp-4 text-sm text-gray-500">
                {parsePrompt(prompt.prompt)}
              </Markdown>
            </div>
          </div>
          <div className="flex flex-wrap justify-start gap-2">
            {!userIsStudent && (
              <Button
                variant="outline"
                size="sm"
                className="flex h-7 items-center border-gray-200 px-3 text-xs font-normal text-gray-600"
                onClick={handleEdit}
                disabled={isDeleting}
              >
                <Edit className="mr-1.5 h-3 w-3" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex h-7 items-center border-gray-200 px-3 text-xs font-normal text-gray-600"
              onClick={() => executeWithTrialCheck(handleRun)}
              disabled={isDeleting}
            >
              <Play className="mr-1.5 h-3 w-3" />
              Run
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex h-7 items-center border-gray-200 px-3 text-xs font-normal text-gray-600"
              onClick={() => copy(prompt.prompt)}
              disabled={isDeleting}
            >
              {status === 'success' ? (
                <>
                  <Check className="mr-1.5 h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3 w-3" /> Copy
                </>
              )}
            </Button>
            {!userIsStudent && (
              <Button
                variant="outline"
                size="sm"
                className="flex h-7 items-center border-gray-200 px-3 text-xs font-normal text-gray-600 hover:text-gray-600"
                onClick={() => executeWithTrialCheck(handleDelete)}
                disabled={isDeleting}
              >
                <DeleteIcon
                  className={cn('mr-1.5 h-3 w-3', isDeleting && 'animate-spin')}
                />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog onClose={closeModal} isOpen={isModalOpen} />
      )}
    </>
  );
}
