'use client';

import { useEffect, useState } from 'react';
import {
  isLocalLLMEnabled,
  getLocalLLMModel,
  getLocalLLMToolSupport,
  setLocalLLMToolSupport,
  LOCAL_MODELS,
  type LocalModel,
} from '@iblai/iblai-js/web-containers';

import { LOCAL_LLM_CHANGED_EVENT } from '@/lib/local-llm-flags';

export { LOCAL_LLM_CHANGED_EVENT };

export interface SelectedLocalModel {
  /** On-device mode is enabled and a model id is selected. */
  isLocal: boolean;
  /** The selected catalog model, or null if the id isn't a known catalog entry. */
  model: LocalModel | null;
  /** The raw selected model id (may be set even when not in the catalog). */
  modelId: string | null;
}

/**
 * Reactive view of the on-device model selection (`ibl_local_llm_enabled` +
 * `ibl_local_llm_model` in localStorage). Reads on mount — so it is
 * SSR/hydration-safe (nothing resolves until the client mounts) — and re-reads
 * on cross-tab `storage` events and same-tab {@link LOCAL_LLM_CHANGED_EVENT}
 * events. Used by the nav-bar to show the active on-device model top-left.
 */
export function useSelectedLocalModel(): SelectedLocalModel {
  const [sel, setSel] = useState<SelectedLocalModel>({
    isLocal: false,
    model: null,
    modelId: null,
  });

  useEffect(() => {
    const read = () => {
      const enabled = isLocalLLMEnabled();
      const id = getLocalLLMModel();
      // Ignore the ":tag" and case, like the SDK picker does, so a stored
      // "qwen3:latest" still resolves to the "Qwen 3" catalog entry.
      const base = (ref: string) => ref.toLowerCase().split(':')[0];
      const model = id
        ? (LOCAL_MODELS.find((m) => base(m.id) === base(id)) ?? null)
        : null;
      // Self-heal the derived tool-support cache. Local chat routes on
      // `ibl_local_llm_tool_support` (SDK ollama-client), but an older selection
      // may have left it stale/false — which makes streaming reject a genuinely
      // tool-capable model. The catalog is the source of truth; reconcile here
      // (the nav-bar mounts this hook on every load). Write only on a real
      // mismatch so it can't loop.
      if (enabled && model && getLocalLLMToolSupport() !== model.tool_support) {
        setLocalLLMToolSupport(model.tool_support);
      }
      setSel({ isLocal: enabled && !!id, model, modelId: id });
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener(LOCAL_LLM_CHANGED_EVENT, read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener(LOCAL_LLM_CHANGED_EVENT, read);
    };
  }, []);

  return sel;
}
