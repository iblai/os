import type { Metadata } from 'next';

import { config } from '@/lib/config';
import { buildMetadata, SITE_NAME } from '@/lib/seo';

/**
 * SEO for the explore / agent-directory pages (public + indexable). The meta
 * description lists the first few agents in the tenant so the search snippet is
 * concrete ("… including Support Bot, Sales Coach, and Onboarding Guide").
 */

/** Join names as "A", "A and B", or "A, B, and C". */
function formatNameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Fetch the first `limit` agent names for a tenant from the public agent-search
 * endpoint. Returns `[]` on any failure (no auth required).
 */
export async function fetchTenantAgentNames(
  org: string,
  limit = 5,
): Promise<string[]> {
  if (!org) return [];

  const url =
    `${config.dmUrl()}/api/ai-search/mentors/?platform_key=${encodeURIComponent(org)}` +
    `&limit=${limit}&include_main_public_mentors=true`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { results?: unknown };
    const results = Array.isArray(data?.results) ? data.results : [];

    return results
      .map((item) => {
        const m = item as Record<string, unknown>;
        const name = m?.name ?? m?.display_name ?? m?.mentor_name;
        return typeof name === 'string' ? name.trim() : '';
      })
      .filter(Boolean)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Indexable metadata for an explore page, listing the tenant's first few
 * agents in the description.
 */
export async function buildExploreMetadata(
  path: string,
  org: string,
): Promise<Metadata> {
  // Three keeps the description within the ~160 chars search engines display.
  const names = await fetchTenantAgentNames(org, 3);
  const description = names.length
    ? `Browse and chat with AI agents on ${SITE_NAME}, including ${formatNameList(names)}.`
    : `Browse and chat with AI agents on ${SITE_NAME}.`;

  return buildMetadata({
    path,
    index: true,
    title: 'Explore Agents',
    description,
  });
}
