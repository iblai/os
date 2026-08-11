'use client';

import { useEffect } from 'react';
import { useUsername } from '@/hooks/use-user';
import { isTauriApp } from '@/types/tauri';

/**
 * Keep the Rust model proxy told who is signed in. The proxy appends
 * `learner_id=<username>` to every OpenAI-compat request it forwards, so upstream
 * attributes Code usage to the learner.
 *
 * Lives at the app root (called from Providers) rather than in any chat surface:
 * the learner must be set before the first Code turn no matter which page sends
 * it, and `useUsername` is reactive, so login/logout re-sends automatically. An
 * empty username is sent too — it clears a stale learner after logout.
 */
export function useOpencodeLearner() {
  const username = useUsername();

  useEffect(() => {
    if (!isTauriApp()) return;
    void (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_opencode_learner', { username: username ?? '' });
      } catch (e) {
        console.error('[opencode] failed to set learner', e);
      }
    })();
  }, [username]);
}
