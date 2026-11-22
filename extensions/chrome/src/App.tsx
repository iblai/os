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
  // Whether a sign-in window is actually open. Signing out used to leave the
  // panel on the pending screen's wording, answering a button nobody pressed
  // with a note about a window nobody opened.
  const [pending, setPending] = useState(false);

  // Every attempt carries a number and only the newest may write the UI. Two
  // flows can overlap now that a stuck one no longer blocks the button, and
  // the one the user gave up on still settles later — closing its window
  // rejects it — which must not land on top of the sign-in that worked.
  const attempt = useRef(0);

  // The next sign-in must offer a different account. Set by signing out, and
  // spent on the sign-in that succeeds.
  const fresh = useRef(false);

  const signIn = async () => {
    const mine = ++attempt.current;
    const current = () => attempt.current === mine;
    setAuthError(null);
    setWaited(false);
    setPending(true);
    setAuthed(null);
    const offer = setTimeout(() => {
      if (current()) setWaited(true);
    }, OFFER_BUTTON_AFTER_MS);
    try {
      // `current` travels into the flow because the session is written there,
      // not here: an abandoned attempt must not store the account it fetched.
      const ok = await ensureSignedIn(fresh.current, current);
      if (!current()) return;
      // The stored session has the last word, not this attempt's own answer —
      // an earlier flow may be the one that landed it.
      const signedIn = ok || isAuthed();
      // Spent only on a sign-in that worked. Clearing it either way would let
      // an abandoned flow spend the sign-out's request for a different
      // account, and the next click would quietly resume the old one.
      if (signedIn) fresh.current = false;
      setAuthed(signedIn);
    } catch (err) {
      console.error('[ibl.ai panel] sign-in failed:', err);
      if (!current()) return;
      // Closing the second window must not report a failure for the sign-in
      // the first one completed.
      if (isAuthed()) {
        fresh.current = false;
        setAuthed(true);
        return;
      }
      setAuthError(t('signInFailed'));
      setAuthed(false);
    } finally {
      clearTimeout(offer);
      if (current()) {
        setPending(false);
        setWaited(false);
      }
    }
  };

  const signOut = () => {
    clearSession();
    // Abandon any flow still running, so its late result cannot sign the
    // person back in after they asked to leave: the number it carries is now
    // stale, and the session it would have written is dropped unread.
    attempt.current += 1;
    fresh.current = true;
    setAuthError(null);
    setWaited(false);
    setPending(false);
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
        ) : pending ? (
          <p className="row-note">{t('signInWindow')}</p>
        ) : null}
        <button type="button" className="primary" onClick={() => void signIn()}>
          {t('signIn')}
        </button>
      </div>
    </div>
  );
}
