import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TenantKeyMentorIdParams } from '@/lib/types';

interface CopyCodeBlockProps {
  code: string;
  className?: string;
}

export const CopyCodeBlock = ({ code, className }: CopyCodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      console.error(JSON.stringify({ tenant: tenantKey, error: err }));
    }
  };

  return (
    <div
      className={cn(
        'bg-muted relative w-full max-w-full overflow-x-auto rounded-xl border p-1 pr-[40px] font-mono text-sm whitespace-nowrap',
        className,
      )}
    >
      <pre className="max-w-full overflow-x-auto whitespace-nowrap">{code}</pre>
      <Button
        onClick={handleCopy}
        variant="ghost"
        size="icon"
        className="absolute top-2 right-4 h-2 w-2 cursor-pointer"
      >
        {copied ? <Check className="h-2 w-2 text-blue-500" /> : <Copy className="h-1 w-1" />}
      </Button>
    </div>
  );
};
