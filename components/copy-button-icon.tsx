import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

type Props = {
  text: string;
};

export function CopyButtonIcon({ text }: Props) {
  const { copy, status } = useCopyToClipboard(1000);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => copy(text)}
      aria-label={
        status === 'success'
          ? 'Text copied to clipboard'
          : 'Copy text to clipboard'
      }
    >
      {status === 'success' ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
