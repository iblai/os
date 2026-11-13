import { useEffect, useRef, useState } from 'react';
import { ensureSignedIn, isAuthed } from './auth';
import { t } from './i18n';
import { MentorChat } from './mentor-chat';

/**
 * The whole panel: the mentor chat, and nothing above it. Browsing is not a
 * separate surface — it is the Browse pill inside the chat's own composer,
 * which talks to the service worker through `browse-bridge`.
 */
export function App() {
  // `null` is "not known yet". Starting at `false` renders the sign-in button
  // for the frame before `ensureSignedIn` answers, so anyone already signed in
  // sees it flash on every open. Signed out is a conclusion, not a default.
  const [authed, setAuthed] = useState<boolean | null>(() =>
    isAuthed() ? true : null,
  );
  const [authError, setAuthError] = useState<string | null>(null);

  // One sign-in at a time: two flows racing means whichever finishes last
  // writes the session, so a slow first attempt can land on top of the one
  // that actually succeeded.
  //
  // What stops it from the UI is `setAuthed(null)` below — the pending screen
  // replaces the button, so there is nothing left to click. This ref covers
  // the rest: anything calling `signIn` without going through that button.
  const signingIn = useRef(false);

  const signIn = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setAuthError(null);
    // Back to "working" for a retry too, not just the first attempt.
    setAuthed(null);
    try {
      setAuthed(await ensureSignedIn());
    } catch (err) {
      console.error('[ibl.ai panel] sign-in failed:', err);
      setAuthError(t('signInFailed'));
      setAuthed(false);
    } finally {
      signingIn.current = false;
    }
  };

  useEffect(() => {
    if (!authed) void signIn();
    // Runs once at mount; a retry goes through the button below.
  }, []);

  // Pending: say so rather than painting nothing. The sign-in can take as long
  // as the user needs in the auth window, and a blank panel for all of it
  // gives them nothing to read. Closing that window rejects the flow, which
  // lands on the button below.
  if (authed === null) {
    return (
      <div className="panel">
        <div className="signin">{t('signingIn')}</div>
      </div>
    );
  }

  return (
    <div className="panel">
      {authed ? (
        <MentorChat />
      ) : (
        <div className="signin">
          {authError && <div className="row-error">{authError}</div>}
          <button
            type="button"
            className="primary"
            onClick={() => void signIn()}
          >
            {t('signIn')}
          </button>
        </div>
      )}
    </div>
  );
}
