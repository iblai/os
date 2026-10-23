'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { QUERY_PARAMS } from '@/lib/constants';
import { getEmbedContext } from '@/lib/embed-context';

export const BROWSE_HELLO = 'MENTOR:BROWSE_HELLO';
export const BROWSE_READY = 'MENTOR:BROWSE_READY';

/**
 * Whether this app is running inside the ibl.ai Chrome extension's side panel.
 *
 * The panel's `<agent-ai enablecowork>` puts `enable-cowork=true` on the iframe
 * URL (kept in the embed context across navigations), so the answer is there on
 * the first render — which the SDK's Cowork pill needs: it reads this once, when
 * it mounts. An extension from before that flag still gets the handshake: it
 * answers `MENTOR:BROWSE_HELLO` with `MENTOR:BROWSE_READY`
 * (`extensions/chrome/src/browse-bridge.ts`), after mount. Either way a true
 * means the Browse pill has somewhere to send a goal, not merely that we are in
 * some iframe.
 */
export function useInExtensionPanel(): boolean {
  const searchParams = useSearchParams();
  const flagged =
    searchParams?.get(QUERY_PARAMS.ENABLE_COWORK) === 'true' ||
    (typeof window !== 'undefined' &&
      getEmbedContext()?.[QUERY_PARAMS.ENABLE_COWORK] === 'true');
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    // The flag has answered; and a top-level tab has no parent to ask.
    if (flagged || typeof window === 'undefined' || window.parent === window)
      return;

    // `'*'` because the app cannot know the extension's `chrome-extension://<id>`
    // origin. Safe: the hello carries nothing, and the panel validates both the
    // origin and the source of everything it accepts back.
    const ask = () => window.parent.postMessage({ type: BROWSE_HELLO }, '*');

    // The panel installs its listener with the iframe, but the app can finish
    // booting first; a few retries cover either order without polling forever.
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries >= 10) return clearInterval(timer);
      ask();
    }, 300);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if ((event.data as { type?: unknown } | null)?.type !== BROWSE_READY)
        return;
      setAnswered(true);
      clearInterval(timer);
    };
    window.addEventListener('message', onMessage);
    ask();

    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
    };
  }, [flagged]);

  return flagged || answered;
}
