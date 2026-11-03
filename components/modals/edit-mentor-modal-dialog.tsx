import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@iblai/iblai-js/web-containers';

export type Prompt = {
  label: string;
  type: 'systemPrompt' | 'proactivePrompt' | 'guidedPrompt';
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  prompt: Prompt;
  editPrompt: (prompt: string, type: Prompt['type']) => void;
  value: string;
};

export function EditMentorModalDialog({
  isOpen,
  onClose,
  prompt,
  editPrompt,
  value,
}: Props) {
  const t = useTranslations('common');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full">
        <DialogDescription className="sr-only">
          Edit {prompt.label}
        </DialogDescription>
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">{prompt.label}</DialogTitle>
        </DialogHeader>

        <div className="mt-7 grid gap-4">
          <RichTextEditor
            value={value}
            onChange={(e) => editPrompt(e, prompt.type)}
          />
        </div>

        <DialogFooter>
          {/* editPrompt already keeps every keystroke, so Save only closes. */}
          <Button
            type="button"
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
            onClick={onClose}
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
