/**
 * Whether Cowork checks with the user before it acts.
 *
 * Mirrors Code mode's `permission_mode` (`components/chat-input-form/
 * coding-mode-button.tsx`), with one deliberate difference: Code has no default
 * because either answer picks a security posture for the user, while Cowork
 * defaults to `auto`. The confirm gate it silences is structural rather than
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

/**
 * The SDK's own Cowork on/off key. Read here — never written here — because
 * `isCoworkEnabled()` collapses "off" and "never chosen" into `false`, and the
 * extension panel needs to tell them apart: it defaults Cowork ON, but only
 * until the user says otherwise. `setCoworkEnabled` writes `String(enabled)`,
 * so an explicit off leaves `"false"` behind and this returns true for it.
 */
const ENABLED_KEY = 'ibl_cowork_enabled';

/** Whether the user has ever set Cowork on or off on this origin. */
export function coworkPrefSet(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== null;
  } catch {
    // Unreadable storage cannot hold a choice either, so treat it as unset and
    // let the caller apply its default.
    return false;
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
 */
const SETUP_PENDING_KEY = 'ibl_cowork_setup_pending';

export function coworkSetupPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SETUP_PENDING_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeCoworkSetupPending(pending: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (pending) window.localStorage.setItem(SETUP_PENDING_KEY, 'true');
    else window.localStorage.removeItem(SETUP_PENDING_KEY);
  } catch {
    // Without storage the setup simply does not survive a relaunch.
  }
}
