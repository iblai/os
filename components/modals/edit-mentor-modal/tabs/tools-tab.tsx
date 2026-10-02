'use client';

import { useParams } from 'next/navigation';
import {
  AgentSettingsProvider,
  AgentToolsTab,
} from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

/**
 * OS wiring for the SDK's `AgentToolsTab`. Copy comes from the SDK's own
 * i18n catalog (bridged via WebContainersI18nProvider), which already matches
 * the OS wording in all four locales, so no labels are passed.
 */
export function ToolsTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() || mentorId;

  if (!tenantKey || !activeMentorId || !username) return null;

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
    >
      <AgentToolsTab />
    </AgentSettingsProvider>
  );
}
