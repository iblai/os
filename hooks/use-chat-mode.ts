import { useSearchParams } from 'next/navigation';

export function useChatMode() {
  const searchParams = useSearchParams();
  return (searchParams.get('chat') ?? 'default') as 'default' | 'advanced';
}
