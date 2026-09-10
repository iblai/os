'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AgentLLMTab,
  AgentSettingsProvider,
  type LLMTabLabels,
} from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { MENTOR_VISIBILITY } from '@/lib/constants';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';

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
 * `getLLMProviderDetails` is deliberately NOT passed — the SDK's default
 * resolver is byte-identical to the OS copy in `@/lib/utils` (same logo paths,
 * same display names, same OpenAI/Google model-specific overrides), and OS
 * already serves those assets from `public/`.
 *
 * The OS-local `LLMTab` in `./tabs/llm-tab.tsx` is intentionally left in place
 * so this swap can be reverted by changing the two call sites back.
 */
export function LLMTab({ showConfigurationHeader = true }: Props) {
  const t = useTranslations('tabsLlmTab');
  const tProviderModal = useTranslations('modalsLlmProviderModal');

  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();

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
    search: {
      placeholder: t('searchProviders'),
    },
    providerLogoAlt: (providerName) => t('providerLogoAlt', { providerName }),
    toasts: {
      updateSuccess: t('llmUpdatedSuccessfully'),
      updateError: t('failedToUpdateLlm'),
    },
    providerModal: {
      title: tProviderModal('title'),
      description: (providerName) =>
        tProviderModal('dialogDescription', { providerName }),
      searchPlaceholder: tProviderModal('searchPlaceholder'),
      // OS calls this string the modal's "subtitle"; the SDK calls it helpText.
      helpText: tProviderModal('subtitle'),
      providerIconAlt: (providerName) =>
        tProviderModal('providerIconAlt', { providerName }),
      tooLargeTitle: tProviderModal('tooLargeTitle'),
      tooLargeDescription: (modelName, modelSize) =>
        tProviderModal('tooLargeDescription', { modelName, modelSize }),
      cancel: tProviderModal('cancel'),
      downloadAnyway: tProviderModal('downloadAnyway'),
      alreadyDownloadingTitle: tProviderModal('alreadyDownloadingTitle'),
      unnamedModel: tProviderModal('unnamedModel'),
      alreadyDownloadingDescription: (modelName) =>
        tProviderModal('alreadyDownloadingDescription', { modelName }),
      gotIt: tProviderModal('gotIt'),
      announceDownloaded: (modelName) =>
        tProviderModal('announceDownloaded', { modelName }),
      announceCancelled: tProviderModal('announceCancelled'),
      announceFailed: tProviderModal('announceFailed'),
      announceStarted: (modelName) =>
        tProviderModal('announceStarted', { modelName }),
      localModel: {
        onDevice: tProviderModal('localModel.onDevice'),
        starting: tProviderModal('localModel.starting'),
        cancel: tProviderModal('localModel.cancel'),
        inUse: tProviderModal('localModel.inUse'),
        downloadFailedRetry: tProviderModal('localModel.downloadFailedRetry'),
        ariaDownload: (modelName, modelSize) =>
          tProviderModal('localModel.ariaDownload', { modelName, modelSize }),
        ariaStarting: (modelName) =>
          tProviderModal('localModel.ariaStarting', { modelName }),
        ariaDownloading: (modelName, percent) =>
          tProviderModal('localModel.ariaDownloading', { modelName, percent }),
        ariaInstalled: (modelName) =>
          tProviderModal('localModel.ariaInstalled', { modelName }),
        ariaSelected: (modelName) =>
          tProviderModal('localModel.ariaSelected', { modelName }),
        ariaError: (modelName) =>
          tProviderModal('localModel.ariaError', { modelName }),
        ariaErrorWithReason: (modelName, reason) =>
          tProviderModal('localModel.ariaErrorWithReason', {
            modelName,
            reason,
          }),
      },
    },
  };

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      // Route every gated action through the OS paywall check.
      executeGatedAction={(fn) => executeWithTrialCheck(fn)}
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
      />
    </AgentSettingsProvider>
  );
}
