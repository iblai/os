import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CheckIcon } from 'lucide-react';
import { CopyIcon } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
};

export function ApiKeyModal({ isOpen, onClose, apiKey }: Props) {
  const { copy, status } = useCopyToClipboard(800);

  const Icon = status === 'success' ? CheckIcon : CopyIcon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">API Key</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Copy and paste the API key.
        </DialogDescription>
        <div className="grid gap-6">
          <p className="text-muted-foreground grid gap-2 text-sm">
            <span>
              Please copy your API key and store it in a secure location. For
              security reasons, this key will only be displayed once and cannot
              be retrieved again after you leave this page.
            </span>
            <span>
              If you lose your API key, you'll need to generate a new one.
            </span>
          </p>
          <div className="flex items-center gap-4">
            <Input defaultValue={apiKey} readOnly />
            <Button
              size="icon"
              className="ibl-button-primary cursor-pointer"
              onClick={() => copy(apiKey)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
