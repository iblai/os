import type { Metadata } from 'next';

import type { TenantKeyMentorIdParams } from '@/lib/types';
import { buildMentorMetadata, mentorJsonLd } from '@/lib/seo-mentor';
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
  // Deduped with generateMetadata's fetch within the same request.
  const jsonLd = await mentorJsonLd(tenantKey, mentorId);

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <MentorPageContent />
    </>
  );
}
