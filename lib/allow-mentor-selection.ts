import { QUERY_PARAMS } from '@/lib/constants';
import { appendEmbedContext, getEmbedContext } from '@/lib/embed-context';

type ParamReader = Pick<URLSearchParams, 'get'>;

// Host-set display params. Unlike the embed context they aren't persisted, so
// they are carried by hand from the current URL.
const EMBED_VIEW_PARAMS = ['hide-sidebar', 'hide-navbar', 'compact'] as const;

export function isMentorSelectionAllowed(
  searchParams: ParamReader | null,
): boolean {
  if (searchParams?.get(QUERY_PARAMS.ALLOW_MENTOR_SELECTION) === 'true')
    return true;
  return getEmbedContext()?.[QUERY_PARAMS.ALLOW_MENTOR_SELECTION] === 'true';
}

/** Append the embed context and display params so the target stays embedded. */
export function withMentorSelectionEmbedParams(
  url: string,
  searchParams: ParamReader | null,
): string {
  const [beforeHash, hash] = appendEmbedContext(url).split('#');
  const [path, query = ''] = beforeHash.split('?');
  const params = new URLSearchParams(query);
  for (const key of EMBED_VIEW_PARAMS) {
    const value = searchParams?.get(key);
    if (value != null && !params.has(key)) params.set(key, value);
  }
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash !== undefined ? `#${hash}` : ''}`;
}
