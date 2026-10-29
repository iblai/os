'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AgentLLMTab,
  AgentSettingsProvider,
  type LLMTabLabels,
} from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useIsAdmin, useUserIsStudent, useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { MENTOR_VISIBILITY } from '@/lib/constants';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useLlmProviderModalLabels } from './llm-provider-modal-labels';

type Props = {
  showConfigurationHeader?: boolean;
};

/**
 * OS/MentorAI wiring for the SDK's full-parity `AgentLLMTab`.
 *
 * Mirrors `./settings-tab.tsx`: the host supplies the shared identity/config
 * through `AgentSettingsProvider` and re-maps every user-visible string onto
 * the OS's existing next-intl wording, while the provider grid, the provider
 * modal and the on-device download flow all live inside the SDK component.
 *
 * Provider names and logos are backend-owned: the SDK grid renders each LLM
 * row's `display_name`/`logo` straight from the API, so nothing is passed for
 * them here.
 */
export function LLMTab({ showConfigurationHeader = true }: Props) {
  const t = useTranslations('tabsLlmTab');
  const providerModal = useLlmProviderModalLabels();

  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  // Same live-admin gate as the sidebar's admin cluster: an admin browsing in
  // User mode is not an admin here (useUserIsStudent). Only the edit-agent slot
  // (with its header) offers the tenant-wide Users Models editor, not the nav-bar dialog.
  const isAdmin = useIsAdmin();
  const userIsStudent = useUserIsStudent();
  const isTenantAdmin = isAdmin && !userIsStudent && showConfigurationHeader;

  // The nav-bar's "LLM Providers" dialog can target a mentor other than the
  // one in the route (the modal-stack mentor id), exactly as the OS monolith
  // did. Same precedence: modal mentor wins, route param is the fallback.
  const activeMentorId = getMentorId() || mentorId;

  // AgentSettingsProvider requires all three identity values; render nothing
  // until they resolve (mirrors the guard used by the other SDK-wired tabs).
  if (!tenantKey || !activeMentorId || !username) return null;

  // Map the SDK's "agent" label contract onto the OS monolith's exact strings.
  // Every slot has a next-intl key already shipped in all four locales, so the
  // tab reads identically to before in every language. Parameterised slots are
  // functions on the SDK side and ICU messages on the OS side.
  const labels: LLMTabLabels = {
    header: {
      title: t('llmConfiguration'),
      description: t('configureLanguageModelSettings'),
    },
    infoBox: t('infoBox'),
    inChatModelChange: {
      label: t('inChatModelChangeLabel'),
      description: t('inChatModelChangeDescription'),
      tooltip: t('inChatModelChangeTooltip'),
      tooltipAriaLabel: t('inChatModelChangeTooltipAriaLabel'),
    },
    search: {
      placeholder: t('searchProviders'),
    },
    providerLogoAlt: (providerName) => t('providerLogoAlt', { providerName }),
    toasts: {
      updateSuccess: t('llmUpdatedSuccessfully'),
      updateError: t('failedToUpdateLlm'),
    },
    providerModal,
  };

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      // The SDK toasts success as soon as the gate settles, but a blocked gate
      // returns null without saving. Never settling keeps that false success
      // toast away while the pricing modal shows, as the Settings tab does.
      executeGatedAction={(fn) =>
        executeWithTrialCheck(fn) ?? new Promise<never>(() => {})
      }
      visibilityOptions={MENTOR_VISIBILITY}
    >
      <AgentLLMTab
        showConfigurationHeader={showConfigurationHeader}
        // Pin the tab to the mentor the host resolved. Redundant with the
        // provider today, but it keeps the nav-bar path correct if this
        // wrapper is ever mounted inside an outer AgentSettingsProvider
        // describing the route mentor rather than the nav-selected one.
        mentorId={activeMentorId}
        labels={labels}
        isTenantAdmin={isTenantAdmin}
      />
    </AgentSettingsProvider>
  );
}
