import { useEffect, useRef } from 'react';
import { startBrowseBridge } from './browse-bridge';
import {
  removeWidgetSpinner,
  startContextFeed,
  watchAndInstallSession,
} from './mentor-frame';
import { MENTOR_URL } from './settings';

// The auth host is its own setting everywhere in this workspace: it is never
// derived from the platform domain.
export const AUTH_URL = 'https://login.iblai.app';
export const LMS_URL = 'https://learn.iblai.app';

export function MentorChat() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Before anything else: the element builds its shadow DOM in its
    // constructor, so the spinner is already there and already on top of the
    // iframe.
    removeWidgetSpinner(host);
    const stopInstall = watchAndInstallSession(host);
    const stopFeed = startContextFeed(host);
    const stopBridge = startBrowseBridge(host);
    return () => {
      stopInstall();
      stopFeed();
      stopBridge();
    };
  }, []);

  // Sizing lives in panel.css so the component fills the panel.
  // `authrelyonhost` makes it read the session this page holds instead of
  // redirecting.
  return (
    <agent-ai
      ref={ref}
      mentorurl={MENTOR_URL}
      authurl={AUTH_URL}
      lmsurl={LMS_URL}
      theme="light"
      component="chat"
      authrelyonhost=""
    />
  );
}
