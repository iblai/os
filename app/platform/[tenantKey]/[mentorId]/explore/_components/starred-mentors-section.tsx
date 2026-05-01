'use client';

import React from 'react';
import { Star } from 'lucide-react';

import { useGetAiSearchMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/spinner';
import { useExplorePageContext } from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';
import { isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';

const FAVORITE_MENTORS_LIMIT = 6;

interface MentorWithProfile {
  id: string | number;
  name: string;
  unique_id?: string;
  profile_image?: string;
  description?: string;
  updated_at?: string | null;
  metadata?: any;
}

export function StarredMentorsSection() {
  const {
    tenantKey,
    username,
    debouncedSearch,
    filters,
    includeMainPublicMentors,
    setStarredMentorsLoading,
  } = useExplorePageContext();

  const [numberOfFavoriteMentors, setNumberOfFavoriteMentors] = React.useState(
    FAVORITE_MENTORS_LIMIT,
  );

  // Reset pagination when filters or search change
  React.useEffect(() => {
    setNumberOfFavoriteMentors(FAVORITE_MENTORS_LIMIT);
  }, [debouncedSearch, filters.categories, filters.llm_providers]);

  const { data: starredMentorsData, isFetching: starredMentorsFetching } =
    useGetAiSearchMentorsQuery(
      {
        platform_key: tenantKey,
        starred: true,
        limit: numberOfFavoriteMentors,
        category: filters.categories || undefined,
        llm: filters.llm_providers || undefined,
        types: filters.types || undefined,
        subjects: filters.subjects || undefined,
        query: debouncedSearch || undefined,
        order_direction: 'desc',
        include_main_public_mentors: includeMainPublicMentors,
      },
      {
        skip: !username || !tenantKey,
      },
    );

  React.useEffect(() => {
    setStarredMentorsLoading(starredMentorsFetching);
  }, [starredMentorsFetching]);

  const favoriteMentors = React.useMemo(() => {
    if (!starredMentorsData?.results) return [];
    return starredMentorsData.results as MentorWithProfile[];
  }, [starredMentorsData]);

  const handleFavoriteCardClick = React.useCallback(() => {
    if (!isLoggedIn()) {
      redirectToAuthSpaJoinTenant(tenantKey);
    }
  }, [tenantKey]);

  return (
    <div>
      <h2
        className="mb-4 text-lg font-medium text-gray-900"
        role="heading"
        aria-level={2}
      >
        Favorites
      </h2>
      {favoriteMentors.length > 0 ? (
        <>
          <div
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
            data-testid="favorites-card-list"
            role="list"
            aria-label="Favorite agents"
          >
            {favoriteMentors.map((mentor) => (
              <div key={mentor.id} role="listitem">
                <MentorCardWithStar mentor={mentor} />
              </div>
            ))}
          </div>
          {starredMentorsData?.next && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  setNumberOfFavoriteMentors(
                    numberOfFavoriteMentors + FAVORITE_MENTORS_LIMIT,
                  )
                }
                disabled={starredMentorsFetching}
                aria-label="Load more favorite agents"
                role="button"
              >
                {starredMentorsFetching ? (
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
          <Card
            data-testid="favorites-card"
            className="cursor-pointer rounded-lg border border-[#D0E0FF] bg-[#F5F8FF] transition-shadow duration-200 hover:shadow-md md:col-span-2 lg:col-span-3"
            onClick={handleFavoriteCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFavoriteCardClick();
              }
            }}
            aria-label="Add to Favorites - Sign up to star agents"
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#D0E0FF]">
                  <Star className="h-6 w-6 text-[#38A1E5]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-2 text-sm font-medium text-gray-900">
                    Add to Favorites
                  </h3>
                  <p className="mb-3 text-sm leading-relaxed text-gray-600">
                    Star your favorite agents to quickly access them here
                  </p>
                  <p className="text-xs text-gray-500">No favorites yet</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
