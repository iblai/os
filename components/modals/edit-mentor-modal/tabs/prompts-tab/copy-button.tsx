import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

type Props = {
  text: string;
  disabled?: boolean;
};

export function CopyButton({ text, disabled = false }: Props) {
  const { copy, status } = useCopyToClipboard(1000);

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 flex-1 py-5"
      disabled={disabled}
      onClick={() => copy(text)}
      aria-label={
        status === 'success'
          ? 'Text copied to clipboard'
          : 'Copy text to clipboard'
      }
    >
      <Copy className="mr-2 h-4 w-4" />
      {status === 'success' ? 'Copied' : 'Copy'}
    </Button>
  );
}
