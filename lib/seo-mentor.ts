import type { Metadata } from 'next';

import { config } from '@/lib/config';
import { ANONYMOUS_USERNAME, MENTOR_VISIBILITY_VALUES } from '@/lib/constants';
import {
  buildMetadata,
  getSiteUrl,
  joinUrl,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
} from '@/lib/seo';

/**
 * Server-side SEO data for a mentor (`/platform/[tenantKey]/[mentorId]`).
 *
 * A mentor page is only indexable when the mentor is public — i.e. it allows
 * anonymous access or is visible to anyone. This mirrors the auth middleware in
 * `providers/index.tsx`, so private mentors stay out of search results. Runs in
 * `generateMetadata` (server), so it uses a plain `fetch` against the public
 * settings endpoint rather than the client RTK-Query hook.
 */
export interface MentorPublicMeta {
  isPublic: boolean;
  name: string | null;
  description: string | null;
  image: string | null;
}

/** First non-empty string among the given keys of an object. */
function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Fetch a mentor's public settings and normalise the SEO-relevant fields.
 * Returns `null` on any failure (network/404/private) so callers fall back to
 * safe, non-indexable defaults.
 */
export async function fetchMentorPublicMeta(
  org: string,
  mentor: string,
): Promise<MentorPublicMeta | null> {
  if (!org || !mentor) return null;

  const url =
    `${config.dmUrl()}/api/ai-mentor/orgs/${encodeURIComponent(org)}` +
    `/users/${ANONYMOUS_USERNAME}/mentors/${encodeURIComponent(mentor)}/public-settings/`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Never cache — always reflect the mentor's current public settings.
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const isPublic =
      data?.allow_anonymous === true ||
      data?.mentor_visibility === MENTOR_VISIBILITY_VALUES.ANYONE;

    return {
      isPublic,
      name: pickString(data, ['mentor_name', 'display_name', 'name']),
      description: pickString(data, [
        'description',
        'mentor_description',
        'welcome_message',
      ]),
      image: pickString(data, [
        'profile_image',
        'profile_image_url',
        'avatar',
        'logo',
      ]),
    };
  } catch {
    return null;
  }
}

/**
 * Build the `Metadata` for a mentor page. Public mentors get rich, indexable
 * metadata (name, description, avatar card); everything else stays noindex.
 */
export async function buildMentorMetadata(
  org: string,
  mentor: string,
): Promise<Metadata> {
  const path = `/platform/${org}/${mentor}`;
  const meta = await fetchMentorPublicMeta(org, mentor);

  if (!meta?.isPublic) {
    // Private mentor / unknown → default (noindex) metadata.
    return buildMetadata({ path });
  }

  const name = meta.name ?? 'AI Agent';
  const description =
    meta.description ?? `Chat with ${name}, an AI agent on ${SITE_NAME}.`;

  return buildMetadata({
    path,
    index: true,
    title: name,
    description,
    images: meta.image ? [meta.image] : undefined,
    type: 'profile',
  });
}

/** schema.org JSON-LD describing a public mentor. Null when not indexable. */
export async function mentorJsonLd(
  org: string,
  mentor: string,
): Promise<Record<string, unknown> | null> {
  const meta = await fetchMentorPublicMeta(org, mentor);
  if (!meta?.isPublic) return null;

  const origin = await getSiteUrl();
  const name = meta.name ?? 'AI Agent';

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    name,
    description:
      meta.description ?? `Chat with ${name}, an AI agent on ${SITE_NAME}.`,
    url: joinUrl(origin, `/platform/${org}/${mentor}`),
    image: meta.image ?? joinUrl(origin, DEFAULT_OG_IMAGE),
    provider: { '@type': 'Organization', name: SITE_NAME },
  };
}
