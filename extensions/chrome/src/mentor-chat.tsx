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
import { t } from './i18n';
import { OrgPicker } from './org-picker';
import { MENTOR_URL } from './settings';

// The auth host is its own setting everywhere in this workspace: it is never
// derived from the platform domain.
export const AUTH_URL = 'https://login.iblai.app';
export const LMS_URL = 'https://learn.iblai.app';

interface MentorChatProps {
  onSignOut: () => void;
  /** Who the session belongs to, shown so a sign-out is not a leap of faith. */
  who: string | null;
}

export function MentorChat({ onSignOut, who }: MentorChatProps) {
  const ref = useRef<HTMLElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [notice, setNotice] = useState<
    { kind: 'failed' } | { kind: 'elsewhere'; landed: string } | null
  >(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Before anything else: the element builds its shadow DOM in its
    // constructor, so the spinner is already there and already on top of the
    // iframe.
    removeWidgetSpinner(host);
    const stopInstall = watchAndInstallSession(host);
    const stopTenantSwitch = watchTenantSwitch(host, choose);
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
  const choose = () => {
    setNotice(null);
    setChoosing(true);
  };

  const pick = async (tenant: string) => {
    const host = ref.current;
    if (!host) return;
    // The sign-in window can stay open for as long as the person needs, so say
    // a switch is happening and stop taking picks until it lands. Keep the list
    // up until then: a pick that cannot complete must not close the picker and
    // leave nothing happening.
    setNotice(null);
    setSwitching(true);
    try {
      const outcome = await switchToOrganization(host, tenant);
      if (outcome.kind === 'switched') {
        setChoosing(false);
        return;
      }
      // Signed in, but not where they asked. The chat has followed that session,
      // so the picker says which organization they are actually in — it holds
      // the names, so it can show one rather than a tenant key.
      setNotice(outcome);
    } finally {
      setSwitching(false);
    }
  };

  // The picker sits over the chat rather than replacing it: the switch
  // remounts the iframe, and unmounting the element to show a list would tear
  // the chat down for a choice the person may well cancel.
  return (
    <>
      {choosing && (
        <OrgPicker
          current={org()}
          onPick={(tenant) => void pick(tenant)}
          onCancel={() => setChoosing(false)}
          notice={notice}
          switching={switching}
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
        extraparams="client=chrome-extension"
        enablecowork=""
      />
      {/* Below the chat, never above it: the panel is the chat, and the
          account is the one thing it cannot offer from inside the iframe —
          the session being signed out of is this page's, not the app's. */}
      <div className="account">
        {who && <span className="account-who">{who}</span>}
        <button type="button" className="account-out" onClick={onSignOut}>
          {t('signOut')}
        </button>
      </div>
    </>
  );
}
