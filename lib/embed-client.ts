import { EMBED_CLIENTS, QUERY_PARAMS } from '@/lib/constants';
import { getEmbedContext } from '@/lib/embed-context';

/**
 * Whether the host named itself the Chrome extension on the iframe URL.
 *
 * A plain function rather than a hook so both the extension and the Cowork
 * hooks can ask without one depending on the other.
 */
export function isChromeExtensionClient(
  searchParams?: URLSearchParams | null,
): boolean {
  if (searchParams?.get(QUERY_PARAMS.CLIENT) === EMBED_CLIENTS.CHROME_EXTENSION)
    return true;
  if (typeof window === 'undefined') return false;
  return (
    getEmbedContext()?.[QUERY_PARAMS.CLIENT] === EMBED_CLIENTS.CHROME_EXTENSION
  );
}
