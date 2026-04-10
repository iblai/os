'use client';

import React from 'react';
import { Award } from 'lucide-react';

import { useGetAiSearchMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/spinner';
import { useExplorePageContext } from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';

const FEATURED_MENTORS_LIMIT = 6;

interface MentorWithProfile {
  id: string | number;
  name: string;
  unique_id?: string;
  profile_image?: string;
  description?: string;
  updated_at?: string | null;
  metadata?: any;
}

export function FeaturedMentorsSection() {
  const {
    tenantKey,
    debouncedSearch,
    filters,
    includeMainPublicMentors,
    setFeaturedMentorsLoading,
  } = useExplorePageContext();

  const [numberOfFeaturedMentors, setNumberOfFeaturedMentors] = React.useState(
    FEATURED_MENTORS_LIMIT,
  );

  // Reset pagination when filters or search change
  React.useEffect(() => {
    setNumberOfFeaturedMentors(FEATURED_MENTORS_LIMIT);
  }, [debouncedSearch, filters.categories, filters.llm_providers]);

  const { data: featuredMentorsData, isFetching: featuredMentorsFetching } =
    useGetAiSearchMentorsQuery(
      {
        platform_key: tenantKey,
        featured: true,
        limit: numberOfFeaturedMentors,
        category: filters.categories || undefined,
        llm: filters.llm_providers || undefined,
        types: filters.types || undefined,
        subjects: filters.subjects || undefined,
        query: debouncedSearch || undefined,
        include_main_public_mentors: includeMainPublicMentors,
      },
      {
        skip: !tenantKey,
      },
    );

  React.useEffect(() => {
    setFeaturedMentorsLoading(featuredMentorsFetching);
  }, [featuredMentorsFetching]);

  const featuredMentors = React.useMemo(() => {
    if (!featuredMentorsData?.results) return [];
    return featuredMentorsData.results as MentorWithProfile[];
  }, [featuredMentorsData]);

  // Don't render the section if there are no featured mentors
  if (featuredMentors.length === 0 && !featuredMentorsFetching) {
    return null;
  }

  return (
    <div>
      <h2
        className="mb-4 text-lg font-medium text-gray-900"
        role="heading"
        aria-level={2}
      >
        Featured
      </h2>
      {featuredMentors.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {featuredMentors.map((mentor) => (
              <MentorCardWithStar key={mentor.id} mentor={mentor} />
            ))}
          </div>
          {featuredMentorsData?.next && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  setNumberOfFeaturedMentors(
                    numberOfFeaturedMentors + FEATURED_MENTORS_LIMIT,
                  )
                }
                disabled={featuredMentorsFetching}
                aria-label="Load more featured mentors"
              >
                {featuredMentorsFetching ? (
                  <div className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" aria-hidden="true" />
                    <span>Loading more</span>
                  </div>
                ) : (
                  'See more'
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-lg border border-[#D0E0FF] bg-[#F5F8FF] md:col-span-2 lg:col-span-3">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#D0E0FF]">
                  <Award className="h-6 w-6 text-[#38A1E5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-2 text-sm font-medium text-gray-900">
                    Featured Mentors
                  </h3>
                  <p className="mb-3 text-sm leading-relaxed text-gray-600">
                    Discover handpicked mentors recommended by our community
                  </p>
                  <p className="text-xs text-gray-500">
                    No featured mentors available
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
