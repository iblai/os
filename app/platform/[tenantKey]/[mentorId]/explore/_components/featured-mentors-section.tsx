'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

import { useGetAiSearchMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { useExplorePageContext } from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';
import { MENTOR_GRID_CLASSNAME, SectionHeader } from './section';

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
  const t = useTranslations('exploreFeaturedMentorsSection');
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

  const headingId = React.useId();

  // Featured agents are optional per tenant, so the section only appears once
  // there is something to show — never a placeholder that claims "none".
  if (featuredMentors.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId}>
      <SectionHeader
        id={headingId}
        title={t('heading')}
        count={featuredMentorsData?.count}
      />
      <div className={MENTOR_GRID_CLASSNAME}>
        {featuredMentors.map((mentor) => (
          <MentorCardWithStar key={mentor.id} mentor={mentor} />
        ))}
      </div>
      {featuredMentorsData?.next && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={() =>
              setNumberOfFeaturedMentors(
                numberOfFeaturedMentors + FEATURED_MENTORS_LIMIT,
              )
            }
            disabled={featuredMentorsFetching}
            aria-label={t('loadMoreAriaLabel')}
          >
            {featuredMentorsFetching ? (
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
    </section>
  );
}
