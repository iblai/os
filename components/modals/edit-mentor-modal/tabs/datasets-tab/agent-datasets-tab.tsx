'use client';

import { useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import {
  AgentDatasetsTab,
  AgentSettingsProvider,
} from '@iblai/iblai-js/web-containers/next';

import IblPagination from '@/components/ibl-pagination';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { DATASETS_TAB_URL_PARAMS } from '@/lib/constants';
import { TenantKeyMentorIdParams } from '@/lib/types';

import { AddResourceModal } from './add-resource-modal';

// URL query keys the datasets tab owns (shared with useNavigate's close/tab
// logic so they're cleared together with the modal).
const PAGE_PARAM = DATASETS_TAB_URL_PARAMS.page;
const SEARCH_PARAM = DATASETS_TAB_URL_PARAMS.search;

// Only positive integers are valid page numbers; anything else falls back to 1.
const parsePageParam = (value: string | null): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
};

/**
 * OS host wrapper for the SDK `AgentDatasetsTab`. The SDK component reads
 * tenant/mentor/username/RBAC from the nearest `<AgentSettingsProvider>` and
 * injects OS-specific pagination + add-resource UI via props (they have deep
 * standalone dependencies, so the SDK does not bundle them). This mirrors the
 * already-converged `EvaluationTab` / `TasksTab` wrappers.
 *
 * The SDK tab keeps page/search state internally unless driven by controlled
 * props. We drive them from the URL (`datasetsPage` / `datasetsSearch`) so the
 * state survives reload, back/forward, and link sharing. Page clicks push a
 * history entry; the debounced search replaces (no history spam) and drops the
 * page param — the SDK's page-reset contract: firing `onSearchChange` implies a
 * reset to page 1, which the host performs by removing `datasetsPage`.
 */
export function AgentDatasetsTabWrapper() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId, navigateWithSearchParams } = useNavigate();
  // The datasets hooks resolve the active mentor via `getMentorId()`, falling
  // back to the route param (matches the local DatasetsTab it replaces).
  const activeMentorId = getMentorId() || mentorId;
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();

  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get(PAGE_PARAM));
  const search = searchParams.get(SEARCH_PARAM) ?? '';

  const handlePageChange = useCallback(
    (newPage: number) => {
      // Push so browser back/forward walks through the visited pages.
      navigateWithSearchParams({ [PAGE_PARAM]: String(newPage) });
    },
    [navigateWithSearchParams],
  );

  const handleSearchChange = useCallback(
    (newSearch: string) => {
      // Replace (not push) so a burst of debounced keystrokes doesn't stack
      // history entries, and drop the page param to reset back to page 1.
      navigateWithSearchParams(
        { [SEARCH_PARAM]: newSearch || null, [PAGE_PARAM]: null },
        { replace: true },
      );
    },
    [navigateWithSearchParams],
  );

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey ?? ''}
      mentorId={activeMentorId ?? ''}
      username={username ?? ''}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      executeGatedAction={executeWithTrialCheck}
    >
      <AgentDatasetsTab
        page={page}
        search={search}
        onPageChange={handlePageChange}
        onSearchChange={handleSearchChange}
        PaginationComponent={IblPagination}
        AddResourceModal={AddResourceModal}
      />
    </AgentSettingsProvider>
  );
}
