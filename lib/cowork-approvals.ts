/**
 * Whether Cowork checks with the user before it acts.
 *
 * Mirrors Code mode's `permission_mode` (`components/chat-input-form/
 * coding-mode-button.tsx`); both default to `auto`. The confirm gate it silences is structural rather than
 * risk-based — `needsConfirm` in the extension asks about ANY form submission,
 * so a plain search box prompted — and being asked on every search made the
 * feature unusable.
 *
 * Lives here rather than in the extension's `chrome.storage` settings because
 * the UI that sets it runs in the iframed app, which has no `chrome.*` at all.
 * It reaches the service worker on the run frame.
 */
const KEY = 'ibl_cowork_approvals';

export type CoworkApprovals = 'manual' | 'auto';

export function readCoworkApprovals(): CoworkApprovals {
  if (typeof window === 'undefined') return 'auto';
  try {
    // Anything but the one opt-in value reads as the default, so a corrupted or
    // half-written entry cannot leave the user in a mode they never chose.
    return window.localStorage.getItem(KEY) === 'manual' ? 'manual' : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeCoworkApprovals(mode: CoworkApprovals): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // A blocked storage (private mode, quota) must not take the composer down;
    // the mode simply does not persist past this page.
  }
}

/**
 * Set while the macOS grants Cowork needs are still being collected. Persisted
 * rather than kept in state because a Screen Recording grant only takes effect
 * after the app relaunches, and the setup has to pick itself back up on the
 * other side of that. Cleared the moment Cowork turns on or the user cancels.
 *
 * Stamped with when the user last acted on it, and read as pending only within
 * COWORK_SETUP_RESUME_WINDOW_MS of that. The relaunch takes seconds; a setup
 * abandoned mid-way must not reopen a dialog on every later launch, nor switch
 * Cowork on by itself days later once the grants happen to be held. Same keys
 * and window as the SDK's Cowork pill, which shares the window with this row.
 */
const SETUP_PENDING_KEY = 'ibl_cowork_setup_pending';
const SETUP_PENDING_AT_KEY = 'ibl_cowork_setup_pending_at';
export const COWORK_SETUP_RESUME_WINDOW_MS = 10 * 60 * 1000;

export function coworkSetupPending(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(SETUP_PENDING_KEY) !== 'true') return false;
    const at = Number(window.localStorage.getItem(SETUP_PENDING_AT_KEY));
    return at > 0 && now - at <= COWORK_SETUP_RESUME_WINDOW_MS;
  } catch {
    return false;
  }
}

export function writeCoworkSetupPending(
  pending: boolean,
  now = Date.now(),
): void {
  if (typeof window === 'undefined') return;
  try {
    if (pending) {
      window.localStorage.setItem(SETUP_PENDING_KEY, 'true');
      window.localStorage.setItem(SETUP_PENDING_AT_KEY, String(now));
    } else {
      window.localStorage.removeItem(SETUP_PENDING_KEY);
      window.localStorage.removeItem(SETUP_PENDING_AT_KEY);
    }
  } catch {
    // Without storage the setup simply does not survive a relaunch.
  }
}

/**
 * Set once the user has pressed Turn On in the Cowork explanation, so switching
 * Cowork on later goes straight to whatever macOS still needs.
 */
const CONSENT_KEY = 'ibl_cowork_consent';

export function coworkConsentGiven(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeCoworkConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, 'true');
  } catch {
    // Without storage the explanation simply shows again next time.
  }
}

export type CoworkGrantKind = 'accessibility' | 'screen_recording';

/**
 * macOS shows its own alert only the first time an app asks for a grant. After
 * that the only way through is System Settings, so the setup remembers which
 * grants it has already asked for.
 */
const PERMISSION_ASKED_KEY = 'ibl_cowork_permission_asked_';

export function coworkPermissionAsked(kind: CoworkGrantKind): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PERMISSION_ASKED_KEY + kind) === 'true';
  } catch {
    return false;
  }
}

export function markCoworkPermissionAsked(kind: CoworkGrantKind): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERMISSION_ASKED_KEY + kind, 'true');
  } catch {
    // Without storage every ask counts as the first one.
  }
}
