import { Spinner } from '@/components/spinner';

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="loading..."
      className="flex h-dvh w-screen items-center justify-center"
    >
      <Spinner className="h-14 w-14" />
    </div>
  );
}
