'use client';

import { useParams } from 'next/navigation';
import {
  AgentApiTab,
  AgentSettingsProvider,
} from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';

/**
 * OS wiring for the SDK's `AgentApiTab` (key list with pagination, create /
 * reveal / delete modals). Copy comes from the SDK's own i18n catalog, so no
 * labels are passed. `rbacPermissions` comes from the Redux RBAC slice, the
 * same source `@/hoc/withPermissions` reads, and create / delete go through
 * the OS paywall check.
 */
export function ApiTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  const activeMentorId = getMentorId() || mentorId;

  if (!tenantKey || !activeMentorId || !username) return null;

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      executeGatedAction={(fn) => executeWithTrialCheck(fn)}
    >
      <AgentApiTab />
    </AgentSettingsProvider>
  );
}
