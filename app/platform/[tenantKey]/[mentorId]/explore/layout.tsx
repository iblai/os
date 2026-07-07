import type { Metadata } from 'next';

import { buildExploreMetadata } from '@/lib/seo';

// Passthrough layout that exists solely to attach indexable SEO metadata to the
// mentor-scoped explore directory without altering the rendered UI.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantKey: string; mentorId: string }>;
}): Promise<Metadata> {
  const { tenantKey, mentorId } = await params;
  return buildExploreMetadata(`/platform/${tenantKey}/${mentorId}/explore`);
}

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
