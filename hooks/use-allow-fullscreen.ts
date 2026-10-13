import { useSearchParams } from 'next/navigation';

import { QUERY_PARAMS } from '@/lib/constants';
import { getEmbedContext } from '@/lib/embed-context';

export function useAllowFullscreen(): boolean {
  const searchParams = useSearchParams();
  const value =
    searchParams.get(QUERY_PARAMS.ALLOW_FULLSCREEN) ??
    getEmbedContext()?.[QUERY_PARAMS.ALLOW_FULLSCREEN];
  return value === 'true';
}
