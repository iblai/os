import { Check, Copy } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

type Props = {
  text: string;
  /**
   * Optional visible text label. When omitted the control keeps its original
   * icon-only square appearance; when set it renders "icon + label" (and swaps
   * the label to "Copied" on success), which is what the code-block header bar
   * uses. The `aria-label` is unchanged in both modes.
   */
  label?: string;
  /** Button visual variant. Defaults to the original bordered `outline` look. */
  variant?: ButtonProps['variant'];
  className?: string;
  'data-testid'?: string;
};

export function CopyButtonIcon({
  text,
  label,
  variant = 'outline',
  className,
  'data-testid': dataTestId,
}: Props) {
  const { copy, status } = useCopyToClipboard(1000);
  const copied = status === 'success';

  return (
    <Button
      variant={variant}
      size={label ? 'sm' : 'icon'}
      className={className}
      data-testid={dataTestId}
      onClick={() => copy(text)}
      aria-label={
        copied ? 'Text copied to clipboard' : 'Copy text to clipboard'
      }
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {label ? <span>{copied ? 'Copied' : label}</span> : null}
    </Button>
  );
}
