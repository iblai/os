import { useEffect, useRef, useState } from 'react';
import { clearSession, ensureSignedIn, isAuthed, username } from './auth';
import { t } from './i18n';
import { MentorChat } from './mentor-chat';
import { BrandMark } from './brand-mark';

/**
 * How long the sign-in window gets before the panel offers the button too.
 *
 * `launchWebAuthFlow` settles only when that window does, so a window that
 * opened behind the browser — or never opened — left the panel animating with
 * nothing to press, for as long as the panel stayed open. A wait is not a
 * conclusion: the flow is still running when this fires, and the button is
 * offered beside it rather than instead of it.
 */
const OFFER_BUTTON_AFTER_MS = 8000;

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
  const [waited, setWaited] = useState(false);

  // Every attempt carries a number and only the newest may write the UI. Two
  // flows can overlap now that a stuck one no longer blocks the button, and
  // the one the user gave up on still settles later — closing its window
  // rejects it — which must not land on top of the sign-in that worked.
  const attempt = useRef(0);

  // The next sign-in must offer a different account. Set by signing out, and
  // spent on the sign-in that follows.
  const fresh = useRef(false);

  const signIn = async () => {
    const mine = ++attempt.current;
    setAuthError(null);
    setWaited(false);
    setAuthed(null);
    const offer = setTimeout(() => {
      if (attempt.current === mine) setWaited(true);
    }, OFFER_BUTTON_AFTER_MS);
    try {
      const ok = await ensureSignedIn(fresh.current);
      fresh.current = false;
      if (attempt.current === mine) setAuthed(ok);
    } catch (err) {
      console.error('[ibl.ai panel] sign-in failed:', err);
      if (attempt.current === mine) {
        setAuthError(t('signInFailed'));
        setAuthed(false);
      }
    } finally {
      clearTimeout(offer);
      if (attempt.current === mine) setWaited(false);
    }
  };

  const signOut = () => {
    clearSession();
    // Abandon any flow still running, so its late result cannot sign the
    // person back in after they asked to leave.
    attempt.current += 1;
    fresh.current = true;
    setAuthError(null);
    setWaited(false);
    setAuthed(false);
  };

  useEffect(() => {
    if (!authed) void signIn();
    // Runs once at mount; a retry goes through the button below.
  }, []);

  // Pending: say so rather than painting nothing. The sign-in can take as long
  // as the user needs in the auth window, and a blank panel for all of it
  // gives them nothing to read.
  if (authed === null && !waited) {
    return (
      <div className="panel">
        <BrandMark label={t('signingIn')} />
      </div>
    );
  }

  if (authed) {
    return (
      <div className="panel">
        <MentorChat onSignOut={signOut} who={username()} />
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="signin">
        {authError ? (
          <div className="row-error">{authError}</div>
        ) : (
          <p className="row-note">{t('signInWindow')}</p>
        )}
        <button type="button" className="primary" onClick={() => void signIn()}>
          {t('signIn')}
        </button>
      </div>
    </div>
  );
}
