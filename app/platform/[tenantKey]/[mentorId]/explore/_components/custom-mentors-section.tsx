'use client';

import React from 'react';
import { Plus } from 'lucide-react';

import { useGetPersonnalizedMentorsQuery } from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/spinner';
import {
  CUSTOM_MENTORS_LIMIT,
  useExplorePageContext,
} from './explore-page-context';
import { MentorCardWithStar } from './mentor-card-with-star';
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

export function CustomMentorsSection() {
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

  return (
    <div>
      <h2
        className="mb-4 text-lg font-medium text-gray-900"
        role="heading"
        aria-level={2}
      >
        Custom
      </h2>
      {customMentors.length > 0 ? (
        <>
          <div
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
            data-testid="custom-mentors-card-list"
            role="list"
            aria-label="Custom agents"
          >
            {customMentors.map((mentor) => (
              <div key={mentor.id} role="listitem">
                <MentorCardWithStar mentor={mentor} />
              </div>
            ))}
          </div>
          {customMentorsData?.next && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  setNumberOfCustomMentors(
                    numberOfCustomMentors + CUSTOM_MENTORS_LIMIT,
                  )
                }
                disabled={customMentorsFetching}
                aria-label="Load more custom agents"
              >
                {customMentorsFetching ? (
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
          <WithPermissions rbacResource={CREATE_MENTOR_RBAC_RESOURCE}>
            {(hasPermission) =>
              hasPermission ? (
                <div className="mt-6">
                  <Card
                    className="cursor-pointer border border-[#D0E0FF] bg-[#F5F8FF] transition-shadow duration-200 hover:shadow-md"
                    onClick={handleCreateMentor}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCreateMentor();
                      }
                    }}
                    aria-label="Create Custom Agent"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#D0E0FF]">
                          <Plus className="h-6 w-6 text-[#38A1E5]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className="mb-2 text-sm font-medium text-gray-900"
                            role="heading"
                            aria-level={3}
                          >
                            Create Custom Agent
                          </h3>
                          <p className="mb-3 text-sm leading-relaxed text-gray-600">
                            Build your own custom agent tailored to your
                            specific learning needs
                          </p>
                          <p className="text-xs text-gray-500">
                            Get started today
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null
            }
          </WithPermissions>
        </>
      ) : (
        <WithPermissions rbacResource={CREATE_MENTOR_RBAC_RESOURCE}>
          {(hasPermission) =>
            hasPermission ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card
                  className="cursor-pointer border border-[#D0E0FF] bg-[#F5F8FF] transition-shadow duration-200 hover:shadow-md md:col-span-2 lg:col-span-3"
                  onClick={handleCreateMentor}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCreateMentor();
                    }
                  }}
                  aria-label="Create Custom Agent"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#D0E0FF]">
                        <Plus className="h-6 w-6 text-[#38A1E5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          className="mb-2 text-sm font-medium text-gray-900"
                          role="heading"
                          aria-level={3}
                        >
                          Create Custom Agent
                        </h3>
                        <p className="mb-3 text-sm leading-relaxed text-gray-600">
                          Build your own custom agent tailored to your specific
                          learning needs
                        </p>
                        <p className="text-xs text-gray-500">
                          Get started today
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null
          }
        </WithPermissions>
      )}
    </div>
  );
}
