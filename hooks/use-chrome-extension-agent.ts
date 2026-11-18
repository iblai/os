'use client';

import { useCallback, useMemo, useRef } from 'react';
import {
  useLazyGetTenantMetadataQuery,
  useUpdateTenantMetadataMutation,
  useCreateMentorMutation,
} from '@iblai/iblai-js/data-layer';

import { useLazyGetMentorsQuery } from '@/features/mentors/api-slice';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import { useTenantObjectMetadata } from '@/hooks/use-tenant-object-metadata';
import { config } from '@/lib/config';
import { MENTOR_VISIBILITY_VALUES } from '@/lib/constants';
import {
  AGENT_PURPOSES,
  BROWSING_ASSISTANT_MODEL,
  BROWSING_ASSISTANT_NAME,
  readPurposeAgent,
  withPurposeAgent,
  type TenantMetadataBlob,
} from '@/lib/purpose-agents';

const PURPOSE = AGENT_PURPOSES.CHROME_EXTENSION;

type PlatformMetadataEnvelope = {
  platform_key: string;
  platform_name: string;
  metadata?: unknown;
};

/**
 * `needs-setup` is the only one a person can act on: nothing is bound and
 * nobody here may bind it. `unavailable` is a failure we could not see past —
 * a transient one must not become a dead end, so callers fall back instead.
 */
export type PanelAgentResolution =
  | { status: 'ready'; mentorId: string }
  | { status: 'needs-setup' }
  | { status: 'unavailable' };

export interface PanelAgent {
  /**
   * The bound agent, from metadata the app already holds — no request. A
   * function, not a value, so an agent forgotten since the last render is
   * never handed back.
   */
  peek: () => string | null;
  resolve: (tenantKey: string) => Promise<PanelAgentResolution>;
  /** An agent that turned out to be gone, so it is never resolved again. */
  forget: (mentorId: string) => void;
}

/**
 * The agent the side panel opens on, created and recorded when the
 * organization has none and this person may.
 *
 * Null means nothing is bound and nobody here may bind it, so the caller
 * should choose an agent the normal way.
 */
export function useChromeExtensionAgent(): PanelAgent {
  const isAdmin = useIsAdmin();
  const username = useUsername();
  const knownMetadata = useTenantObjectMetadata();
  const [getTenantMetadata] = useLazyGetTenantMetadataQuery();
  const [updateTenantMetadata] = useUpdateTenantMetadataMutation();
  const [createMentor] = useCreateMentorMutation();
  const [getMentors] = useLazyGetMentorsQuery();

  const gone = useRef<Set<string>>(new Set());
  // One resolution per organization: MentorProvider can redirect again while
  // the first is still awaiting, and two of these would each create an agent —
  // neither search can see the other's not-yet-indexed one.
  const running = useRef<Map<string, Promise<PanelAgentResolution>>>(new Map());

  const live = useCallback(
    (id: string | null) => (id && !gone.current.has(id) ? id : null),
    [],
  );

  const peek = useCallback(
    () => live(readPurposeAgent(knownMetadata, PURPOSE)),
    [knownMetadata, live],
  );

  const resolve = useCallback(
    (tenantKey: string): Promise<PanelAgentResolution> => {
      const started = running.current.get(tenantKey);
      if (started) return started;

      const attempt = (async (): Promise<PanelAgentResolution> => {
        const alreadyKnown = peek();
        if (alreadyKnown) return { status: 'ready', mentorId: alreadyKnown };

        // The list the app holds covers only this person's organizations and
        // can lag a write made elsewhere; this read is also what we merge into.
        let current: PlatformMetadataEnvelope;
        try {
          current = await getTenantMetadata([{ org: tenantKey }]).unwrap();
        } catch {
          return { status: 'unavailable' };
        }
        const stored = (current?.metadata ?? null) as TenantMetadataBlob | null;

        const configured = live(readPurposeAgent(stored, PURPOSE));
        if (configured) return { status: 'ready', mentorId: configured };

        if (!isAdmin || !username) return { status: 'needs-setup' };

        const mentorId =
          (await findBrowsingAssistant(tenantKey)) ?? (await create(tenantKey));
        if (!mentorId) return { status: 'unavailable' };

        try {
          await updateTenantMetadata([
            {
              org: tenantKey,
              requestBody: {
                ...current,
                metadata: withPurposeAgent(stored, PURPOSE, mentorId),
              },
            },
          ]).unwrap();
        } catch {
          console.warn(
            '[purpose-agents] could not record the browsing agent on the organization; it will be adopted by name next time',
          );
        }
        return { status: 'ready', mentorId };
      })();

      running.current.set(tenantKey, attempt);
      return attempt.finally(() => running.current.delete(tenantKey));

      // Creating and recording are two calls, so a failed write leaves an
      // agent nobody points at. Adopting it stops that breeding a new agent on
      // every load.
      async function findBrowsingAssistant(org: string) {
        try {
          const found = await getMentors({
            tenantKey: org,
            username: username as string,
            params: { query: BROWSING_ASSISTANT_NAME, limit: 20 },
          }).unwrap();
          const match = found?.results?.find(
            (mentor) =>
              mentor?.name === BROWSING_ASSISTANT_NAME &&
              !gone.current.has(mentor?.unique_id),
          );
          return match?.unique_id ?? null;
        } catch {
          return null;
        }
      }

      async function create(org: string) {
        try {
          const created = await createMentor({
            org,
            userId: username as string,
            formData: {
              new_mentor_name: BROWSING_ASSISTANT_NAME,
              display_name: BROWSING_ASSISTANT_NAME,
              template_name: config.iblTemplateMentor(),
              llm_provider: BROWSING_ASSISTANT_MODEL.provider,
              llm_name: BROWSING_ASSISTANT_MODEL.name,
              // Everyone in the organization opens this one, so admins-only
              // (the create default) would 404 for most of them.
              mentor_visibility: MENTOR_VISIBILITY_VALUES.STUDENTS,
            },
          } as never).unwrap();
          return (created as { unique_id?: string })?.unique_id ?? null;
        } catch (error) {
          console.error(
            '[purpose-agents] could not create the browsing agent',
            error,
          );
          return null;
        }
      }
    },
    [
      peek,
      isAdmin,
      username,
      getTenantMetadata,
      updateTenantMetadata,
      createMentor,
      getMentors,
    ],
  );

  const forget = useCallback((mentorId: string) => {
    gone.current.add(mentorId);
  }, []);

  return useMemo(() => ({ peek, resolve, forget }), [peek, resolve, forget]);
}
