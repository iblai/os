import type { Metadata } from 'next';

import { buildExploreMetadata } from '@/lib/seo';

export { default } from '../../_components/platform-layout';

// The explore directory is a public, indexable "browse AI mentors" page.
// Metadata lives on the layout so the client page stays untouched.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantKey: string }>;
}): Promise<Metadata> {
  const { tenantKey } = await params;
  return buildExploreMetadata(`/platform/${tenantKey}/explore`);
}
