'use client';

import { useEffect } from 'react';
import { useUsername } from '@/hooks/use-user';
import { getUserEmail } from '@/features/utils';
import { config, getEnv } from '@/lib/config';
import { isTauriApp } from '@/types/tauri';

/**
 * Keep the Rust model proxy told who is signed in. The proxy appends
 * `learner_id=<username>` to every OpenAI-compat request it forwards, so upstream
 * attributes Code usage to the learner, and surfaces the email to the agent so
 * skills never have to ask for it.
 *
 * The DM base travels the same way because the backend cannot derive it: the
 * only host it otherwise sees is the streaming-completions one, which doesn't
 * serve `/api/core` (where the agent's platform API key is minted).
 *
 * The platform base domain rides along too — the ONE value code mode derives
 * its hosts from (`asgi.data.<domain>` upstream, `DOMAIN` in the agent's
 * `iblai.env`) — plus the auth SPA URL, the sole host not derivable from the
 * domain (`login.iblai.app` in production vs `auth.iblai.org` on the dev
 * platform). Sent raw: an empty auth URL means "unset, defaults rule".
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
        await invoke('set_opencode_learner', {
          username: username ?? '',
          email: username ? (getUserEmail() ?? '') : '',
          dmBase: config.dmUrl(),
          platformDomain: config.platformBaseDomain(),
          authUrl: getEnv('NEXT_PUBLIC_AUTH_URL'),
        });
      } catch (e) {
        console.error('[opencode] failed to set learner', e);
      }
    })();
  }, [username]);
}
