import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Markdown from '@/components/markdown';
import { parsePrompt } from '@/lib/utils';

type Props = {
  isOpen: boolean;
  onAgree: () => void;
  isAgreeing: boolean;
  content?: string;
};

export function DisclaimerModal({
  isOpen,
  onAgree,
  isAgreeing,
  content,
}: Props) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl gap-0 p-0"
        showCloseButton={false}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-left text-xl font-semibold">
            User Agreement
          </DialogTitle>
          <Separator className="mt-4" />
        </DialogHeader>

        <div className="flex h-full flex-col">
          <ScrollArea className="max-h-[60vh] flex-1 px-6">
            <div className="space-y-4 pb-4 text-sm leading-relaxed">
              <Markdown className="text-gray-700">
                {parsePrompt(content ?? '')}
              </Markdown>
            </div>
          </ScrollArea>

          <div className="border-t p-6 pt-4">
            <Button
              onClick={onAgree}
              className="ibl-button-primary w-full"
              disabled={isAgreeing}
            >
              {isAgreeing ? 'Submitting...' : 'I Accept'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
