import { cn } from '@/lib/utils';

type LoginRequiredBannerProps = {
  message: string;
  actionLabel: string;
  onAction: () => void;
  className?: string;
};

export function LoginRequiredBanner({ message, className }: LoginRequiredBannerProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-center gap-3 rounded-md border border-[#C6D4FF] bg-[#EFF4FF] px-4 py-3 text-sm text-[#1C3F7C] shadow-sm',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="font-medium">{message}</p>
    </div>
  );
}
