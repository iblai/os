import {
  isAuthRecoveryInProgress,
  markAuthRecovery,
} from '@/lib/auth-recovery-lock';
import { tokenRefreshUrl } from '@/lib/token-refresh';
import { isInIframe, sendMessageToParentWebsite } from '@/lib/utils';

/**
 * What to do when the chat socket rejects a frame with a 401.
 *
 * The app tokens have expired, so we go and get new ones rather than minting
 * them here from the edX session. This is a REFRESH, not a logout: the auth
 * app's `/login/complete` re-mints and returns the user to this exact page
 * with their session intact, and only falls through to a sign-in when the edX
 * JWT is too old to authorise the mint.
 *
 * Embedded, we cannot navigate — that would tear the chat out of the host
 * page — so the host is asked to refresh the session instead, the same
 * hand-off `redirectToAuthSpa` performs for API 401s.
 *
 * The lock is shared with the API 401 path, so a socket 401 and the burst of
 * API 401s that usually accompany it recover once between them.
 *
 * Returns nothing on purpose: `on401Error` resends the rejected frame only
 * when it resolves with a token, and this one cannot be resent here.
 */
export function recoverFromChatAuthFailure(): void {
  if (isAuthRecoveryInProgress()) return;
  markAuthRecovery();

  if (isInIframe()) {
    sendMessageToParentWebsite({ authExpired: true });
    return;
  }

  window.location.href = tokenRefreshUrl();
}
