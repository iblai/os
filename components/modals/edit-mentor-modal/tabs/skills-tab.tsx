'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AgentSettingsProvider,
  AgentSkillsTab,
} from '@iblai/iblai-js/web-containers/next';

import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { config } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function SkillsTab() {
  const t = useTranslations('tabsSkillsTab');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);

  const activeMentorId = getMentorId() || mentorId;

  if (!tenantKey || !activeMentorId || !username) return null;

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
    >
      <AgentSkillsTab labels={{ header: { title: t('heading') } }} />
    </AgentSettingsProvider>
  );
}
