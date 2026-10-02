'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import { checkRbacPermission } from '@iblai/iblai-js/web-utils';
import {
  AgentSafetyTab,
  AgentSettingsProvider,
  type SafetyTabLabels,
} from '@iblai/iblai-js/web-containers/next';

import Markdown from '@/components/markdown';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { parsePrompt } from '@/lib/utils';

const FlaggedPromptsModal = dynamic(
  () =>
    import('./tabs/safety-tab/flagged-prompts').then((mod) => ({
      default: mod.FlaggedPromptsModal,
    })),
  { ssr: false },
);

/**
 * OS/MentorAI wiring for the SDK's `AgentSafetyTab`. The SDK owns the cards,
 * toggles and edit flow; the host supplies identity/RBAC, the paywall gate,
 * the OS flagged-prompts modal, Markdown rendering and the next-intl wording.
 */
export function SafetyTab() {
  const t = useTranslations('tabsSafetyTab');

  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();

  const activeMentorId = getMentorId() || mentorId;

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: activeMentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? '',
    },
    { skip: !username || !activeMentorId || !tenantKey },
  );

  if (!tenantKey || !activeMentorId || !username) return null;

  // Same check as the OS `WithPermissions` HOC: applied even when RBAC is off.
  const canViewModerationLogs = checkRbacPermission(
    rbacPermissions,
    `/mentors/${mentorSettings?.mentor_id}/#view_moderation_logs`,
  );

  const labels: SafetyTabLabels = {
    header: {
      title: t('safetyTitle'),
      description: t('safetyDescription'),
    },
    prompts: {
      moderation: {
        title: t('moderationPromptTitle'),
        tooltip: t('moderationPromptTooltipContent'),
        activeLabel: t('active'),
        inactiveLabel: t('inactive'),
      },
      safety: {
        title: t('safetyPromptTitle'),
        tooltip: t('safetyPromptTooltipContent'),
        activeLabel: t('active'),
        inactiveLabel: t('inactive'),
      },
      moderationResponse: {
        title: t('moderationResponseTitle'),
      },
      safetyResponse: {
        title: t('safetyResponseTitle'),
      },
    },
    actions: {
      edit: t('edit'),
      viewFlaggedPrompts: t('viewFlaggedPrompts'),
    },
    toasts: {
      updateSuccess: t('agentUpdatedSuccess'),
      updateError: t('agentUpdateFailed'),
    },
  };

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      executeGatedAction={(fn) => executeWithTrialCheck(fn)}
    >
      <AgentSafetyTab
        FlaggedPromptsModal={FlaggedPromptsModal}
        showFlaggedPrompts={canViewModerationLogs}
        renderPromptContent={(content) => (
          <Markdown className="text-sm text-gray-700">
            {parsePrompt(content)}
          </Markdown>
        )}
        labels={labels}
      />
      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
      )}
    </AgentSettingsProvider>
  );
}
