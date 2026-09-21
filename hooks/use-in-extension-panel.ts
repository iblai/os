'use client';

import { useEffect, useState } from 'react';

export const BROWSE_HELLO = 'MENTOR:BROWSE_HELLO';
export const BROWSE_READY = 'MENTOR:BROWSE_READY';

/**
 * Whether this app is running inside the ibl.ai Chrome extension's side panel.
 *
 * The panel answers `MENTOR:BROWSE_HELLO` with `MENTOR:BROWSE_READY`
 * (`extensions/chrome/src/browse-bridge.ts`), which is also the panel telling us
 * it can drive the browser — so a true here means the Browse pill has somewhere
 * to send a goal, not merely that we are in some iframe.
 *
 * Detected AFTER mount, never during render: the handshake is asynchronous, so a
 * render-time read would latch false forever and would mismatch prerendered HTML
 * during hydration. Same reason the Tauri gate in
 * `components/chat-input-form/inside-buttons.tsx` is written this way.
 */
export function useInExtensionPanel(): boolean {
  const [inPanel, setInPanel] = useState(false);

  useEffect(() => {
    // No parent to ask: a top-level tab is never the panel.
    if (typeof window === 'undefined' || window.parent === window) return;

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
      setInPanel(true);
      clearInterval(timer);
    };
    window.addEventListener('message', onMessage);
    ask();

    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(timer);
    };
  }, []);

  return inPanel;
}
