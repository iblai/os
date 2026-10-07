'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { isTauriApp } from '@/types/tauri';

/**
 * How long after a signed-out Code turn the generic chat error toast stays
 * suppressed. The turn's own failure (`ollama:error`) lands moments after the
 * `opencode:auth_required` event the Rust side emits first.
 */
// ponytail: one flat window like the 402 path; split dedupe and suppression if
// a slow turn ever outlives it.
const RECENT_AUTH_WINDOW_MS = 10_000;

let lastAuthAt = 0;

/**
 * True when a signed-out Code turn was handled moments ago. The chat's
 * generic errorHandler consults this to skip its support toast for the same
 * failure, exactly as it does after a 402.
 */
export function wasRecentAuthRequired(): boolean {
  return Date.now() - lastAuthAt < RECENT_AUTH_WINDOW_MS;
}

/**
 * Desktop only: a Code turn on a signed-out Codex / Claude Code raises ONE
 * quiet toast naming where to sign in — Codex in the ChatGPT app, Claude Code
 * in a terminal (the app has no sign-in of its own). A fixed id folds repeats
 * into the same toast.
 */
export function useOpencodeAuthRequired() {
  const t = useTranslations('chatInputFormCodingModeButton');

  useEffect(() => {
    if (!isTauriApp()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const onAuthRequired = (backend?: string) => {
      lastAuthAt = Date.now();
      const codex = backend === 'codex';
      toast.info(t(codex ? 'authRequiredCodex' : 'authRequiredClaude'), {
        id: 'code-agent-auth',
        duration: 10_000,
        description: t.rich(
          codex ? 'agentSignedOutCodex' : 'agentSignedOutClaude',
          { code: (chunks) => <code className="font-mono">{chunks}</code> },
        ),
      });
    };

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const un = await listen<{ generation_id?: string; backend?: string }>(
          'opencode:auth_required',
          (evt) => onAuthRequired(evt.payload?.backend),
        );
        if (cancelled) un();
        else unlisten = un;
      } catch (e) {
        console.error('[opencode] auth-required listener failed', e);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [t]);
}
