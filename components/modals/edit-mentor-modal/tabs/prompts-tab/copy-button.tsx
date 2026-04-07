import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

type Props = {
  text: string;
  disabled?: boolean;
  className?: string;
};

export function CopyButton({ text, disabled = false, className }: Props) {
  const { copy, status } = useCopyToClipboard(1000);

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'flex h-8 flex-1 items-center justify-center gap-2 py-5',
        className,
      )}
      disabled={disabled}
      onClick={() => copy(text)}
      aria-label={
        status === 'success'
          ? 'Text copied to clipboard'
          : 'Copy text to clipboard'
      }
    >
      <Copy className="h-4 w-4" />
      <span>{status === 'success' ? 'Copied' : 'Copy'}</span>
    </Button>
  );
}
