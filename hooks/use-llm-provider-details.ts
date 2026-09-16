'use client';

import { useCallback, useMemo } from 'react';

import { useGetLlmsQuery } from '@iblai/iblai-js/data-layer';

/** One provider row from the mentor-llms catalogue, as far as naming goes. */
type LlmCatalogueProvider = {
  name?: string | null;
  display_name?: string | null;
  logo?: string | null;
};

export type LlmProviderDetails = {
  /** The backend logo URL; `null` when the API ships none for this provider. */
  logo: string | null;
  /** The backend `display_name`, or the raw provider key when it has none. */
  displayName: string;
};

type UseLlmProviderCatalogueArgs = {
  org?: string | null;
  userId?: string | null;
  mentorId?: string | null;
};

/**
 * A resolver from a provider key (the `llm_provider` mentor settings persist,
 * e.g. `openai`) to the name and logo the backend publishes for it.
 *
 * Provider naming is backend-owned: the mentor-llms catalogue carries each
 * provider's `logo` (and `display_name` where the API supplies one), so this
 * reads the same RTK Query cache entry the LLM tab and model picker fill —
 * matched on `name`. A key the catalogue does not list (the catalogue is
 * still loading, or an on-device provider that has no backend row) resolves
 * to the raw key and no logo, so callers degrade to plain text.
 *
 * Returns a function rather than a value so list renderers (a mentors table,
 * a facet dropdown) can resolve many keys from one subscription.
 */
export function useLlmProviderCatalogue({
  org,
  userId,
  mentorId,
}: UseLlmProviderCatalogueArgs) {
  const skip = !org || !userId || !mentorId;

  const { data: providers } = useGetLlmsQuery(
    {
      org: org ?? '',
      // @ts-ignore - userId is typed as required upstream but skip guards it
      userId: userId ?? '',
      mentorId: mentorId ?? '',
    },
    { skip },
  );

  // Indexed once per catalogue load so list renderers resolve each key in
  // O(1). First row wins on a duplicate name, as `Array.find` would.
  const rowsByName = useMemo(() => {
    const byName = new Map<string, LlmCatalogueProvider>();
    if (!Array.isArray(providers)) return byName;
    for (const row of providers as LlmCatalogueProvider[]) {
      if (row?.name && !byName.has(row.name)) byName.set(row.name, row);
    }
    return byName;
  }, [providers]);

  return useCallback(
    (llmProvider?: string | null): LlmProviderDetails => {
      const key = llmProvider ?? '';
      const row = rowsByName.get(key);
      return {
        logo: row?.logo || null,
        displayName: row?.display_name?.trim() || key,
      };
    },
    [rowsByName],
  );
}
