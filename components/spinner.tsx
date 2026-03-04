import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function Spinner({ className }: Props) {
  return (
    <div
      data-testid="spinner"
      className={cn('flex h-full w-full items-center justify-center', className)}
    >
      <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
    </div>
  );
}
