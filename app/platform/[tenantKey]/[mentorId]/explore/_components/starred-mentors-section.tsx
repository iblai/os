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

  const [numberOfFavoriteMentors, setNumberOfFavoriteMentors] =
    React.useState(FAVORITE_MENTORS_LIMIT);

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
      <h2 className="text-lg font-medium text-gray-900 mb-4" role="heading" aria-level={2}>
        Favorites
      </h2>
      {favoriteMentors.length > 0 ? (
        <>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            data-testid="favorites-card-list"
            role="list"
            aria-label="Favorite mentors"
          >
            {favoriteMentors.map((mentor) => (
              <div key={mentor.id} role="listitem">
                <MentorCardWithStar mentor={mentor} />
              </div>
            ))}
          </div>
          {starredMentorsData?.next && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() =>
                  setNumberOfFavoriteMentors(numberOfFavoriteMentors + FAVORITE_MENTORS_LIMIT)
                }
                disabled={starredMentorsFetching}
                aria-label="Load more favorite mentors"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            data-testid="favorites-card"
            className="border border-[#D0E0FF] rounded-lg bg-[#F5F8FF] md:col-span-2 lg:col-span-3 cursor-pointer hover:shadow-md transition-shadow duration-200"
            onClick={handleFavoriteCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFavoriteCardClick();
              }
            }}
            aria-label="Add to Favorites - Sign up to star mentors"
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-[#D0E0FF] rounded-lg flex-shrink-0">
                  <Star className="h-6 w-6 text-[#38A1E5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium mb-2 text-sm text-gray-900">Add to Favorites</h3>
                  <p className="text-sm mb-3 leading-relaxed text-gray-600">
                    Star your favorite mentors to quickly access them here
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
