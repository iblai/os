'use client';

import { useParams, useRouter } from 'next/navigation';
import { AgentAnalyticsTab } from '@iblai/iblai-js/web-containers/next';
import { useGetMentorPublicSettingsQuery } from '@iblai/iblai-js/data-layer';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { ANONYMOUS_USERNAME } from '@/lib/constants';
import { TenantKeyMentorIdParams } from '@/lib/types';

/**
 * Analytics tab shown inside the Edit-Agent modal. It renders the SDK
 * `AgentAnalyticsTab` hub (a list of analytics destinations) and, when an
 * entry is clicked, closes the modal and navigates to the corresponding
 * full-page analytics view. `audit` is hidden unless the user has the
 * `view_audit_logs` RBAC permission (mirrors `analytics/layout.tsx`); the
 * `courses`/`programs` mentor-agnostic reports are always excluded here.
 */
export function AnalyticsTab() {
  const router = useRouter();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId, closeEditMentorModal } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;

  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery(
    {
      mentor: activeMentorId,
      org: tenantKey,
      // @ts-ignore userId is not part of the query definition
      userId: username ?? ANONYMOUS_USERNAME,
    },
    { skip: !activeMentorId || !tenantKey },
  );

  const mentorDbId = mentorPublicSettings?.mentor_id;
  const canViewAuditLogs =
    !!mentorDbId &&
    checkRbacPermission(
      rbacPermissions,
      `/mentors/${mentorDbId}/#view_audit_logs`,
    );

  const excludeTabs = ['courses', 'programs'];
  if (!canViewAuditLogs) {
    excludeTabs.push('audit');
  }

  const handleNavigate = (value: string) => {
    if (!tenantKey || !activeMentorId) return;
    const basePath = `/platform/${tenantKey}/${activeMentorId}/analytics`;
    const path = value ? `${basePath}/${value}` : basePath;
    // Close the modal first so we don't leave a dialog mounted over the
    // full-page analytics view we're navigating to.
    closeEditMentorModal();
    router.push(path);
  };

  return (
    <AgentAnalyticsTab excludeTabs={excludeTabs} onNavigate={handleNavigate} />
  );
}
