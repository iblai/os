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
  readPurposeUnsupported,
  withPurposeAgent,
  withPurposeUnsupported,
  type TenantMetadataBlob,
} from '@/lib/purpose-agents';

const PURPOSE = AGENT_PURPOSES.CHROME_EXTENSION;

/** Enough rows to find an agent created earlier whose id was never recorded. */
const SEARCH_LIMIT = 100;

/**
 * A create refused because the organization has no credential for the model
 * we pin. Matched on the field rather than the sentence, which is prose the
 * platform is free to reword.
 */
function missingCredential(error: unknown): boolean {
  const data = (error as { status?: number; data?: unknown })?.data;
  const field = (data as { llm_provider?: unknown })?.llm_provider;
  return (error as { status?: number })?.status === 400 && Array.isArray(field);
}

type PlatformMetadataEnvelope = {
  platform_key: string;
  platform_name: string;
  metadata?: unknown;
};

/**
 * Three dead ends, and they are not the same: `needs-setup` is an organization
 * nobody has bound an agent to, which whoever manages it can fix; `unsupported`
 * is one that cannot run the agent at all, which only we can; `refused` is the
 * platform saying no for a reason an administrator here could act on.
 * `unavailable` is a failure we could not see past — a transient one must not
 * become a dead end, so callers fall back instead.
 */
export type PanelAgentResolution =
  | { status: 'ready'; mentorId: string }
  | { status: 'needs-setup' }
  | { status: 'unsupported' }
  | { status: 'refused'; reason?: string }
  | { status: 'unavailable' };

/**
 * A refusal is the platform saying no on purpose — the organization may not
 * create agents, the template is not one skills can attach to, a limit is
 * reached. Falling back would hide a misconfiguration an admin could fix, and
 * they would never learn why the panel keeps opening something else.
 *
 * Anything else — a 500, a dropped connection — is a hiccup that may pass on
 * its own, so the run falls back and tries again next time.
 */
type CreateOutcome =
  | { kind: 'made'; mentorId: string }
  | { kind: 'unsupported' }
  | { kind: 'refused'; reason?: string }
  | { kind: 'failed' };

function refusal(error: unknown): { refused: boolean; reason?: string } {
  const status = (error as { status?: unknown } | null)?.status;
  const code = typeof status === 'number' ? status : undefined;
  if (code === undefined || code < 400 || code >= 500)
    return { refused: false };
  const data = (error as { data?: { detail?: string; error?: string } } | null)
    ?.data;
  return { refused: true, reason: data?.detail || data?.error };
}

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
        } catch (error) {
          // Silent here meant the panel fell back to the organization's
          // default agent with nothing said, which is indistinguishable from
          // the feature not running at all.
          console.warn(
            '[purpose-agents] could not read the organization metadata',
            error,
          );
          return { status: 'unavailable' };
        }
        const stored = (current?.metadata ?? null) as TenantMetadataBlob | null;

        const configured = live(readPurposeAgent(stored, PURPOSE));
        if (configured) return { status: 'ready', mentorId: configured };

        if (!isAdmin || !username) {
          // An administrator has already been told this cannot run here, so
          // their colleagues get that answer rather than being sent to ask
          // someone who cannot help either.
          return readPurposeUnsupported(stored, PURPOSE)
            ? { status: 'unsupported' }
            : { status: 'needs-setup' };
        }

        // An administrator is deliberately NOT stopped by that verdict: their
        // open is the only thing that re-tests it, so once we enable the model
        // the next admin open clears the record and their colleagues get the
        // agent. The cost is one failing create per admin open until then.
        let mentorId = await findBrowsingAssistant(tenantKey);
        if (!mentorId) {
          const made = await create(tenantKey);
          if (made.kind === 'unsupported') {
            await record(current, withPurposeUnsupported(stored, PURPOSE));
            return { status: 'unsupported' };
          }
          // Not recorded, unlike the one above: a refusal is a configuration
          // an administrator here can put right, so the next open must ask
          // the platform again rather than read yesterday's no.
          if (made.kind === 'refused')
            return { status: 'refused', reason: made.reason };
          if (made.kind === 'failed') return { status: 'unavailable' };
          mentorId = made.mentorId;
        }

        await record(current, withPurposeAgent(stored, PURPOSE, mentorId));
        return { status: 'ready', mentorId };
      })();

      running.current.set(tenantKey, attempt);
      return attempt.finally(() => running.current.delete(tenantKey));

      // Best-effort: a failed write costs the next person one more attempt,
      // never the agent itself. An unrecorded agent is adopted by name below.
      async function record(
        envelope: PlatformMetadataEnvelope,
        metadata: TenantMetadataBlob,
      ) {
        try {
          await updateTenantMetadata([
            { org: tenantKey, requestBody: { ...envelope, metadata } },
          ]).unwrap();
        } catch {
          console.warn(
            '[purpose-agents] could not record the outcome on the organization; it will be worked out again next time',
          );
        }
      }

      // Creating and recording are two calls, so a failed write leaves an
      // agent nobody points at. Adopting it stops that breeding a new agent on
      // every load.
      async function findBrowsingAssistant(org: string) {
        try {
          // No `query`: this search endpoint answers 500 to it (the slice's
          // only other caller sends `order_by` / `featured` / `limit`, never
          // one), and the exact-name match below is what actually decides.
          // The bound this leaves: an organization with more than
          // SEARCH_LIMIT agents whose recording also failed can create one
          // duplicate, since the name may sit outside the page we read.
          const found = await getMentors({
            tenantKey: org,
            username: username as string,
            params: { limit: SEARCH_LIMIT },
          }).unwrap();
          const match = found?.results?.find(
            (mentor) =>
              mentor?.name === BROWSING_ASSISTANT_NAME &&
              !gone.current.has(mentor?.unique_id),
          );
          return match?.unique_id ?? null;
        } catch (error) {
          console.warn(
            '[purpose-agents] could not search for an existing browsing agent',
            error,
          );
          return null;
        }
      }

      /**
       * `unsupported` is an organization the pinned model has no credential
       * for: nothing anyone can do from the panel, so it is reported rather
       * than worked around.
       */
      async function create(org: string): Promise<CreateOutcome> {
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
          const id = (created as { unique_id?: string })?.unique_id;
          return id ? { kind: 'made', mentorId: id } : { kind: 'failed' };
        } catch (error) {
          // Checked before the general refusal: the missing credential is one
          // particular 400, and it has a screen of its own that says who can
          // put it right. Left to `refusal` it would read as something an
          // administrator here could fix.
          if (missingCredential(error)) {
            console.warn(
              `[purpose-agents] ${org} has no ${BROWSING_ASSISTANT_MODEL.provider} credential, so the browsing agent cannot be created there`,
            );
            return { kind: 'unsupported' };
          }
          const said = refusal(error);
          console.error(
            '[purpose-agents] could not create the browsing agent',
            error,
          );
          return said.refused
            ? { kind: 'refused', reason: said.reason }
            : { kind: 'failed' };
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
