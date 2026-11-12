import { useEffect } from 'react';
import { isTauriPhone } from '@/types/tauri';

/** The pairing flag the SDK routes a phone's Code turns on (`isTauriCodeHost`). */
const REMOTE_CODE_READY_KEY = 'ibl_remote_code_ready';

/**
 * Whether the Code pill may render here. Code lives only inside the Tauri app,
 * and the phone apps hide it for now: the way a phone connects to a desktop's
 * Code is not ready to ship. A phone that paired earlier must not keep sending
 * its turns there with no pill to switch it off, so the pairing flag the SDK
 * routes on is cleared along with the pill. Decided synchronously, because a
 * mounted pill re-probes the pairing and would write the flag back.
 */
export function useCodeShownHere(inTauri: boolean): boolean {
  const phone = inTauri && isTauriPhone();
  useEffect(() => {
    if (!phone) return;
    try {
      localStorage.setItem(REMOTE_CODE_READY_KEY, 'false');
      window.dispatchEvent(new Event('local-storage'));
    } catch {
      // Without storage there is no stale pairing to clear.
    }
  }, [phone]);
  return inTauri && !phone;
}
