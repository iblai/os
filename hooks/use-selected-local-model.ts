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

/**
 * Window event other OS components dispatch after changing the device-global
 * on-device selection — a model pick in the LLM tab or the Local Models master
 * toggle in Profile → Advanced. `storage` events only fire cross-tab, so this
 * covers the same-tab case so the nav-bar badge updates immediately.
 */
export const LOCAL_LLM_CHANGED_EVENT = 'ibl:local-llm-changed';

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
      const model = id ? (LOCAL_MODELS.find((m) => m.id === id) ?? null) : null;
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
