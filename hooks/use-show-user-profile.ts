import { useSearchParams } from 'next/navigation';

import { QUERY_PARAMS } from '@/lib/constants';
import { getEmbedContext } from '@/lib/embed-context';

// The embedded navbar hides the full user-profile menu by default (embeds are
// usually anonymous, launcher-style widgets). A host opts in by stamping
// `show-user-profile=true` on the iframe URL — the `agent-ai` web component does
// this when its `showuserprofile` attribute is set (see the Chrome extension).
// Read from the live URL first, then the persisted embed context so it survives
// in-app navigations that drop the query string.
export function useShowUserProfile(): boolean {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get(QUERY_PARAMS.SHOW_USER_PROFILE);
  if (fromUrl !== null) return fromUrl === 'true';
  return getEmbedContext()?.[QUERY_PARAMS.SHOW_USER_PROFILE] === 'true';
}
