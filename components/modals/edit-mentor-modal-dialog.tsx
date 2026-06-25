import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
      </DialogContent>
    </Dialog>
  );
}
