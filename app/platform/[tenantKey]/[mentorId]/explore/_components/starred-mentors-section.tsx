'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';

import { useGetAiSearchMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { useExplorePageContext } from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';
import {
  MENTOR_GRID_CLASSNAME,
  MentorGridSkeleton,
  SectionHeader,
} from './section';
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
  const t = useTranslations('exploreStarredMentorsSection');
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
        featured: filters.is_featured === 'true' ? true : undefined,
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

  const headingId = React.useId();
  const isInitialLoad = !starredMentorsData && starredMentorsFetching;
  // Signed-out users can act on the hint (it sends them to sign in); for
  // signed-in users it is only guidance, so it isn't announced as a button.
  const signedOut = !isLoggedIn();

  return (
    <section aria-labelledby={headingId}>
      <SectionHeader
        id={headingId}
        title={t('favoritesHeading')}
        count={starredMentorsData?.count}
      />
      {isInitialLoad ? (
        <MentorGridSkeleton count={3} />
      ) : favoriteMentors.length > 0 ? (
        <>
          <div
            className={MENTOR_GRID_CLASSNAME}
            data-testid="favorites-card-list"
            role="list"
            aria-label={t('favoriteAgentsList')}
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
                className="rounded-full px-5"
                onClick={() =>
                  setNumberOfFavoriteMentors(
                    numberOfFavoriteMentors + FAVORITE_MENTORS_LIMIT,
                  )
                }
                disabled={starredMentorsFetching}
                aria-label={t('loadMoreAriaLabel')}
                role="button"
              >
                {starredMentorsFetching ? (
                  <div className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" aria-hidden="true" />
                    <span>{t('loadingMore')}</span>
                  </div>
                ) : (
                  t('seeMore')
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div
          data-testid="favorites-card"
          className={`flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 px-4 py-3 ${
            signedOut
              ? 'cursor-pointer transition-colors hover:border-[#38A1E5]/50 hover:bg-[#F5F8FF] focus-visible:ring-2 focus-visible:ring-[#38A1E5] focus-visible:outline-none'
              : ''
          }`}
          {...(signedOut && {
            role: 'button',
            tabIndex: 0,
            onClick: handleFavoriteCardClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFavoriteCardClick();
              }
            },
            'aria-label': t('addToFavoritesCardAriaLabel'),
          })}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
            <Star className="h-4 w-4 text-amber-400" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {t('noFavoritesYet')}
            </p>
            <p className="text-sm text-gray-600">
              {t('addToFavoritesDescription')}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
