'use client';

import React from 'react';
import { useDebounce } from 'use-debounce';
import { Search, Loader2 } from 'lucide-react';

import { useUsername } from '@/hooks/use-user';
import {
  useGetAiSearchMentorsQuery,
  useStarMentorMutation,
  useUnstarMentorMutation,
  useGetPersonnalizedMentorsQuery,
} from '@iblai/iblai-js/data-layer';
import { Input } from '@/components/ui/input';
import { useNavigate } from '@/hooks/user-navigate';
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';
import { isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';

import { MentorCategories } from './mentor-categories';
import {
  ExplorePageContext,
  ExplorePageContextValue,
  ExplorePageFilters,
} from './explore-page-context';
import { StarredMentorsSection } from './starred-mentors-section';
import { FeaturedMentorsSection } from './featured-mentors-section';
import { CustomMentorsSection } from './custom-mentors-section';
import { DefaultMentorsSection } from './default-mentors-section';
import { config } from '@/lib/config';
import { CUSTOM_MENTORS_LIMIT } from './explore-page-context';

interface ExplorePageContentProps {
  tenantKey: string;
}

export function ExplorePageContent({ tenantKey }: ExplorePageContentProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 500);
  const [filters, setFilters] = React.useState<ExplorePageFilters>({
    categories: null,
    subjects: null,
    llm_providers: null,
    types: null,
    is_featured: null,
  });
  const [togglingMentorId, setTogglingMentorId] = React.useState<string | null>(null);

  const username = useUsername();
  const { navigateToMentor } = useNavigate();

  const { metadata } = useTenantMetadata({ org: tenantKey });

  // createdBy starts as null - when community mentors is enabled, null means "show all"
  const [createdBy, setCreatedBy] = React.useState<'me' | 'my-organization' | 'community' | null>(
    null,
  );

  const communityMentorsEnabled = metadata?.mentor_include_community_mentors !== false;

  // Determine effective tenant key based on createdBy
  // - createdBy null: current tenant key (with include_main_public_mentors=true if community enabled)
  // - createdBy 'community': main tenant key
  // - createdBy 'my-organization' or 'me': current tenant key
  const effectiveTenantKey = React.useMemo(() => {
    if (createdBy === 'community') {
      return config.mainTenantKey();
    }
    return tenantKey;
  }, [createdBy, tenantKey]);

  // Check if only custom mentors should be shown (when 'me' is selected)
  const showOnlyCustomMentors = createdBy === 'me';

  // Check if user is actively searching
  const isSearching = debouncedSearch.length > 0;

  const [starredMentorsLoading, setStarredMentorsLoading] = React.useState(false);
  const [customMentorsLoading, setCustomMentorsLoading] = React.useState(false);
  const [featuredMentorsLoading, setFeaturedMentorsLoading] = React.useState(false);
  const [defaultMentorsLoading, setDefaultMentorsLoading] = React.useState(false);

  // Determine include_main_public_mentors based on createdBy and metadata
  // - createdBy null + community enabled: true (show all including community)
  // - createdBy 'community': true
  // - createdBy 'my-organization' or 'me': false
  // - community disabled: always false
  const includeMainPublicMentors = React.useMemo(() => {
    if (!communityMentorsEnabled) {
      return false;
    }
    if (createdBy === null || createdBy === 'community') {
      return true;
    }
    return false;
  }, [createdBy, communityMentorsEnabled]);

  // Fetch all facets without filters to show all available options
  // Use effectiveTenantKey so facets match the community/org context
  const { data: allFacetsData } = useGetAiSearchMentorsQuery(
    {
      platform_key: effectiveTenantKey,
      query: debouncedSearch || undefined,
      limit: 1,
      include_main_public_mentors: includeMainPublicMentors,
    },
    {
      skip: !effectiveTenantKey,
    },
  );

  //check if there are custom mentors
  const { data: customMentorsData } = useGetPersonnalizedMentorsQuery(
    {
      platform_key: tenantKey,
      username: username || undefined,
      limit: CUSTOM_MENTORS_LIMIT,
      category: filters.categories || undefined,
      llm: filters.llm_providers || undefined,
      query: debouncedSearch || undefined,
      include_main_public_mentors: includeMainPublicMentors,
    },
    {
      skip: !username || !tenantKey,
    },
  );

  const hasCustomMentors =
    Array.isArray(customMentorsData?.results) && customMentorsData.results.length > 0;

  // Star/Unstar mutations
  const [starMentor] = useStarMentorMutation();
  const [unstarMentor] = useUnstarMentorMutation();

  const facets = allFacetsData?.facets;

  const toggleFavorite = React.useCallback(
    async (mentor: any, event: React.MouseEvent) => {
      event.stopPropagation();

      if (!isLoggedIn()) {
        redirectToAuthSpaJoinTenant(tenantKey);
        return;
      }

      if (!username || !tenantKey) return;

      const isStarred = (mentor as any)?.starred === true;

      setTogglingMentorId(String(mentor.id));

      try {
        if (isStarred) {
          await unstarMentor({
            org: tenantKey,
            // @ts-expect-error - userId parameter type mismatch
            userId: username,
            mentor: mentor.unique_id || '',
          }).unwrap();
        } else {
          await starMentor({
            org: tenantKey,
            // @ts-expect-error - userId parameter type mismatch
            userId: username,
            mentor: mentor.unique_id || '',
          }).unwrap();
        }
        //await Promise.all([refetchMentors(), refetchStarredMentors(), refetchCustomMentors()]);
      } catch (error) {
        console.error('Error toggling favorite:', error);
      } finally {
        setTogglingMentorId(null);
      }
    },
    [username, tenantKey, starMentor, unstarMentor],
  );

  const handleMentorClick = React.useCallback(
    (mentor: any) => {
      if (mentor.unique_id) {
        navigateToMentor(mentor.unique_id);
      }
    },
    [navigateToMentor],
  );

  const handleFiltersChange = React.useCallback((newFilters: ExplorePageFilters) => {
    setFilters(newFilters);
  }, []);

  const handleCreatedByChange = React.useCallback(
    (newCreatedBy: 'me' | 'my-organization' | 'community' | null) => {
      setCreatedBy(newCreatedBy);
    },
    [],
  );

  const contextValue: ExplorePageContextValue = {
    tenantKey: effectiveTenantKey,
    username,
    debouncedSearch,
    isSearching,
    filters,
    createdBy,
    includeMainPublicMentors,
    togglingMentorId,
    toggleFavorite,
    handleMentorClick,
    starredMentorsLoading,
    setStarredMentorsLoading,
    customMentorsLoading,
    setCustomMentorsLoading,
    featuredMentorsLoading,
    setFeaturedMentorsLoading,
    defaultMentorsLoading,
    setDefaultMentorsLoading,
  };

  return (
    <ExplorePageContext.Provider value={contextValue}>
      <div className="flex h-full overflow-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded focus:shadow-lg"
        >
          Skip to main content
        </a>
        <div
          className="flex-1 overflow-y-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          id="main-content"
          aria-label="Mentor exploration page"
        >
          <div className="px-3 md:px-6 py-6 md:py-8 max-w-[920px] mx-auto">
            <div className="text-center mb-6">
              <div className="w-full mx-auto">
                <h1 className="text-lg md:text-xl font-medium mb-6 leading-relaxed text-gray-600">
                  Discover and create academic mentors that combine{' '}
                  <br className="hidden md:block" />
                  subject expertise, educational resources, and teaching skills
                </h1>
              </div>

              <div className="w-full mb-6">
                <div className="relative">
                  <label htmlFor="mentor-search" className="sr-only">
                    Search mentors
                  </label>
                  {searchQuery &&
                  (starredMentorsLoading ||
                    customMentorsLoading ||
                    featuredMentorsLoading ||
                    defaultMentorsLoading) ? (
                    <Loader2
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#38A1E5] w-5 h-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Search
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                      aria-hidden="true"
                    />
                  )}
                  <Input
                    id="mentor-search"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 text-base border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Search mentors"
                  />
                </div>
              </div>
            </div>

            <div className="max-w-6xl mx-auto">
              <div className="flex justify-start mb-6 sticky top-0 bg-white z-10 py-2">
                <MentorCategories
                  facets={facets}
                  showCreatedByFilter={metadata?.mentor_include_community_mentors !== false}
                  onFiltersChange={handleFiltersChange}
                  onCreatedByChange={handleCreatedByChange}
                  includeMeToCreatedByFilter={hasCustomMentors}
                />
              </div>
              <div className="border-b border-gray-200 mb-6"></div>
            </div>

            {showOnlyCustomMentors ? (
              <div className="max-w-[920px] mx-auto pb-32">
                <CustomMentorsSection />
              </div>
            ) : isSearching ? (
              <div className="max-w-[920px] mx-auto pb-32">
                <DefaultMentorsSection />
              </div>
            ) : (
              <>
                <div className="max-w-[920px] mx-auto mb-8 space-y-8">
                  <StarredMentorsSection />
                  <FeaturedMentorsSection />
                  <CustomMentorsSection />
                </div>

                <div className="max-w-[920px] mx-auto pb-32">
                  <DefaultMentorsSection />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ExplorePageContext.Provider>
  );
}
