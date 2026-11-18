'use client';

import { useEffect, useState } from 'react';
import { useGetRbacPermissionsMutation } from '@iblai/iblai-js/data-layer';

import { updateRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppDispatch } from '@/lib/hooks';

type Options = {
  enabled: boolean;
  /** The agent's numeric `mentor_id` from its settings. */
  mentorDbId: number | undefined;
  tenantKey: string | undefined;
};

/**
 * The global RBAC permissions cache only holds the page agent's entries, so
 * for any other agent the segment filter would strip every tab that has an
 * `rbacResource`. Mirrors what MentorProvider does on page load
 * (`loadMentorsPermissions`), scoped to this agent's resources.
 *
 * Returns true once this agent's permissions were fetched (or the fetch
 * failed, leaving the existing permissions for the filter to decide).
 */
export function useHydrateMentorRbac({
  enabled,
  mentorDbId,
  tenantKey,
}: Options): boolean {
  const dispatch = useAppDispatch();
  const [getRbacPermissions] = useGetRbacPermissionsMutation();
  const [fetchedForMentor, setFetchedForMentor] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!mentorDbId || !tenantKey) return;
    if (fetchedForMentor === mentorDbId) return;
    let cancelled = false;
    (async () => {
      try {
        const permissions = await getRbacPermissions({
          requestBody: {
            platform_key: tenantKey,
            resources: [
              `/mentors/${mentorDbId}/`,
              `/mentors/${mentorDbId}/llms/`,
              `/mentors/${mentorDbId}/mcpservers/`,
              `/mentors/${mentorDbId}/memory/`,
              `/mentors/${mentorDbId}/documents/`,
              `/mentors/${mentorDbId}/tools/`,
              `/mentors/${mentorDbId}/prompts/`,
            ],
          },
        }).unwrap();
        if (cancelled) return;
        dispatch(updateRbacPermissions({ ...permissions }));
      } catch {
        // Match MentorProvider: leave the existing permissions in place
        // rather than crash the caller.
      } finally {
        if (!cancelled) setFetchedForMentor(mentorDbId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    mentorDbId,
    tenantKey,
    fetchedForMentor,
    getRbacPermissions,
    dispatch,
  ]);

  return !!mentorDbId && fetchedForMentor === mentorDbId;
}
