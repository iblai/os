import { useEffect, useState } from 'react';
import { ensureSignedIn, isAuthed } from './auth';
import { t } from './i18n';
import { MentorChat } from './mentor-chat';

/**
 * The whole panel: the mentor chat, and nothing above it. Browsing is not a
 * separate surface — it is the Browse pill inside the chat's own composer,
 * which talks to the service worker through `browse-bridge`.
 */
export function App() {
  const [authed, setAuthed] = useState(isAuthed);
  const [authError, setAuthError] = useState<string | null>(null);

  const signIn = async () => {
    setAuthError(null);
    try {
      setAuthed(await ensureSignedIn());
    } catch (err) {
      console.error('[ibl.ai panel] sign-in failed:', err);
      setAuthError(t('signInFailed'));
    }
  };

  useEffect(() => {
    if (!authed) void signIn();
    // Runs once at mount; a retry goes through the button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
