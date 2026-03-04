import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export function DisclaimerModal({ isOpen, onAgree, isAgreeing, content }: Props) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0" showCloseButton={false}>
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-left">User Agreement</DialogTitle>
          <Separator className="mt-4" />
        </DialogHeader>

        <div className="flex flex-col h-full">
          <ScrollArea className="px-6 flex-1 max-h-[60vh]">
            <div className="space-y-4 text-sm leading-relaxed pb-4">
              <Markdown className="text-gray-700">{parsePrompt(content ?? '')}</Markdown>
            </div>
          </ScrollArea>

          <div className="p-6 pt-4 border-t">
            <Button onClick={onAgree} className="w-full ibl-button-primary" disabled={isAgreeing}>
              {isAgreeing ? 'Submitting...' : 'I Accept'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
