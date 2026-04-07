import React from 'react';

import {
  useLazySeedMentorsQuery,
  useLazyGetMentorsQuery,
} from '@/features/mentors/api-slice';

type UseMentorProviderProps = {
  onAuthSuccess?: () => void;
  onAuthFailure?: (reason: string) => void;
  redirectToAuthSpa: () => void;
  redirectToMentor: (tenantKey: string, mentorId: string) => void;
  redirectToNoMentorsPage: () => void;
  redirectToCreateMentor: () => void;
  username: string;
  tenantKey: string;
  isAdmin: boolean;
  isMainTenant: boolean;
};

type UseMentorProviderReturn = {
  isLoading: boolean;
};

export function useMentorProvider({
  onAuthSuccess,
  onAuthFailure,
  redirectToAuthSpa,
  redirectToMentor,
  redirectToNoMentorsPage,
  redirectToCreateMentor,
  username,
  tenantKey,
  isAdmin,
  isMainTenant,
}: UseMentorProviderProps): UseMentorProviderReturn {
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchMentors] = useLazyGetMentorsQuery();
  const [fetchSeedMentors] = useLazySeedMentorsQuery();

  const determineMentorToRedirectTo = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Get the user's recent mentors
      const recentMentorsResult = await fetchMentors({
        tenantKey,
        username,
        params: { order_by: 'recently_accessed_at', limit: 10 },
      });
      const recentMentors = recentMentorsResult.data?.results || [];

      // Check if we found recent mentors for the tenant
      if (recentMentors.length > 0) {
        // Select the most recent mentor as current mentor
        redirectToMentor(tenantKey, recentMentors[0]?.slug || '');
        onAuthSuccess?.();
        return;
      }

      // If no recent mentors, get featured mentors
      const featuredMentorsResult = await fetchMentors({
        tenantKey,
        username,
        params: { featured: true, limit: 10 },
      });
      const featuredMentors = featuredMentorsResult.data?.results || [];

      // Check if we found featured mentors
      if (featuredMentors.length > 0) {
        // Check if tenant is 'main' and user is not admin
        if (isMainTenant && !isAdmin) {
          // Set the default IBL mentor
          const defaultIblMentor = featuredMentors.find(
            (mentor) => mentor?.metadata?.default === true,
          );

          // Check if found default featured mentor
          if (defaultIblMentor) {
            redirectToMentor(tenantKey, defaultIblMentor?.slug || '');
            onAuthSuccess?.();
            return;
          }
        } else {
          // Check if there's a default featured mentor
          const defaultFeatureMentor = featuredMentors.find(
            (mentor) => mentor?.metadata?.default === true,
          );

          if (defaultFeatureMentor) {
            redirectToMentor(tenantKey, defaultFeatureMentor?.slug || '');
            onAuthSuccess?.();
            return;
          }
        }

        // If no default mentor, select the first featured mentor
        redirectToMentor(tenantKey, featuredMentors[0]?.slug || '');
        onAuthSuccess?.();
        return;
      }

      // If no featured mentors, get non-featured mentors
      const nonFeaturedMentorsResult = await fetchMentors({
        tenantKey,
        username,
        params: { featured: false, limit: 10 },
      });
      const nonFeaturedMentors = nonFeaturedMentorsResult.data?.results || [];

      // Check if we found non-featured mentors
      if (nonFeaturedMentors.length > 0) {
        // Select the first non-featured mentor as current mentor
        redirectToMentor(tenantKey, nonFeaturedMentors[0]?.slug || '');
        onAuthSuccess?.();
        return;
      }

      // If no mentors found, check if user is admin
      if (isAdmin) {
        // Try to seed mentors
        const seedMentorsResult = await fetchSeedMentors({
          tenantKey,
          username,
        });
        const seededMentorsDetails = seedMentorsResult.data?.details;

        // Check if mentors have been seeded
        if (seededMentorsDetails) {
          // Retry getting featured mentors after seeding
          const featuredMentorsAfterSeedResult = await fetchMentors({
            tenantKey,
            username,
            params: { featured: true, limit: 10 },
          });
          const featuredMentorsAfterSeed =
            featuredMentorsAfterSeedResult.data?.results || [];

          if (featuredMentorsAfterSeed.length > 0) {
            redirectToMentor(
              tenantKey,
              featuredMentorsAfterSeed[0]?.slug || '',
            );
            onAuthSuccess?.();
            return;
          }
        } else {
          // Prompt the user to create a mentor
          redirectToCreateMentor();
          onAuthSuccess?.();
          return;
        }
      } else {
        // Redirect to no mentors page for non-admin users
        redirectToNoMentorsPage();
        onAuthSuccess?.();
        return;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      onAuthFailure?.(`Unexpected error: ${errorMessage}`);
      console.log('[auth-redirect] Unexpected error in mentor redirect', {
        error: errorMessage,
      });
      redirectToAuthSpa();
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchMentors,
    fetchSeedMentors,
    tenantKey,
    username,
    isAdmin,
    isMainTenant,
    redirectToMentor,
    redirectToNoMentorsPage,
    redirectToCreateMentor,
    redirectToAuthSpa,
    onAuthSuccess,
    onAuthFailure,
  ]);

  React.useEffect(() => {
    determineMentorToRedirectTo();
  }, []);

  return {
    isLoading,
  };
}
