import React, { useCallback } from 'react';

export const MessageBridgeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  /**
   * STEP 1 — Register this window with parent site (e.g Canvas LMS)
   *
   * - If the app is opened in a TAB → window.opener exists → send MENTOR:REGISTER_TAB
   * - If the app is in an IFRAME → window.parent exists and is different → send MENTOR:REGISTER_IFRAME
   *
   * External site stores and remembers the reference to this window.
   * If external site refreshes, mentor AI need to register again, so we call this periodically too.
   */
  const registerWithParent = useCallback(() => {
    if (window.opener) {
      // Running as mentor AI in a standalone tab for external chat actions (e.g. Screensharing)
      window.opener.postMessage({ type: 'MENTOR:REGISTER_TAB' }, '*');
    }
  }, []);

  /**
   * STEP 2 — Re-register continuously (heartbeat)
   *
   * If external site refreshes, it loses its reference to tabs.
   * Tabs and iframe re-register every 2s until external site is ready again.
   */
  React.useEffect(() => {
    registerWithParent(); // initial register
    const timer = setInterval(registerWithParent, 2000); // keep registering until external site is stable
    return () => clearInterval(timer);
  }, [registerWithParent]);

  return <>{children}</>;
};
