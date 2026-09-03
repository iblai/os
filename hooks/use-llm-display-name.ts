'use client';

import { useMemo } from 'react';

import { useGetLlmsQuery } from '@iblai/iblai-js/data-layer';

import { getLLMModelDisplayName } from '@/lib/utils';

/**
 * The slice of a mentor's `llm_config` we care about.
 *
 * Mentor settings embed the chosen model's catalogue entry under `llm_config`,
 * which already carries the label the model picker shows. The rest of the
 * entry (context window, modality support, …) is irrelevant here.
 */
type LlmConfigLike = { display_name?: string | null } | null;

/** One provider row from the mentor-llms catalogue. */
type LlmCatalogueProvider = {
  chat_models?: { llm_name?: string | null; display_name?: string | null }[];
};

type UseLlmDisplayNameArgs = {
  /** The wire key mentor settings persist, e.g. `iblai-pro`. */
  llmName?: string | null;
  /** `llm_config` from mentor settings, when the backend supplied one. */
  llmConfig?: LlmConfigLike;
  org?: string | null;
  userId?: string | null;
  mentorId?: string | null;
};

const clean = (value?: string | null) => value?.trim() || undefined;

/**
 * The label to show for a mentor's selected model.
 *
 * Settings persist only `llm_name` — a wire key like `iblai-pro` or
 * `claude-haiku-4-5-20251001` — while the model picker reads the catalogue,
 * which carries a `display_name` ("ibl.ai Pro", "Claude Haiku 4.5"). Rendering
 * the key leaves the nav bar disagreeing with the picker for every provider,
 * so resolve the label in three steps:
 *
 * 1. `llm_config.display_name` from settings. The backend already embeds the
 *    chosen model's catalogue entry here, so this needs no extra request and
 *    covers the common case.
 * 2. The mentor-llms catalogue, matched on `llm_name`. Only queried when step 1
 *    came back empty (older mentors, or public settings that omit the config),
 *    so the usual page load makes no additional call.
 * 3. `getLLMModelDisplayName`, which tidies the handful of keys whose raw form
 *    is unpresentable. Used when the catalogue is still loading or failed, so a
 *    request error degrades to today's rendering rather than an empty badge.
 *
 * Note that settings' *top-level* `display_name` is the agent's name, not the
 * model's — only the one nested in `llm_config` is the label wanted here.
 */
export function useLlmDisplayName({
  llmName,
  llmConfig,
  org,
  userId,
  mentorId,
}: UseLlmDisplayNameArgs): string {
  const fromConfig = clean(llmConfig?.display_name);

  // Skip the catalogue entirely when settings already answered, and whenever an
  // identifier is missing — an under-specified query would 404 rather than
  // usefully fail over.
  const skip = Boolean(fromConfig) || !llmName || !org || !userId || !mentorId;

  const { data: providers } = useGetLlmsQuery(
    {
      org: org ?? '',
      // @ts-ignore - userId is typed as required upstream but skip guards it
      userId: userId ?? '',
      mentorId: mentorId ?? '',
    },
    { skip },
  );

  const fromCatalogue = useMemo(() => {
    if (skip || !llmName || !Array.isArray(providers)) return undefined;
    for (const provider of providers as LlmCatalogueProvider[]) {
      const match = provider?.chat_models?.find(
        (model) => model?.llm_name === llmName,
      );
      const label = clean(match?.display_name);
      if (label) return label;
    }
    return undefined;
  }, [skip, providers, llmName]);

  return fromConfig ?? fromCatalogue ?? getLLMModelDisplayName(llmName);
}
