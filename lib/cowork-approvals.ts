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

export function writeCoworkApprovals(mode: CoworkApprovals): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // A blocked storage (private mode, quota) must not take the composer down;
    // the mode simply does not persist past this page.
  }
}
