'use client';

import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

import { useSidebar } from '@/components/ui/sidebar';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { useIsAdmin, useUserIsStudent, useUsername } from '@/hooks/use-user';

import {
  buildTourSteps,
  filterVisibleTourSteps,
  type TourStep,
} from './tour-steps';
import { isBlockingDialogOpen } from './tour-targets';
import { useTourCompletion, type TourOutcome } from './use-tour-completion';

const TourRunner = dynamic(
  () => import('./tour-runner').then((m) => m.TourRunner),
  { ssr: false, loading: () => null },
);

/** `?tour=1` replays the tour even after it was completed (support, QA, e2e). */
export const TOUR_QUERY_PARAM = 'tour';

/** Grace period for the shell (navbar, sidebar, chat input) to mount. */
export const TOUR_START_DELAY_MS = 1000;
export const TOUR_START_RETRY_MS = 500;
export const TOUR_START_MAX_ATTEMPTS = 10;

// Tenant-level pages that share the `/platform/<tenant>/<segment>` shape with
// the agent chat page.
const TENANT_PAGES = new Set([
  'analytics',
  'explore',
  'notifications',
  'projects',
  'workflows',
]);

/**
 * The tour runs on the agent chat page (`/platform/<tenant>/<agent>`) only:
 * most of its steps are the chat input, so anywhere else it would be a
 * fragment of itself.
 */
export function isTourPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split('?')[0];
  const match = /^\/platform\/[^/]+\/([^/]+)\/?$/.exec(path);
  return !!match && !TENANT_PAGES.has(match[1]);
}

type TourSession = 'idle' | 'running' | 'done';

/**
 * First-visit product tour over the app chrome, opening on the chat input:
 * then the profile menu, privacy mode, conversation starters, the sidebar's
 * Agents menu and, for admins, the account tools in the sidebar footer. Runs once per user — the
 * outcome is stored on the user's metadata, so it follows the account — on
 * tablet and desktop only, and never in embedded mode.
 *
 * Mounted inside `SidebarProvider` (see `AppLayout`) so it can read the
 * sidebar's own mobile state.
 */
export function ProductTour() {
  const t = useTranslations('productTour');
  const username = useUsername();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile } = useSidebar();
  const embedMode = useEmbedMode();
  const isAdmin = useIsAdmin();
  const userIsStudent = useUserIsStudent();
  const {
    completed,
    isLoading: isTourStateLoading,
    isError: isTourStateUnknown,
    markCompleted,
  } = useTourCompletion(username);

  const [session, setSession] = useState<TourSession>('idle');
  const [steps, setSteps] = useState<TourStep[]>([]);

  // Same live-admin signal as the sidebar's admin tools, so the account step
  // follows the navbar User/Admin switch.
  const isLiveAdmin = isAdmin && !userIsStudent;
  const forced = searchParams?.get(TOUR_QUERY_PARAM) === '1';

  // Without a username there is nobody to remember the tour for; when the
  // metadata can't be read, don't guess — only an explicit replay runs.
  const eligible =
    session === 'idle' &&
    !!username &&
    !embedMode &&
    !isTourStateLoading &&
    !isMobile &&
    isTourPath(pathname) &&
    (forced || (!isTourStateUnknown && !completed));

  useEffect(() => {
    if (!eligible) return;

    let attempts = 0;
    let timer: number;

    const tryStart = () => {
      // A first-visit dialog (disclaimer, user agreement, trial) comes first;
      // the tour's overlay would sit on top of it. Waiting on one doesn't use
      // up the retry budget.
      if (isBlockingDialogOpen()) {
        timer = window.setTimeout(tryStart, TOUR_START_RETRY_MS);
        return;
      }
      const visibleSteps = filterVisibleTourSteps(
        buildTourSteps({ isAdmin: isLiveAdmin, t }),
      );
      if (visibleSteps.length > 0) {
        setSteps(visibleSteps);
        setSession('running');
        return;
      }
      attempts += 1;
      if (attempts < TOUR_START_MAX_ATTEMPTS) {
        timer = window.setTimeout(tryStart, TOUR_START_RETRY_MS);
      }
    };

    timer = window.setTimeout(tryStart, TOUR_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [eligible, isLiveAdmin, t]);

  const handleEnd = useCallback(
    (outcome: TourOutcome) => {
      void markCompleted(outcome);
      setSession('done');
    },
    [markCompleted],
  );

  if (session !== 'running') return null;

  return <TourRunner steps={steps} run onEnd={handleEnd} />;
}
