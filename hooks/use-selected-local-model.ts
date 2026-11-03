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
      // The SDK's rule: a missing or "latest" tag is a wildcard, but two
      // explicit tags must agree. Dropping the tag outright matched a stored
      // "gpt-oss:120b" to the catalog's "gpt-oss:20b", so the badge named the
      // wrong model and the self-heal below wrote that entry's tool support.
      const parse = (ref: string) => {
        const [base, tag] = ref.toLowerCase().split(':');
        return { base, tag: !tag || tag === 'latest' ? null : tag };
      };
      const want = id ? parse(id) : null;
      const model = want
        ? (LOCAL_MODELS.find((m) => {
            const have = parse(m.id);
            return (
              have.base === want.base &&
              (want.tag === null || have.tag === null || have.tag === want.tag)
            );
          }) ?? null)
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
