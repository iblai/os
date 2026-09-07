import { useSearchParams } from 'next/navigation';

import { QUERY_PARAMS } from '@/lib/constants';
import { getEmbedContext } from '@/lib/embed-context';

// The `agent-ai` web component always stamps `mode=anonymous` on its iframe URL;
// the script-tag bubble embed never does. The bubble keeps a launcher on screen
// to reopen a closed widget, so its close affordance stays on by default, while
// `agent-ai` hosts (inline, no launcher) must opt in with `show-close-button=true`.
const AGENT_AI_EMBED_MODE = 'anonymous';

export function useShowCloseButton(): boolean {
  const searchParams = useSearchParams();

  function readParam(key: string): string | null {
    return searchParams.get(key) ?? getEmbedContext()?.[key] ?? null;
  }

  if (readParam(QUERY_PARAMS.SHOW_CLOSE_BUTTON) === 'true') return true;
  // The Embed tab's own preview iframe mirrors the bubble embed, so it keeps the
  // close affordance even though it carries `mode=anonymous`.
  if (readParam(QUERY_PARAMS.INTERNAL_PREVIEW) === 'true') return true;
  return readParam(QUERY_PARAMS.MODE) !== AGENT_AI_EMBED_MODE;
}
