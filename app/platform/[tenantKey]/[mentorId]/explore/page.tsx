'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Prevent static generation - this page uses browser APIs
export const dynamicConfig = 'force-dynamic';

// Lazy load component only on client side to avoid SSR issues
const ExplorePageContent = dynamic(
  () =>
    import('./_components/explore-page-content').then((mod) => ({
      default: mod.ExplorePageContent,
    })),
  { ssr: false },
);

export default function ExplorePage() {
  const params = useParams<{ tenantKey: string; mentorId: string }>();

  return <ExplorePageContent tenantKey={params.tenantKey} />;
}
