'use client';

import { useParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { TimeTrackingProvider } from '@iblai/iblai-js/web-containers';
import {
  selectActiveTab,
  selectEnableGrading,
  selectEnableLessonCompletion,
  selectMetadata,
  selectSessionIds,
} from '@iblai/iblai-js/web-utils';
import { useAppSelector } from '@/lib/hooks';

// Next.js specific wrapper that provides routing integration
export function useMentorTimeTrackingConfig() {
  const params = useParams();
  const pathname = usePathname();
  const activeTab = useAppSelector(selectActiveTab);
  const sessionIds = useAppSelector(selectSessionIds);
  const enableGrading = useAppSelector(selectEnableGrading);
  const enableLessonCompletion = useAppSelector(selectEnableLessonCompletion);
  const { edxCourseId } = useAppSelector(selectMetadata);
  const routeChangeCallbackRef = useRef<(() => void) | null>(null);

  const getTenantKey = useCallback(() => {
    return (params.tenantKey as string) ?? '';
  }, [params.tenantKey]);

  const getMentorId = useCallback(() => {
    return params.mentorId as string | undefined;
  }, [params.mentorId]);

  const getCurrentUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return '/';
  }, []);

  // For Next.js app router, we'll use a different approach for route changes
  const onRouteChange = useCallback(
    (callback: () => void) => {
      let previousPathname = pathname;
      let previousSearch = window.location.search;

      const checkPathChange = () => {
        if (typeof window === 'undefined') return;

        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;

        // Check if either pathname or search params changed
        if (
          currentPath !== previousPathname ||
          currentSearch !== previousSearch
        ) {
          console.log(
            `Route change detected: ${previousPathname}${previousSearch} -> ${currentPath}${currentSearch}`,
          );
          callback();
          previousPathname = currentPath;
          previousSearch = currentSearch;
        }
      };

      // Use more frequent polling for better responsiveness during navigation
      const interval = setInterval(checkPathChange, 50);

      // Also listen to browser navigation events
      const handlePopState = () => {
        setTimeout(checkPathChange, 10); // Small delay to ensure URL is updated
      };

      const handleBeforeUnload = () => {
        callback(); // Send time data before page unload
      };

      window.addEventListener('popstate', handlePopState);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearInterval(interval);
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    },
    [pathname],
  );

  const getSessionUuid = useCallback(() => {
    return sessionIds[activeTab];
  }, [sessionIds, activeTab]);

  // Sent as `course_id`. Only when the edX host has enabled grading or lesson
  // completion (MENTOR:ENABLE_* in lib/handlers.ts) is the course id it posted
  // (MENTOR:EDX_COURSE_ID) one this time should be attributed to.
  const getCourseId = useCallback(() => {
    if (!enableGrading && !enableLessonCompletion) return undefined;
    return edxCourseId || undefined;
  }, [enableGrading, enableLessonCompletion, edxCourseId]);

  // React to pathname changes directly (additional detection for Next.js app router)
  useEffect(() => {
    if (routeChangeCallbackRef.current) {
      console.log(`Pathname changed to: ${pathname}`);
      routeChangeCallbackRef.current();
    }
  }, [pathname]);

  // Enhanced onRouteChange that also stores the callback reference
  const enhancedOnRouteChange = useCallback(
    (callback: () => void) => {
      routeChangeCallbackRef.current = callback;
      return onRouteChange(callback);
    },
    [onRouteChange],
  );

  return {
    getTenantKey,
    getMentorId,
    getCurrentUrl,
    onRouteChange: enhancedOnRouteChange,
    getSessionUuid,
    getCourseId,
  };
}

// Component wrapper for mentor app
export function MentorTimeTrackingProvider({
  intervalSeconds = 30,
  enabled = true,
}: {
  intervalSeconds?: number;
  enabled?: boolean;
}) {
  const config = useMentorTimeTrackingConfig();

  return (
    <>
      <TimeTrackingProvider
        intervalSeconds={intervalSeconds}
        enabled={enabled}
        {...config}
      />
    </>
  );
}
