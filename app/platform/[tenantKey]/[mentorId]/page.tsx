import type { Metadata } from 'next';

import type { TenantKeyMentorIdParams } from '@/lib/types';
import {
  buildMentorMetadata,
  mentorJsonLd,
  fetchMentorDisplayName,
} from '@/lib/seo-mentor';
import { JsonLd } from '@/components/seo/json-ld';

import MentorPageContent from './mentor-page-content';

// Server component wrapper: resolves per-mentor SEO metadata + structured data,
// then renders the interactive (client) chat UI. Public mentors are indexable;
// private ones stay noindex (see lib/seo-mentor). This page uses request-time
// data, so it must stay dynamic.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<TenantKeyMentorIdParams>;
}): Promise<Metadata> {
  const { tenantKey, mentorId } = await params;
  return buildMentorMetadata(tenantKey, mentorId);
}

export default async function Page({
  params,
}: {
  params: Promise<TenantKeyMentorIdParams>;
}) {
  const { tenantKey, mentorId } = await params;
  // Both reuse the same public-settings fetch as generateMetadata (deduped
  // within the request), so this adds no extra network round-trips.
  const [jsonLd, agentName] = await Promise.all([
    mentorJsonLd(tenantKey, mentorId),
    fetchMentorDisplayName(tenantKey, mentorId),
  ]);

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {/* Server-rendered page heading for crawlers and screen readers. Visually
          hidden (sr-only) so the chat UI is unchanged — the SPA draws the visible
          chrome after it hydrates. */}
      {agentName && <h1 className="sr-only">{agentName}</h1>}
      <MentorPageContent />
    </>
  );
}
