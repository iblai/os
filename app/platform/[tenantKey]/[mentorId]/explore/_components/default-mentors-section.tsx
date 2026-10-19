'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import { useGetAiSearchMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { useExplorePageContext } from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';
import { EmptyState } from './empty-state';
import {
  MENTOR_GRID_CLASSNAME,
  MentorGridSkeleton,
  SectionHeader,
} from './section';

export const DEFAULT_MENTORS_LIMIT = 12;

export function DefaultMentorsSection() {
  const t = useTranslations('exploreDefaultMentorsSection');
  const {
    tenantKey,
    debouncedSearch,
    isSearching,
    filters,
    includeMainPublicMentors,
    setDefaultMentorsLoading,
  } = useExplorePageContext();

  const [numberOfMentors, setNumberOfMentors] = React.useState(
    DEFAULT_MENTORS_LIMIT,
  );
  const headingId = React.useId();

  // Reset pagination when filters or search change
  React.useEffect(() => {
    setNumberOfMentors(DEFAULT_MENTORS_LIMIT);
  }, [debouncedSearch, filters.categories, filters.llm_providers]);

  const {
    data: mentors,
    isLoading,
    isFetching: mentorsFetching,
  } = useGetAiSearchMentorsQuery(
    {
      platform_key: tenantKey,
      query: debouncedSearch || undefined,
      limit: numberOfMentors,
      category: filters.categories || undefined,
      llm: filters.llm_providers || undefined,
      types: filters.types || undefined,
      subjects: filters.subjects || undefined,
      featured: filters.is_featured === 'true' ? true : undefined,
      include_main_public_mentors: includeMainPublicMentors,
    },
    {
      skip: !tenantKey,
    },
  );

  React.useEffect(() => {
    setDefaultMentorsLoading(mentorsFetching);
  }, [mentorsFetching]);
  const hasMentors = mentors?.results && mentors.results.length > 0;
  const bothEmpty = !hasMentors && !isLoading;

  const allMentorsToShow = React.useMemo(() => {
    return mentors?.results || [];
  }, [mentors?.results]);

  const getDynamicTitleAndSubtext = () => {
    if (isSearching) {
      return {
        title: t('searchResultsTitle', { query: debouncedSearch }),
        subtext: t('searchResultsSubtext', { count: mentors?.count ?? 0 }),
      };
    }
    if (filters.subjects) {
      return {
        title: filters.subjects,
        subtext: t('subjectSubtext', {
          subject: filters.subjects.toLowerCase(),
        }),
      };
    }
    if (filters.categories) {
      return {
        title: filters.categories,
        subtext: t('categorySubtext', {
          category: filters.categories.toLowerCase(),
        }),
      };
    }
    if (filters.llm_providers) {
      return {
        title: t('llmProviderTitle', { provider: filters.llm_providers }),
        subtext: t('llmProviderSubtext', { provider: filters.llm_providers }),
      };
    }
    return {
      title: t('allAgentsTitle'),
      subtext: t('allAgentsSubtext'),
    };
  };

  const { title, subtext } = getDynamicTitleAndSubtext();

  if (isLoading) {
    // The heading is known before the data, so render it now rather than
    // letting it push the grid down when the first page lands.
    return (
      <section aria-labelledby={headingId}>
        <SectionHeader id={headingId} title={title} description={subtext} />
        <MentorGridSkeleton count={6} label={t('loadingAgents')} />
      </section>
    );
  }

  if (bothEmpty) {
    return <EmptyState hint={t('emptyStateHint')} />;
  }

  return (
    <section aria-labelledby={headingId}>
      <SectionHeader
        id={headingId}
        title={title}
        description={subtext}
        count={isSearching ? undefined : mentors?.count}
      />

      {allMentorsToShow && allMentorsToShow.length > 0 ? (
        <>
          <div
            className={MENTOR_GRID_CLASSNAME}
            data-testid="all-mentors-card-list"
            role="list"
            aria-label={t('allAgentsListAriaLabel')}
          >
            {allMentorsToShow.map((mentor) => (
              <div
                key={mentor.id}
                role="listitem"
                aria-label={t('exploreAgentAriaLabel', { name: mentor.name })}
              >
                <MentorCardWithStar mentor={mentor} />
              </div>
            ))}
          </div>
          {mentors?.next && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                className="rounded-full px-5"
                onClick={() =>
                  setNumberOfMentors(numberOfMentors + DEFAULT_MENTORS_LIMIT)
                }
                disabled={mentorsFetching}
                aria-label={t('loadMoreAriaLabel')}
                role="button"
              >
                {mentorsFetching ? (
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
        <EmptyState hint={t('emptyStateHint')} />
      )}
    </section>
  );
}
