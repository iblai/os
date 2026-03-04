'use client';

import React from 'react';

import { useGetAiSearchMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import { useExplorePageContext } from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';
import { EmptyState } from './empty-state';
import { WithPermissions } from '@/hoc/withPermissions';
import { useNavigate } from '@/hooks/user-navigate';
import { isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';

const DEFAULT_MENTORS_LIMIT = 8;
const CREATE_MENTOR_RBAC_RESOURCE = '/mentors/#create';

export function DefaultMentorsSection() {
  const {
    tenantKey,
    debouncedSearch,
    filters,
    includeMainPublicMentors,
    setDefaultMentorsLoading,
  } = useExplorePageContext();

  const [numberOfMentors, setNumberOfMentors] = React.useState(DEFAULT_MENTORS_LIMIT);
  const { openCreateMentorModal } = useNavigate();

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
    if (filters.subjects) {
      return {
        title: filters.subjects,
        subtext: `Explore ${filters.subjects.toLowerCase()} mentors and specialized learning assistants.`,
      };
    }
    if (filters.categories) {
      return {
        title: filters.categories,
        subtext: `Explore ${filters.categories.toLowerCase()} mentors and specialized learning assistants.`,
      };
    }
    if (filters.llm_providers) {
      return {
        title: `${filters.llm_providers} Mentors`,
        subtext: `Explore mentors powered by ${filters.llm_providers}.`,
      };
    }
    return {
      title: 'All Mentors',
      subtext: 'Explore mentors and specialized learning assistants.',
    };
  };

  const handleCreateMentor = React.useCallback(() => {
    if (!isLoggedIn()) {
      redirectToAuthSpaJoinTenant(tenantKey);
      return;
    }
    openCreateMentorModal();
  }, [openCreateMentorModal, tenantKey]);

  const { title, subtext } = getDynamicTitleAndSubtext();

  if (isLoading) {
    return (
      <div role="status" aria-live="polite">
        <Spinner className="h-60" />
        <span className="sr-only">Loading mentors...</span>
      </div>
    );
  }

  if (bothEmpty) {
    return <EmptyState />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900" role="heading" aria-level={2}>
            {title}
          </h2>
          <p className="text-sm text-gray-600">{subtext}</p>
        </div>

        <WithPermissions rbacResource={CREATE_MENTOR_RBAC_RESOURCE}>
          {(hasPermission) => (
            <>
              {hasPermission && (
                <Button
                  className="text-white px-6 py-2 rounded-lg bg-gradient-to-r from-[#38A1E5] to-[#7284FF] hover:from-[#2E8BD1] hover:to-[#5F6FE8]"
                  onClick={handleCreateMentor}
                  aria-label="Create new mentor"
                >
                  Create Mentor
                </Button>
              )}
            </>
          )}
        </WithPermissions>
      </div>

      {allMentorsToShow && allMentorsToShow.length > 0 ? (
        <>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            data-testid="all-mentors-card-list"
            role="list"
            aria-label="All mentors"
          >
            {allMentorsToShow.map((mentor) => (
              <div key={mentor.id} role="listitem" aria-label={`Explore mentor: ${mentor.name}`}>
                <MentorCardWithStar mentor={mentor} />
              </div>
            ))}
          </div>
          {mentors?.next && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => setNumberOfMentors(numberOfMentors + DEFAULT_MENTORS_LIMIT)}
                disabled={mentorsFetching}
                aria-label="Load more mentors"
                role="button"
              >
                {mentorsFetching ? (
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
        <EmptyState />
      )}
    </div>
  );
}
