import type { Metadata } from 'next';

import { config } from '@/lib/config';
import { buildMetadata, SITE_NAME } from '@/lib/seo';
import { fetchMentorPublicMeta } from '@/lib/seo-mentor';

/**
 * SEO metadata for shared chat pages.
 *
 * Shared conversations are semi-private and ephemeral, so they are **noindex**
 * — but they're frequently shared on social, so we still emit a rich Open Graph
 * card (mentor name + avatar). The mentor name/image come from the same public
 * settings fetch used by the mentor page; when unavailable we fall back to a
 * generic card.
 *
 * Two routes lead here:
 * - `/share/chat/[sessionId]/[tenantKey]/[mentorId]` — mentor is in the URL.
 * - `/share/chat/[sessionId]` — a redirect entry; the mentor is resolved from
 *   the shared session (its public endpoint returns `platform_key` +
 *   `mentor_unique_id`), so this short link (the one people usually paste) gets
 *   the same rich card.
 */

/** Shared, noindex OG card for a conversation given its mentor org/id. */
async function sharedChatCard(
  path: string,
  org: string | null,
  mentor: string | null,
): Promise<Metadata> {
  const meta = org && mentor ? await fetchMentorPublicMeta(org, mentor) : null;
  const mentorName = meta?.name ?? null;

  const title = mentorName
    ? `Shared conversation with ${mentorName}`
    : 'Shared conversation';
  const description = mentorName
    ? `A shared conversation with ${mentorName} on ${SITE_NAME}.`
    : `A shared conversation on ${SITE_NAME}.`;

  return buildMetadata({
    path,
    // Semi-private: great social cards, but keep out of the search index.
    index: false,
    title,
    description,
    images: meta?.image ? [meta.image] : undefined,
    type: 'article',
  });
}

/**
 * Resolve a shared session's mentor (org + unique id) from its `sessionId`.
 * Uses the public shared-session endpoint (no auth, org-less) and returns
 * `null` on any failure.
 */
export async function fetchSharedChatMentor(
  sessionId: string,
): Promise<{ org: string; mentor: string } | null> {
  if (!sessionId) return null;

  // Public shared-session endpoint — org/user are intentionally empty here,
  // exactly as the client hook calls it; the session is keyed by sessionId.
  const url =
    `${config.dmUrl()}/api/ai-mentor/orgs//users/undefined` +
    `/sessions/${encodeURIComponent(sessionId)}/shared/`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const org = typeof data?.platform_key === 'string' ? data.platform_key : '';
    const mentor =
      typeof data?.mentor_unique_id === 'string' ? data.mentor_unique_id : '';
    if (!org || !mentor) return null;
    return { org, mentor };
  } catch {
    return null;
  }
}

/** Metadata for `/share/chat/[sessionId]/[tenantKey]/[mentorId]`. */
export async function buildSharedChatMetadata(
  sessionId: string,
  org: string,
  mentor: string,
): Promise<Metadata> {
  return sharedChatCard(
    `/share/chat/${sessionId}/${org}/${mentor}`,
    org,
    mentor,
  );
}

/**
 * Metadata for the short `/share/chat/[sessionId]` route — resolves the mentor
 * from the session so this link gets the same rich card. Falls back to a
 * generic card when the session/mentor can't be resolved.
 */
export async function buildSharedChatSessionMetadata(
  sessionId: string,
): Promise<Metadata> {
  const resolved = await fetchSharedChatMentor(sessionId);
  return sharedChatCard(
    `/share/chat/${sessionId}`,
    resolved?.org ?? null,
    resolved?.mentor ?? null,
  );
}
