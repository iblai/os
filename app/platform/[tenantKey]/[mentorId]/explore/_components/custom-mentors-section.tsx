'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useGetPersonnalizedMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';
import {
  CUSTOM_MENTORS_LIMIT,
  useExplorePageContext,
} from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';
import {
  MENTOR_GRID_CLASSNAME,
  MentorGridSkeleton,
  SectionHeader,
} from './section';
import { WithPermissions } from '@/hoc/withPermissions';
import { useNavigate } from '@/hooks/user-navigate';
import { isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';
const CREATE_MENTOR_RBAC_RESOURCE = '/mentors/#create';

interface MentorWithProfile {
  id: string | number;
  name: string;
  unique_id?: string;
  profile_image?: string;
  description?: string;
  updated_at?: string | null;
  metadata?: any;
}

function CreateAgentTile({
  onClick,
  wide = false,
}: {
  onClick: () => void;
  wide?: boolean;
}) {
  const t = useTranslations('exploreCustomMentorsSection');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('createAgentAriaLabel')}
      className={`group flex h-full w-full rounded-xl border-2 border-dashed border-[#38A1E5]/35 bg-[#F5F8FF]/60 p-4 transition-colors hover:border-[#38A1E5] hover:bg-[#F5F8FF] focus-visible:ring-2 focus-visible:ring-[#38A1E5] focus-visible:ring-offset-2 focus-visible:outline-none ${
        wide
          ? 'items-center gap-4 text-left'
          : 'min-h-[148px] flex-col items-center justify-center gap-2 text-center'
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#38A1E5] shadow-sm ring-1 ring-[#D0E0FF] transition-transform group-hover:scale-105 motion-reduce:transition-none">
        <Plus className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">
          {t('createAgentHeading')}
        </span>
        <span className="mt-0.5 block text-sm text-gray-600">
          {t('createAgentDescription')}
        </span>
      </span>
    </button>
  );
}

export function CustomMentorsSection() {
  const t = useTranslations('exploreCustomMentorsSection');
  const {
    tenantKey,
    username,
    debouncedSearch,
    filters,
    includeMainPublicMentors,
    setCustomMentorsLoading,
  } = useExplorePageContext();

  const [numberOfCustomMentors, setNumberOfCustomMentors] =
    React.useState(CUSTOM_MENTORS_LIMIT);
  const { openCreateMentorModal } = useNavigate();
  const headingId = React.useId();

  // Reset pagination when filters or search change
  React.useEffect(() => {
    setNumberOfCustomMentors(CUSTOM_MENTORS_LIMIT);
  }, [debouncedSearch, filters.categories, filters.llm_providers]);

  const { data: customMentorsData, isFetching: customMentorsFetching } =
    useGetPersonnalizedMentorsQuery(
      {
        platform_key: tenantKey,
        username: username || undefined,
        limit: numberOfCustomMentors,
        category: filters.categories || undefined,
        llm: filters.llm_providers || undefined,
        types: filters.types || undefined,
        subjects: filters.subjects || undefined,
        featured: filters.is_featured === 'true' ? true : undefined,
        query: debouncedSearch || undefined,
        include_main_public_mentors: includeMainPublicMentors,
      },
      {
        skip: !username || !tenantKey,
      },
    );

  React.useEffect(() => {
    setCustomMentorsLoading(customMentorsFetching);
  }, [customMentorsFetching]);

  const customMentors = React.useMemo(() => {
    if (!customMentorsData?.results) return [];
    return customMentorsData.results as MentorWithProfile[];
  }, [customMentorsData]);

  const handleCreateMentor = React.useCallback(() => {
    if (!isLoggedIn()) {
      redirectToAuthSpaJoinTenant(tenantKey);
      return;
    }
    openCreateMentorModal();
  }, [openCreateMentorModal, tenantKey]);

  const header = (
    <SectionHeader
      id={headingId}
      title={t('sectionHeading')}
      count={customMentorsData?.count}
    />
  );

  if (!customMentorsData && customMentorsFetching) {
    return (
      <section aria-labelledby={headingId}>
        {header}
        <MentorGridSkeleton count={3} />
      </section>
    );
  }

  // Nothing of their own yet: the section is only worth showing to people who
  // can create an agent, as the way to make their first one.
  if (customMentors.length === 0) {
    return (
      <WithPermissions rbacResource={CREATE_MENTOR_RBAC_RESOURCE}>
        {({ hasPermission }) =>
          hasPermission ? (
            <section aria-labelledby={headingId}>
              {header}
              <CreateAgentTile onClick={handleCreateMentor} wide />
            </section>
          ) : null
        }
      </WithPermissions>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      {header}
      <div
        className={MENTOR_GRID_CLASSNAME}
        data-testid="custom-mentors-card-list"
        role="list"
        aria-label={t('listAriaLabel')}
      >
        {customMentors.map((mentor) => (
          <div key={mentor.id} role="listitem">
            <MentorCardWithStar mentor={mentor} />
          </div>
        ))}
        <WithPermissions rbacResource={CREATE_MENTOR_RBAC_RESOURCE}>
          {({ hasPermission }) =>
            hasPermission ? (
              <div role="listitem">
                <CreateAgentTile onClick={handleCreateMentor} />
              </div>
            ) : null
          }
        </WithPermissions>
      </div>
      {customMentorsData?.next && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={() =>
              setNumberOfCustomMentors(
                numberOfCustomMentors + CUSTOM_MENTORS_LIMIT,
              )
            }
            disabled={customMentorsFetching}
            aria-label={t('loadMoreAriaLabel')}
          >
            {customMentorsFetching ? (
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
