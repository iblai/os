'use client';

import { useParams } from 'next/navigation';
import {
  AgentSettingsProvider,
  McpTab as SdkMcpTab,
} from '@iblai/iblai-js/web-containers/next';
import type { MCPServer } from '@iblai/iblai-js/data-layer';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';

interface McpTabProps {
  onSelect?: (server: MCPServer) => void;
}

/**
 * OS wiring for the SDK's `McpTab` (featured and custom connectors, connect /
 * disconnect, the agent on/off switch, add / edit / delete). Copy comes from
 * the SDK's own i18n catalog, so no labels are passed. `rbacPermissions` comes
 * from the Redux RBAC slice, the same source `@/hoc/withPermissions` reads.
 */
export function McpTab({ onSelect }: McpTabProps = {}) {
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
      <SdkMcpTab onSelect={onSelect} />
    </AgentSettingsProvider>
  );
}
