import { useEffect, useRef, useState } from 'react';
import { org } from './auth';
import { startBrowseBridge } from './browse-bridge';
import {
  removeWidgetSpinner,
  startContextFeed,
  switchToOrganization,
  watchAndInstallSession,
  watchAuthExpired,
  watchTenantSwitch,
} from './mentor-frame';
import { OrgPicker } from './org-picker';
import { MENTOR_URL } from './settings';

// The auth host is its own setting everywhere in this workspace: it is never
// derived from the platform domain.
export const AUTH_URL = 'https://login.iblai.app';
export const LMS_URL = 'https://learn.iblai.app';

export function MentorChat() {
  const ref = useRef<HTMLElement>(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Before anything else: the element builds its shadow DOM in its
    // constructor, so the spinner is already there and already on top of the
    // iframe.
    removeWidgetSpinner(host);
    const stopInstall = watchAndInstallSession(host);
    const stopTenantSwitch = watchTenantSwitch(host, () => setChoosing(true));
    const stopAuthExpired = watchAuthExpired(host);
    const stopFeed = startContextFeed(host);
    const stopBridge = startBrowseBridge(host);
    return () => {
      stopInstall();
      stopTenantSwitch();
      stopAuthExpired();
      stopFeed();
      stopBridge();
    };
  }, []);

  // Sizing lives in panel.css so the component fills the panel.
  // `authrelyonhost` makes it read the session this page holds instead of
  // redirecting.
  const pick = (tenant: string) => {
    setChoosing(false);
    const host = ref.current;
    if (host) void switchToOrganization(host, tenant);
  };

  // The picker sits over the chat rather than replacing it: the switch
  // remounts the iframe, and unmounting the element to show a list would tear
  // the chat down for a choice the person may well cancel.
  return (
    <>
      {choosing && (
        <OrgPicker
          current={org()}
          onPick={pick}
          onCancel={() => setChoosing(false)}
        />
      )}
      <agent-ai
        ref={ref}
        mentorurl={MENTOR_URL}
        authurl={AUTH_URL}
        lmsurl={LMS_URL}
        theme="light"
        component="chat"
        authrelyonhost=""
        hostownschooser=""
        showuserprofile=""
        allowmentorselection=""
        enablecowork=""
      />
    </>
  );
}
