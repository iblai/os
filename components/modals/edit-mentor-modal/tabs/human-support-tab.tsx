'use client';

import { useParams } from 'next/navigation';
import {
  AgentHumanSupportTab,
  AgentSettingsProvider,
} from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function HumanSupportTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  // const { getMentorId } = useNavigate();
  const username = useUsername();
  // const activeMentorId = getMentorId() ?? mentorId;
  console.log('HumanSupportTab', tenantKey, mentorId, username);
  // if (!tenantKey || !activeMentorId || !username) return null;

  // AgentHumanSupportTab reads tenant/mentor/username from the nearest
  // AgentSettingsProvider (like AgentTasksTab), so the provider is required
  // here. No `labels` override is passed — the SDK resolves every string
  // through its own i18n catalog, which follows the app locale via the
  // WebContainersI18nProvider bridge, so all copy stays translated.
  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={mentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
    >
      <AgentHumanSupportTab />
    </AgentSettingsProvider>
  );
}
