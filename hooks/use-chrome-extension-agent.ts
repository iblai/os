'use client';

import { useCallback } from 'react';
import {
  useLazyGetTenantMetadataQuery,
  useUpdateTenantMetadataMutation,
  useCreateMentorMutation,
} from '@iblai/iblai-js/data-layer';

import { useLazyGetMentorsQuery } from '@/features/mentors/api-slice';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import { useTenantObjectMetadata } from '@/hooks/use-tenant-object-metadata';
import {
  AGENT_PURPOSES,
  BROWSING_ASSISTANT_NAME,
  readPurposeAgent,
  withPurposeAgent,
  type TenantMetadataBlob,
} from '@/lib/purpose-agents';

const DEFAULT_AGENT_TEMPLATE = 'ai-mentor';

type PlatformMetadataEnvelope = {
  platform_key: string;
  platform_name: string;
  metadata?: unknown;
};

const PURPOSE = AGENT_PURPOSES.CHROME_EXTENSION;

/**
 * Resolves the agent the side panel opens on, creating and recording one when
 * the organization has none and this person may.
 *
 * Null means there is nothing bound and nobody here who may bind it, so the
 * caller should choose an agent the normal way.
 */
export function useChromeExtensionAgent(): (
  tenantKey: string,
) => Promise<string | null> {
  const isAdmin = useIsAdmin();
  const username = useUsername();
  const knownMetadata = useTenantObjectMetadata();
  const [getTenantMetadata] = useLazyGetTenantMetadataQuery();
  const [updateTenantMetadata] = useUpdateTenantMetadataMutation();
  const [createMentor] = useCreateMentorMutation();
  const [getMentors] = useLazyGetMentorsQuery();

  return useCallback(
    async (tenantKey: string): Promise<string | null> => {
      // The tenants list already carries metadata, so the settled case costs
      // no request and the panel opens in the same tick.
      const alreadyKnown = readPurposeAgent(knownMetadata, PURPOSE);
      if (alreadyKnown) return alreadyKnown;

      // That list holds only this person's organizations and can lag a write
      // made elsewhere; this read is also the one we merge into.
      let current: PlatformMetadataEnvelope;
      try {
        current = await getTenantMetadata([{ org: tenantKey }]).unwrap();
      } catch {
        return null;
      }
      const stored = (current?.metadata ?? null) as TenantMetadataBlob | null;

      const configured = readPurposeAgent(stored, PURPOSE);
      if (configured) return configured;

      if (!isAdmin || !username) return null;

      const mentorId =
        (await findBrowsingAssistant(tenantKey)) ?? (await create(tenantKey));
      if (!mentorId) return null;

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
      return mentorId;

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
          return (
            found?.results?.find(
              (mentor) => mentor?.name === BROWSING_ASSISTANT_NAME,
            )?.unique_id ?? null
          );
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
              template_name: DEFAULT_AGENT_TEMPLATE,
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
      knownMetadata,
      isAdmin,
      username,
      getTenantMetadata,
      updateTenantMetadata,
      createMentor,
      getMentors,
    ],
  );
}
