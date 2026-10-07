import { useSearchParams } from 'next/navigation';

import { QUERY_PARAMS } from '@/lib/constants';
import { getEmbedContext } from '@/lib/embed-context';

/**
 * True when the chat runs inside an LMS course page (an LTI launch). The
 * launch URL carries `lti=true` next to `embed=true`; it is read from the live
 * URL first, then from the persisted embed context so in-app navigations that
 * drop the query string keep it. An LTI frame has no launcher bubble to reopen
 * a closed chat, so the embed header shows no close button there.
 */
export function useIsLtiLaunch(): boolean {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get(QUERY_PARAMS.LTI);
  if (fromUrl !== null) return fromUrl === 'true';
  return getEmbedContext()?.[QUERY_PARAMS.LTI] === 'true';
}
