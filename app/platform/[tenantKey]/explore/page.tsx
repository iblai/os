'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { hideInitialLoader } from '@/lib/initial-loader';

// Prevent static generation - this page uses browser APIs
export const dynamicConfig = 'force-dynamic';

// Lazy load component only on client side to avoid SSR issues
const ExplorePageContent = dynamic(
  () =>
    import('../[mentorId]/explore/_components/explore-page-content').then((mod) => ({
      default: mod.ExplorePageContent,
    })),
  { ssr: false },
);

export default function ExplorePage() {
  const params = useParams<{ tenantKey: string }>();

  useEffect(() => {
    hideInitialLoader();
  }, []);

  return <ExplorePageContent tenantKey={params.tenantKey} />;
}
