'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useDebounce } from 'use-debounce';
import { Search, Loader2, Plus, X } from 'lucide-react';

import { useUsername } from '@/hooks/use-user';
import {
  useGetAiSearchMentorsQuery,
  useStarMentorMutation,
  useUnstarMentorMutation,
  useGetSearchGlobalQuery,
} from '@iblai/iblai-js/data-layer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from '@/hooks/user-navigate';
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';
import { isLoggedIn, redirectToAuthSpaJoinTenant } from '@/lib/utils';
import { WithPermissions } from '@/hoc/withPermissions';

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

const CREATE_MENTOR_RBAC_RESOURCE = '/mentors/#create';

// Global search has no creator filter, so one page of the tenant's agents is
// scanned for one the user created. Users whose own agents all sit beyond
// this page won't get the "Created by: Me" option.
export const OWN_AGENTS_SCAN_LIMIT = 100;

/** True when a global-search result is an agent created by `username`. */
export function isAgentCreatedBy(
  item: Record<string, unknown>,
  username: string,
): boolean {
  if (item.type !== 'agent') return false;
  const data = item.data as { created_by?: unknown } | undefined;
  return data?.created_by === username;
}

interface ExplorePageContentProps {
  tenantKey: string;
}

export function ExplorePageContent({ tenantKey }: ExplorePageContentProps) {
  const t = useTranslations('exploreExplorePageContent');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch] = useDebounce(searchQuery, 500);
  const [filters, setFilters] = React.useState<ExplorePageFilters>({
    categories: null,
    subjects: null,
    llm_providers: null,
    types: null,
    is_featured: null,
  });
  const [togglingMentorId, setTogglingMentorId] = React.useState<string | null>(
    null,
  );

  const username = useUsername();
  const { navigateToMentor, openCreateMentorModal } = useNavigate();

  const { metadata } = useTenantMetadata({ org: tenantKey });

  // createdBy starts as null - when community mentors is enabled, null means "show all"
  const [createdBy, setCreatedBy] = React.useState<
    'me' | 'my-organization' | 'community' | null
  >(null);

  const communityMentorsEnabled =
    metadata?.mentor_include_community_mentors !== false;

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

  const [starredMentorsLoading, setStarredMentorsLoading] =
    React.useState(false);
  const [customMentorsLoading, setCustomMentorsLoading] = React.useState(false);
  const [featuredMentorsLoading, setFeaturedMentorsLoading] =
    React.useState(false);
  const [defaultMentorsLoading, setDefaultMentorsLoading] =
    React.useState(false);

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

  // Whether the user has created any agent here, which decides if "Me" is
  // offered under "Created By". Independent of search and filters so the
  // option doesn't vanish (or strand an active "Me" filter) while typing.
  const { data: tenantAgentsData } = useGetSearchGlobalQuery(
    [
      {
        content: ['agents'],
        tenant: tenantKey,
        limit: OWN_AGENTS_SCAN_LIMIT,
        returnFacet: false,
      },
    ],
    {
      skip: !username || !tenantKey,
    },
  );

  const hasCustomMentors = React.useMemo(
    () =>
      !!username &&
      (tenantAgentsData?.results ?? []).some((item) =>
        isAgentCreatedBy(item, username),
      ),
    [tenantAgentsData, username],
  );

  const handleCreateMentor = React.useCallback(() => {
    if (!isLoggedIn()) {
      redirectToAuthSpaJoinTenant(tenantKey);
      return;
    }
    openCreateMentorModal();
  }, [openCreateMentorModal, tenantKey]);

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

  const handleFiltersChange = React.useCallback(
    (newFilters: ExplorePageFilters) => {
      setFilters(newFilters);
    },
    [],
  );

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
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
        >
          {t('skipToMainContent')}
        </a>
        <div
          className="scrollbar-hide flex-1 overflow-y-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          id="main-content"
          aria-label={t('agentExplorationPage')}
        >
          <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-32 md:px-6 md:pt-10">
            <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="min-w-0">
                <span className="block text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
                  {t('pageTitle')}
                </span>
                <span className="mt-1.5 block max-w-2xl text-sm leading-relaxed font-normal text-gray-600 md:text-base">
                  {t('discoverAndCreateAgents')}
                </span>
              </h1>
              <WithPermissions rbacResource={CREATE_MENTOR_RBAC_RESOURCE}>
                {({ hasPermission }) =>
                  hasPermission ? (
                    <Button
                      onClick={handleCreateMentor}
                      aria-label={t('createAgentAriaLabel')}
                      className="h-10 shrink-0 gap-1.5 self-start rounded-lg bg-[#1C77B8] px-4 text-white shadow-sm hover:bg-[#1F6FA8] sm:self-auto"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {t('createAgentButton')}
                    </Button>
                  ) : null
                }
              </WithPermissions>
            </header>

            <div className="relative">
              <label htmlFor="mentor-search" className="sr-only">
                {t('searchAgentsLabel')}
              </label>
              {searchQuery &&
              (starredMentorsLoading ||
                customMentorsLoading ||
                featuredMentorsLoading ||
                defaultMentorsLoading) ? (
                <Loader2
                  className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform animate-spin text-[#38A1E5]"
                  aria-hidden="true"
                />
              ) : (
                <Search
                  className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform text-gray-400"
                  aria-hidden="true"
                />
              )}
              <Input
                id="mentor-search"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchQuery) {
                    e.preventDefault();
                    setSearchQuery('');
                  }
                }}
                className="h-12 w-full rounded-xl border-gray-200 bg-white pr-12 pl-12 text-base shadow-sm transition-shadow placeholder:text-gray-400 focus-visible:border-[#38A1E5] focus-visible:ring-4 focus-visible:ring-[#38A1E5]/15 md:text-base"
                aria-label={t('searchAgentsInputLabel')}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-[#38A1E5] focus-visible:outline-none"
                  aria-label={t('clearSearch')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="sticky top-0 z-10 -mx-4 mt-3 mb-8 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:-mx-6 md:px-6">
              <MentorCategories
                facets={facets}
                showCreatedByFilter={
                  metadata?.mentor_include_community_mentors !== false
                }
                onFiltersChange={handleFiltersChange}
                onCreatedByChange={handleCreatedByChange}
                includeMeToCreatedByFilter={hasCustomMentors}
              />
            </div>

            {showOnlyCustomMentors ? (
              <CustomMentorsSection />
            ) : isSearching ? (
              <DefaultMentorsSection />
            ) : (
              <div className="space-y-10">
                <StarredMentorsSection />
                <FeaturedMentorsSection />
                <CustomMentorsSection />
                <DefaultMentorsSection />
              </div>
            )}
          </div>
        </div>
      </div>
    </ExplorePageContext.Provider>
  );
}
