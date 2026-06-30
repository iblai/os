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
import { useTranslations } from 'next-intl';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
};

export function ApiKeyModal({ isOpen, onClose, apiKey }: Props) {
  const t = useTranslations('apiTabApiKeyModal');
  const { copy, status } = useCopyToClipboard(800);

  const Icon = status === 'success' ? CheckIcon : CopyIcon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">
            {t('dialogTitle')}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          {t('dialogDescription')}
        </DialogDescription>
        <div className="grid gap-6">
          <p className="text-muted-foreground grid gap-2 text-sm">
            <span>{t('securityWarning')}</span>
            <span>{t('lostKeyWarning')}</span>
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
